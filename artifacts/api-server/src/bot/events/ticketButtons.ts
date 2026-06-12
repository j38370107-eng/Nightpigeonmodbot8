import { sendViaWebhook } from "../lib/webhookSender";
import {
  Client,
  Interaction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  GuildMember,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonStyle,
  ChannelType,
  TextChannel,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
} from "discord.js";
import {
  getTicketConfig,
  checkCooldown,
  setCooldown,
  nextTicketNumber,
  openTicket,
  getTicket,
  updateTicket,
  closeTicketRecord,
  deleteTicketRecord,
  getUserOpenTicket,
  recordActivity,
  incrementStat,
} from "../store/tickets";
import { dbGet } from "../store/db";
import { generateTranscript } from "../lib/transcript";
import { logger } from "../../lib/logger";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getMergedConfig(guildId: string): Promise<any> {
  const botCfg = getTicketConfig(guildId);
  const dbCfg = await dbGet<any>("ticketConfig", guildId) ?? {};
  const merged = { ...botCfg, ...dbCfg };
  const bl = new Set([...(botCfg.blacklist ?? []), ...(dbCfg.blacklist ?? [])]);
  merged.blacklist = [...bl];
  return merged;
}

function getSupportRoleIds(cfg: any, panel?: any, categoryConfig?: any): string[] {
  const ids = new Set<string>();
  if (cfg.supportRoleId) ids.add(cfg.supportRoleId);
  if (Array.isArray(cfg.supportRoleIds)) cfg.supportRoleIds.forEach((id: string) => ids.add(id));
  if (panel && Array.isArray(panel.supportRoleIds)) panel.supportRoleIds.forEach((id: string) => ids.add(id));
  if (categoryConfig && Array.isArray(categoryConfig.supportRoleIds)) categoryConfig.supportRoleIds.forEach((id: string) => ids.add(id));
  return [...ids];
}

function isStaff(member: GuildMember, cfg: any, panel?: any): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  return getSupportRoleIds(cfg, panel).some((id) => member.roles.cache.has(id));
}

function buildActiveButtons(): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ticket:claim").setLabel("Claim").setEmoji("🗂️").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ticket:close").setLabel("Close").setEmoji("🔒").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ticket:add_user").setLabel("Add User").setEmoji("➕").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ticket:remove_user").setLabel("Remove").setEmoji("➖").setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ticket:rename").setLabel("Rename").setEmoji("✏️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ticket:delete").setLabel("Delete").setEmoji("🗑️").setStyle(ButtonStyle.Danger),
  );
  return [row1, row2];
}

function buildClosedButtons(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ticket:reopen").setLabel("Reopen").setEmoji("🔓").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("ticket:delete").setLabel("Delete").setEmoji("🗑️").setStyle(ButtonStyle.Danger),
    ),
  ];
}

function buildFeedbackButtons(channelId: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...[1, 2, 3, 4, 5].map((n) =>
        new ButtonBuilder()
          .setCustomId(`ticket:feedback:${n}:${channelId}`)
          .setLabel("⭐".repeat(n))
          .setStyle(ButtonStyle.Secondary)
      )
    ),
  ];
}

async function sendToLogChannel(
  client: Client, guildId: string, cfg: any, embed: EmbedBuilder, files?: AttachmentBuilder[]
): Promise<void> {
  if (!cfg.logChannelId) return;
  try {
    const ch = await client.channels.fetch(cfg.logChannelId) as TextChannel;
    if (ch && "send" in ch) await sendViaWebhook(client, ch, { embeds: [embed], files: files ?? [] });
  } catch { }
}

// ── Core ticket creation ──────────────────────────────────────────────────────

async function createTicket(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  panel: any,
  cfg: any,
  category?: string,
  categoryConfig?: any
): Promise<void> {
  const guild = interaction.guild!;
  const user = interaction.user;
  const guildId = guild.id;

  const num = nextTicketNumber(guildId);
  const safeCat = category ? `-${category.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12)}` : "";
  const channelName = `ticket-${num}${safeCat}`;

  const supportRoleIds = getSupportRoleIds(cfg, panel, categoryConfig);
  const parentCategoryId = categoryConfig?.categoryId ?? cfg.categoryId ?? null;

  try {
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: parentCategoryId,
      topic: `Ticket #${num}${category ? ` — ${category}` : ""} — ${user.tag}`,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        },
        {
          id: interaction.client.user!.id,
          allow: [
            PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        ...supportRoleIds.map((id) => ({
          id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        })),
      ],
    }) as TextChannel;

    const now = Date.now();
    openTicket({
      channelId: channel.id,
      guildId,
      userId: user.id,
      userTag: user.tag,
      number: num,
      panelId: panel?.id,
      category,
      createdAt: now,
      lastActivityAt: now,
      closed: false,
      hasStaffResponse: false,
    });
    setCooldown(guildId, user.id);

    const pingParts: string[] = [`<@${user.id}>`];
    if (cfg.pingRoleId) pingParts.push(`<@&${cfg.pingRoleId}>`);
    const pingMsg = await channel.send({ content: pingParts.join(" ") });

    const openMsg = categoryConfig?.openMessage?.trim() || panel?.openMessage?.trim() || cfg.openMessage?.trim() ||
      "Thanks for creating a ticket! We'll be with you as quickly as possible.\n\n" +
      "Please describe your issue in detail so our team can assist you effectively.";

    const embedTitle = panel ? `${panel.emoji ?? "🎫"} ${panel.name}${category ? ` — ${category}` : ""}` : "🎫 Support Ticket";

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(embedTitle)
      .setDescription(openMsg)
      .setFooter({ text: `Ticket #${num} • Opened by ${user.tag}` })
      .setTimestamp();

    const welcome = await channel.send({ embeds: [embed], components: buildActiveButtons() });
    await welcome.pin().catch(() => {});
    await pingMsg.delete().catch(() => {});

    await interaction.editReply({ content: `✅ Your ticket has been created: <#${channel.id}>` });
    logger.info({ userId: user.id, channelId: channel.id, num }, "Ticket created");
  } catch (err) {
    logger.error({ err }, "Failed to create ticket channel");
    await interaction.editReply({ content: "❌ Failed to create ticket. Please check the bot's permissions." });
  }
}

// ── Button handlers ───────────────────────────────────────────────────────────

async function handleCreate(interaction: ButtonInteraction): Promise<void> {
  const guild = interaction.guild!;
  const guildId = guild.id;
  const user = interaction.user;

  await interaction.deferReply({ ephemeral: true });

  const cfg = await getMergedConfig(guildId);

  if ((cfg.blacklist as string[]).includes(user.id)) {
    return interaction.editReply({ content: "❌ You are blacklisted from creating tickets." });
  }

  const cooldownMs = (cfg.cooldownMinutes ?? 0) * 60_000;
  const remaining = cooldownMs ? checkCooldown(guildId, user.id, cooldownMs) : 0;
  if (remaining > 0) {
    const secs = Math.ceil(remaining / 1000);
    const mins = Math.ceil(secs / 60);
    return interaction.editReply({
      content: `⏳ You're on cooldown. Please wait **${mins > 1 ? `${mins} minutes` : `${secs} seconds`}** before opening another ticket.`,
    });
  }

  const existing = getUserOpenTicket(guildId, user.id);
  if (existing) {
    return interaction.editReply({ content: `❌ You already have an open ticket: <#${existing.channelId}>` });
  }

  const panels = await dbGet<Record<string, any>>("ticketPanels", guildId) ?? {};
  const panel = Object.values(panels).find((p: any) => p.panelChannelId === interaction.channelId);

  const categories: any[] = panel?.categories ?? [];

  if (categories.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId("ticket:select_category")
      .setPlaceholder("Choose a category for your ticket…")
      .addOptions(
        categories.map((c: any) =>
          new StringSelectMenuOptionBuilder()
            .setValue(c.name)
            .setLabel(c.name)
            .setEmoji(c.emoji || "🎫")
        )
      );
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.editReply({ content: "Please select a category for your ticket:", components: [row] });
    return;
  }

  await createTicket(interaction, panel, cfg);
}

async function handleSelectCategory(interaction: StringSelectMenuInteraction): Promise<void> {
  const guild = interaction.guild!;
  const guildId = guild.id;
  const user = interaction.user;
  const categoryName = interaction.values[0]!;

  await interaction.deferUpdate();

  const existing = getUserOpenTicket(guildId, user.id);
  if (existing) {
    await interaction.followUp({ content: `❌ You already have an open ticket: <#${existing.channelId}>`, ephemeral: true });
    return;
  }

  const cfg = await getMergedConfig(guildId);
  const panels = await dbGet<Record<string, any>>("ticketPanels", guildId) ?? {};
  const panel = Object.values(panels).find((p: any) => p.panelChannelId === interaction.channelId);

  const categoryConfig = (panel?.categories ?? []).find((c: any) => c.name === categoryName) ?? null;

  const fakeInteraction = {
    ...interaction,
    guild,
    user,
    client: interaction.client,
    editReply: (opts: any) => interaction.editReply(opts),
    channelId: interaction.channelId,
  } as any;

  await createTicket(fakeInteraction, panel, cfg, categoryName, categoryConfig);
}

async function handleClaim(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const ticket = getTicket(interaction.channelId);
  if (!ticket) return interaction.editReply({ content: "❌ This is not a tracked ticket." });
  if (ticket.closed) return interaction.editReply({ content: "❌ This ticket is closed." });

  const cfg = await getMergedConfig(interaction.guild!.id);
  const member = interaction.member as GuildMember;
  if (!isStaff(member, cfg)) {
    return interaction.editReply({ content: "❌ Only staff can claim tickets." });
  }
  if (ticket.claimedBy) {
    return interaction.editReply({ content: `❌ Already claimed by <@${ticket.claimedBy}>.` });
  }

  updateTicket(interaction.channelId, {
    claimedBy: interaction.user.id,
    claimedByTag: interaction.user.tag,
  });
  incrementStat(interaction.guild!.id, interaction.user.id, "claimed");

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setDescription(`🗂️ Ticket claimed by <@${interaction.user.id}>.`);
  await interaction.channel?.send({ embeds: [embed] });
  await interaction.editReply({ content: "✅ You have claimed this ticket." });
}

async function handleClose(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: false });
  const channel = interaction.channel as TextChannel;
  const ticket = getTicket(channel.id);
  if (!ticket) return interaction.editReply({ content: "❌ This is not a tracked ticket." });
  if (ticket.closed) return interaction.editReply({ content: "❌ Already closed." });

  const guildId = interaction.guild!.id;
  const cfg = await getMergedConfig(guildId);
  const member = interaction.member as GuildMember;
  if (!isStaff(member, cfg) && interaction.user.id !== ticket.userId) {
    return interaction.editReply({ content: "❌ Only staff or the ticket opener can close this ticket." });
  }

  try { await channel.permissionOverwrites.edit(ticket.userId, { SendMessages: false }); } catch { }
  closeTicketRecord(channel.id);
  if (isStaff(member, cfg)) incrementStat(guildId, interaction.user.id, "closed");

  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setDescription(`🔒 Ticket closed by <@${interaction.user.id}>.\nUse **Reopen** to reopen or **Delete** to remove this channel.`)
    .setTimestamp();
  await interaction.editReply({ embeds: [embed], components: buildClosedButtons() });

  if (cfg.dmOnClose) {
    try {
      const user = await interaction.client.users.fetch(ticket.userId);
      const dmEmbed = new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle("🔒 Your Ticket Was Closed")
        .setDescription(`Your ticket **#${ticket.number}** was closed by <@${interaction.user.id}>.`)
        .setTimestamp();
      await user.send({ embeds: [dmEmbed] }).catch(() => {});
    } catch { }
  }

  if (cfg.feedbackEnabled && !ticket.feedbackSent) {
    updateTicket(channel.id, { feedbackSent: true });
    try {
      const user = await interaction.client.users.fetch(ticket.userId);
      const fbEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("⭐ How did we do?")
        .setDescription(`Please rate the support you received for ticket **#${ticket.number}**:`);
      await user.send({ embeds: [fbEmbed], components: buildFeedbackButtons(channel.id) }).catch(() => {});
    } catch { }
  }

  const transcript = await generateTranscript(channel, ticket).catch(
    () => new AttachmentBuilder(Buffer.from("No data."), { name: "transcript.txt" })
  );
  const logEmbed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle(`🔒 Ticket Closed — #${channel.name}`)
    .addFields(
      { name: "User", value: `<@${ticket.userId}> (${ticket.userTag})`, inline: true },
      { name: "Closed by", value: `<@${interaction.user.id}>`, inline: true },
      { name: "Claimed by", value: ticket.claimedByTag ?? "Unclaimed", inline: true }
    )
    .setTimestamp();
  await sendToLogChannel(interaction.client, guildId, cfg, logEmbed, [transcript]);
}

async function handleReopen(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: false });
  const channel = interaction.channel as TextChannel;
  const ticket = getTicket(channel.id);
  if (!ticket) return interaction.editReply({ content: "❌ This is not a tracked ticket." });
  if (!ticket.closed) return interaction.editReply({ content: "❌ This ticket is already open." });

  const cfg = await getMergedConfig(interaction.guild!.id);
  const member = interaction.member as GuildMember;
  if (!isStaff(member, cfg) && interaction.user.id !== ticket.userId) {
    return interaction.editReply({ content: "❌ Only staff or the ticket opener can reopen this ticket." });
  }

  try {
    await channel.permissionOverwrites.edit(ticket.userId, {
      ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
    });
  } catch { }

  updateTicket(channel.id, { closed: false, alertedNoResponse: false, alertedWaiting: false });

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setDescription(`🔓 Ticket reopened by <@${interaction.user.id}>.`)
    .setTimestamp();
  await interaction.editReply({ embeds: [embed], components: buildActiveButtons() });
}

async function handleDelete(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.channel as TextChannel;
  const ticket = getTicket(channel.id);
  const guildId = interaction.guild!.id;
  const cfg = await getMergedConfig(guildId);
  const member = interaction.member as GuildMember;

  if (!isStaff(member, cfg)) {
    return interaction.editReply({ content: "❌ Only staff can delete ticket channels." });
  }

  const transcript = ticket
    ? await generateTranscript(channel, ticket).catch(
        () => new AttachmentBuilder(Buffer.from("No data."), { name: "transcript.txt" })
      )
    : new AttachmentBuilder(Buffer.from("No ticket data."), { name: "transcript.txt" });

  const logEmbed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle(`🗑️ Ticket Deleted — #${channel.name}`)
    .addFields(
      { name: "User", value: ticket ? `<@${ticket.userId}> (${ticket.userTag})` : "Unknown", inline: true },
      { name: "Deleted by", value: `<@${interaction.user.id}>`, inline: true },
      { name: "Claimed by", value: ticket?.claimedByTag ?? "Unclaimed", inline: true }
    )
    .setTimestamp();
  await sendToLogChannel(interaction.client, guildId, cfg, logEmbed, [transcript]);

  if (ticket) deleteTicketRecord(channel.id);
  await interaction.editReply({ content: "🗑️ Deleting ticket…" });
  setTimeout(() => channel.delete().catch(() => {}), 1500);
}

async function handleAddUser(interaction: ButtonInteraction): Promise<void> {
  const ticket = getTicket(interaction.channelId);
  if (!ticket) return interaction.reply({ content: "❌ Not a ticket channel.", ephemeral: true });
  const cfg = await getMergedConfig(interaction.guild!.id);
  const member = interaction.member as GuildMember;
  if (!isStaff(member, cfg) && interaction.user.id !== ticket.userId) {
    return interaction.reply({ content: "❌ Only staff or the ticket opener can add users.", ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId("ticket:modal_add_user")
    .setTitle("Add User to Ticket");
  const input = new TextInputBuilder()
    .setCustomId("user_input")
    .setLabel("User ID or @mention text")
    .setPlaceholder("e.g. 123456789012345678")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

async function handleRemoveUser(interaction: ButtonInteraction): Promise<void> {
  const ticket = getTicket(interaction.channelId);
  if (!ticket) return interaction.reply({ content: "❌ Not a ticket channel.", ephemeral: true });
  const cfg = await getMergedConfig(interaction.guild!.id);
  const member = interaction.member as GuildMember;
  if (!isStaff(member, cfg)) {
    return interaction.reply({ content: "❌ Only staff can remove users.", ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId("ticket:modal_remove_user")
    .setTitle("Remove User from Ticket");
  const input = new TextInputBuilder()
    .setCustomId("user_input")
    .setLabel("User ID to remove")
    .setPlaceholder("e.g. 123456789012345678")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

async function handleRename(interaction: ButtonInteraction): Promise<void> {
  const ticket = getTicket(interaction.channelId);
  if (!ticket) return interaction.reply({ content: "❌ Not a ticket channel.", ephemeral: true });
  const cfg = await getMergedConfig(interaction.guild!.id);
  const member = interaction.member as GuildMember;
  if (!isStaff(member, cfg) && interaction.user.id !== ticket.userId) {
    return interaction.reply({ content: "❌ Only staff or the ticket opener can rename this ticket.", ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId("ticket:modal_rename")
    .setTitle("Rename Ticket Channel");
  const input = new TextInputBuilder()
    .setCustomId("name_input")
    .setLabel("New channel name")
    .setPlaceholder("e.g. billing-inquiry")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(80)
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const { customId } = interaction;

  if (customId === "ticket:modal_add_user") {
    await interaction.deferReply({ ephemeral: true });
    const raw = interaction.fields.getTextInputValue("user_input").trim();
    const userId = raw.replace(/[^0-9]/g, "");
    if (!/^\d{17,20}$/.test(userId)) {
      return interaction.editReply({ content: "❌ Invalid user ID. Enter a 17-20 digit Discord user ID." });
    }
    const ticket = getTicket(interaction.channelId);
    if (!ticket) return interaction.editReply({ content: "❌ Not a ticket channel." });
    if (userId === ticket.userId) return interaction.editReply({ content: "❌ That user is already in this ticket." });
    try {
      await (interaction.channel as TextChannel).permissionOverwrites.edit(userId, {
        ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
      });
      await interaction.editReply({ content: `✅ Added <@${userId}> to the ticket.` });
    } catch {
      await interaction.editReply({ content: "❌ Failed to add user. Make sure the user ID is correct." });
    }
    return;
  }

  if (customId === "ticket:modal_remove_user") {
    await interaction.deferReply({ ephemeral: true });
    const raw = interaction.fields.getTextInputValue("user_input").trim();
    const userId = raw.replace(/[^0-9]/g, "");
    if (!/^\d{17,20}$/.test(userId)) {
      return interaction.editReply({ content: "❌ Invalid user ID." });
    }
    const ticket = getTicket(interaction.channelId);
    if (!ticket) return interaction.editReply({ content: "❌ Not a ticket channel." });
    if (userId === ticket.userId) return interaction.editReply({ content: "❌ You cannot remove the ticket opener." });
    try {
      await (interaction.channel as TextChannel).permissionOverwrites.edit(userId, { ViewChannel: false, SendMessages: false });
      await interaction.editReply({ content: `✅ Removed <@${userId}> from the ticket.` });
    } catch {
      await interaction.editReply({ content: "❌ Failed to remove user." });
    }
    return;
  }

  if (customId === "ticket:modal_rename") {
    await interaction.deferReply({ ephemeral: true });
    const raw = interaction.fields.getTextInputValue("name_input").trim();
    const name = raw.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 80);
    if (!name) return interaction.editReply({ content: "❌ Invalid channel name." });
    try {
      await (interaction.channel as TextChannel).setName(name);
      await interaction.editReply({ content: `✅ Channel renamed to **${name}**.` });
    } catch {
      await interaction.editReply({ content: "❌ Failed to rename channel. Check bot permissions." });
    }
    return;
  }
}

async function handleFeedback(
  interaction: ButtonInteraction,
  rating: number,
  channelId: string
): Promise<void> {
  await interaction.deferUpdate();
  const ticket = getTicket(channelId);
  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("⭐ Thanks for your feedback!")
    .setDescription(`You rated the support **${"⭐".repeat(rating)}** (${rating}/5). We appreciate your feedback!`);
  await interaction.editReply({ embeds: [embed], components: [] });

  if (ticket) {
    logger.info({ channelId, userId: interaction.user.id, rating }, "Ticket feedback received");
  }
}

// ── Registration ──────────────────────────────────────────────────────────────

export function registerTicketButtons(client: Client) {
  client.on("interactionCreate", async (interaction: Interaction) => {
    try {
      // ── String select menu ──────────────────────────────────────────────────
      if (interaction.isStringSelectMenu()) {
        if (interaction.customId === "ticket:select_category") {
          await handleSelectCategory(interaction as StringSelectMenuInteraction);
        }
        return;
      }

      // ── Modal submit ────────────────────────────────────────────────────────
      if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith("ticket:modal_")) {
          await handleModalSubmit(interaction as ModalSubmitInteraction);
        }
        return;
      }

      // ── Buttons ─────────────────────────────────────────────────────────────
      if (!interaction.isButton()) return;
      if (!interaction.customId.startsWith("ticket:")) return;

      const btn = interaction as ButtonInteraction;
      const { customId } = btn;

      if (customId.startsWith("ticket:feedback:")) {
        const parts = customId.split(":");
        const rating = parseInt(parts[2]!);
        const channelId = parts[3]!;
        await handleFeedback(btn, rating, channelId);
        return;
      }

      if (!btn.guild && !customId.startsWith("ticket:feedback:")) return;

      if (customId === "ticket:create") await handleCreate(btn);
      else if (customId === "ticket:claim") await handleClaim(btn);
      else if (customId === "ticket:close") await handleClose(btn);
      else if (customId === "ticket:reopen") await handleReopen(btn);
      else if (customId === "ticket:delete") await handleDelete(btn);
      else if (customId === "ticket:add_user") await handleAddUser(btn);
      else if (customId === "ticket:remove_user") await handleRemoveUser(btn);
      else if (customId === "ticket:rename") await handleRename(btn);
    } catch (err) {
      logger.error({ err }, "Ticket interaction handler failed");
      const i = interaction as any;
      if (i.replied === false && i.deferred === false) {
        await i.reply({ content: "❌ Something went wrong.", ephemeral: true }).catch(() => {});
      }
    }
  });
}
