import {
  Client,
  Interaction,
  ButtonInteraction,
  ModalSubmitInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { dbGet, dbSet } from "../store/db";
import { logger } from "../../lib/logger";

function buildDisabledRow(guildId: string, submissionId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`apply:approve:${guildId}:${submissionId}`)
      .setLabel("Approve")
      .setStyle(ButtonStyle.Success)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`apply:deny:${guildId}:${submissionId}`)
      .setLabel("Deny")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true),
  );
}

async function finaliseDecision(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  guildId: string,
  submissionId: string,
  newStatus: "approved" | "denied",
  denyReason?: string,
) {
  const subs = (await dbGet<any>("applicationSubmissions", guildId)) ?? {};
  const sub = subs[submissionId];
  if (!sub) {
    return interaction.editReply({ content: "❌ Submission not found — it may have been deleted." });
  }
  if (sub.status !== "pending") {
    return interaction.editReply({ content: `❌ This application is already **${sub.status}**.` });
  }

  subs[submissionId] = {
    ...sub,
    status: newStatus,
    reviewedBy: interaction.user.tag,
    reviewedAt: Date.now(),
    ...(denyReason ? { denyReason } : {}),
  };
  await dbSet("applicationSubmissions", guildId, subs);

  // ── Update the staff embed ────────────────────────────────────────────────
  const originalMsg = (interaction as any).message as any;
  if (originalMsg?.embeds?.[0]) {
    const statusValue = newStatus === "approved"
      ? "✅ Approved"
      : `❌ Denied${denyReason ? ` — ${denyReason}` : ""}`;

    const updatedEmbed = EmbedBuilder.from(originalMsg.embeds[0])
      .setColor(newStatus === "approved" ? 0x2ecc71 : 0xe74c3c)
      .spliceFields(
        1, 1,
        { name: "Status", value: statusValue, inline: true },
        { name: "Reviewed by", value: interaction.user.tag, inline: true },
      );

    await originalMsg.edit({
      embeds: [updatedEmbed],
      components: [buildDisabledRow(guildId, submissionId)],
    }).catch(() => {});
  }

  // ── DM the applicant ──────────────────────────────────────────────────────
  if (sub.userId) {
    const guild = interaction.client.guilds.cache.get(guildId);
    const guildName = guild?.name ?? "the server";
    const formTitle = sub.formTitle ?? "Application";

    // Load the form to check per-form DM settings
    const forms = (await dbGet<any>("applicationForms", guildId)) ?? {};
    const form = forms[sub.formId];
    const notifyApplicant = form?.notifyApplicant !== false; // default true

    if (notifyApplicant) {
      // Only DM if user is still in the server
      const member = guild ? await guild.members.fetch(sub.userId).catch(() => null) : null;
      if (!member) {
        logger.info({ userId: sub.userId }, "Skipping DM — user is no longer in the server");
      } else {
        // Build DM embed with optional custom message
        const customMsg = newStatus === "approved"
          ? (form?.approveMessage?.trim() || null)
          : (form?.denyMessage?.trim() || null);

        const defaultMsg = newStatus === "approved"
          ? `Your **${formTitle}** for **${guildName}** has been **approved**! Welcome to the team.`
          : `Your **${formTitle}** for **${guildName}** has been **denied**.`;

        const dmEmbed = new EmbedBuilder()
          .setColor(newStatus === "approved" ? 0x2ecc71 : 0xe74c3c)
          .setTitle(newStatus === "approved" ? "✅ Application Approved" : "❌ Application Denied")
          .setDescription(customMsg ?? defaultMsg)
          .addFields({ name: "Form", value: formTitle, inline: true })
          .addFields({ name: "Reviewed by", value: interaction.user.tag, inline: true });

        if (newStatus === "denied" && denyReason) {
          dmEmbed.addFields({ name: "Reason", value: denyReason, inline: false });
        }

        dmEmbed.setTimestamp();

        const applicant = await interaction.client.users.fetch(sub.userId).catch(() => null);
        if (applicant) {
          await applicant.send({ embeds: [dmEmbed] }).catch(() => {
            logger.warn({ userId: sub.userId }, "Could not DM applicant — DMs may be closed");
          });
        }
      }
    }
  }

  const dmNote = "They have been notified via DM.";
  const noDmNote = "DM notifications are disabled for this form.";
  const forms2 = (await dbGet<any>("applicationForms", guildId)) ?? {};
  const form2 = forms2[sub.formId];
  const willNotify = form2?.notifyApplicant !== false && sub.userId;

  await interaction.editReply({
    content: newStatus === "approved"
      ? `✅ Application from **${sub.userTag}** has been approved.${willNotify ? ` ${dmNote}` : ` ${noDmNote}`}`
      : `❌ Application from **${sub.userTag}** has been denied${denyReason ? ` (reason: ${denyReason})` : ""}.${willNotify ? ` ${dmNote}` : ` ${noDmNote}`}`,
  });
}

// ── Button handler ────────────────────────────────────────────────────────────

async function handleApplicationButton(interaction: ButtonInteraction) {
  const [, action, guildId, submissionId] = interaction.customId.split(":");
  if (!guildId || !submissionId || (action !== "approve" && action !== "deny")) return;

  // Approve — no reason needed, finalise immediately
  if (action === "approve") {
    await interaction.deferReply({ ephemeral: true });
    await finaliseDecision(interaction, guildId, submissionId, "approved");
    return;
  }

  // Deny — show a modal to collect the reason
  const modal = new ModalBuilder()
    .setCustomId(`apply:denymodal:${guildId}:${submissionId}`)
    .setTitle("Deny Application");

  const reasonInput = new TextInputBuilder()
    .setCustomId("denyReason")
    .setLabel("Reason for denial")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("e.g. Does not meet the experience requirement.")
    .setRequired(true)
    .setMaxLength(500);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
  await interaction.showModal(modal);
}

// ── Modal submit handler ──────────────────────────────────────────────────────

async function handleDenyModal(interaction: ModalSubmitInteraction) {
  const [, , guildId, submissionId] = interaction.customId.split(":");
  if (!guildId || !submissionId) return;

  await interaction.deferReply({ ephemeral: true });

  const denyReason = interaction.fields.getTextInputValue("denyReason").trim();
  await finaliseDecision(interaction as any, guildId, submissionId, "denied", denyReason || undefined);
}

// ── Registration ──────────────────────────────────────────────────────────────

export function registerApplicationButtons(client: Client) {
  client.on("interactionCreate", async (interaction: Interaction) => {
    try {
      if (interaction.isButton() && interaction.customId.startsWith("apply:")) {
        await handleApplicationButton(interaction);
        return;
      }
      if (interaction.isModalSubmit() && interaction.customId.startsWith("apply:denymodal:")) {
        await handleDenyModal(interaction);
        return;
      }
    } catch (err) {
      logger.error({ err, customId: (interaction as any).customId }, "Application interaction handler failed");
      const i = interaction as any;
      if (!i.replied && !i.deferred) {
        await i.reply({ content: "❌ Something went wrong.", ephemeral: true }).catch(() => {});
      }
    }
  });
}
