import { sendViaWebhook } from "../lib/webhookSender";
import {
  Message,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  ChannelType,
  AttachmentBuilder,
} from "discord.js";
import type { Command } from "./types";
import {
  getTicket,
  getTicketConfig,
  updateTicket,
  closeTicketRecord,
  deleteTicketRecord,
  getUserOpenTicket,
  getStaffStats,
  incrementStat,
} from "../store/tickets";
import { dbGet } from "../store/db";
import { generateTranscript } from "../lib/transcript";

async function getMergedConfig(guildId: string) {
  const dbCfg = await dbGet<any>("ticketConfig", guildId) ?? {};
  const botCfg = getTicketConfig(guildId);
  return { ...botCfg, ...dbCfg };
}

function getSupportRoleIds(cfg: any): string[] {
  const ids = new Set<string>();
  if (cfg.supportRoleId) ids.add(cfg.supportRoleId);
  if (Array.isArray(cfg.supportRoleIds)) cfg.supportRoleIds.forEach((id: string) => ids.add(id));
  return [...ids];
}

function isStaffMember(message: Message, cfg: any): boolean {
  const member = message.member;
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  const supportRoles = getSupportRoleIds(cfg);
  return supportRoles.some((id) => member.roles.cache.has(id));
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

// ── >setup ────────────────────────────────────────────────────────────────────
export const ticketSetupCommand: Command = {
  name: "setup",
  aliases: ["tsetup"],
  description: "Post a ticket panel to this channel",
  usage: "",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(message: Message) {
    if (!message.guild) return;
    const guildId = message.guild.id;

    const panels = await dbGet<Record<string, any>>("ticketPanels", guildId) ?? {};
    const panel = Object.values(panels).find((p: any) => p.panelChannelId === message.channel.id)
      ?? Object.values(panels)[0];

    const name = panel?.name ?? "Support Tickets";
    const emoji = panel?.emoji ?? "🎫";
    const description = panel?.description?.trim()
      || "Need help? Click the button below to open a support ticket.\n\nPlease be ready to describe your issue so our team can assist you quickly.";

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${emoji} ${name}`)
      .setDescription(description)
      .setFooter({ text: "One ticket per user • Do not abuse the ticket system" });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ticket:create").setLabel("Create Ticket").setEmoji("🎫").setStyle(ButtonStyle.Primary)
    );

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.delete().catch(() => {});
  },
};

// ── >close ────────────────────────────────────────────────────────────────────
export const ticketCloseCommand: Command = {
  name: "close",
  aliases: ["tclose"],
  description: "Close the current ticket",
  usage: "",
  requiredPermissions: [],

  async execute(message: Message) {
    if (!message.guild) return;
    const ticket = getTicket(message.channel.id);
    if (!ticket) return message.reply("❌ This command can only be used inside a ticket channel.");
    if (ticket.closed) return message.reply("❌ This ticket is already closed.");

    const cfg = await getMergedConfig(message.guild.id);
    const isStaff = isStaffMember(message, cfg);
    if (!isStaff && message.author.id !== ticket.userId) {
      return message.reply("❌ You don't have permission to close this ticket.");
    }

    const channel = message.channel as TextChannel;
    try {
      await channel.permissionOverwrites.edit(ticket.userId, { SendMessages: false });
    } catch { }

    closeTicketRecord(channel.id);
    if (isStaff) incrementStat(message.guild.id, message.author.id, "closed");

    const embed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setDescription(`🔒 Ticket closed by <@${message.author.id}>.\nUse **Reopen** to reopen or **Delete** to remove this channel.`)
      .setTimestamp();

    await channel.send({ embeds: [embed], components: buildClosedButtons() });
    await message.delete().catch(() => {});

    if (cfg.dmOnClose) {
      try {
        const user = await message.client.users.fetch(ticket.userId);
        const dmEmbed = new EmbedBuilder()
          .setColor(0xe67e22)
          .setTitle("🔒 Your Ticket Was Closed")
          .setDescription(`Your ticket **#${ticket.number}** was closed by <@${message.author.id}>.`)
          .setTimestamp();
        await user.send({ embeds: [dmEmbed] }).catch(() => {});
      } catch { }
    }

    if (cfg.feedbackEnabled && !ticket.feedbackSent) {
      updateTicket(channel.id, { feedbackSent: true });
      try {
        const user = await message.client.users.fetch(ticket.userId);
        const fbEmbed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("⭐ How did we do?")
          .setDescription(`Please rate the support you received for ticket **#${ticket.number}**:`);
        const fbRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          ...[1, 2, 3, 4, 5].map((n) =>
            new ButtonBuilder()
              .setCustomId(`ticket:feedback:${n}:${channel.id}`)
              .setLabel("⭐".repeat(n))
              .setStyle(ButtonStyle.Secondary)
          )
        );
        await user.send({ embeds: [fbEmbed], components: [fbRow] }).catch(() => {});
      } catch { }
    }
  },
};

// ── >delete ───────────────────────────────────────────────────────────────────
export const ticketDeleteCommand: Command = {
  name: "delete",
  aliases: ["tdelete"],
  description: "Permanently delete this ticket channel",
  usage: "",
  requiredPermissions: [],

  async execute(message: Message) {
    if (!message.guild) return;
    const ticket = getTicket(message.channel.id);
    if (!ticket) return message.reply("❌ This command can only be used inside a ticket channel.");

    const cfg = await getMergedConfig(message.guild.id);
    if (!isStaffMember(message, cfg)) {
      return message.reply("❌ Only staff can delete ticket channels.");
    }

    await message.channel.send("🗑️ Deleting ticket in 3 seconds…");

    const transcript = await generateTranscript(message.channel as TextChannel, ticket).catch(
      () => new AttachmentBuilder(Buffer.from("No transcript available."), { name: "transcript.txt" })
    );

    const logChannelId = cfg.logChannelId;
    if (logChannelId) {
      try {
        const logCh = await message.client.channels.fetch(logChannelId) as TextChannel;
        if (logCh && "send" in logCh) {
          const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle(`🗑️ Ticket Deleted — #${(message.channel as TextChannel).name}`)
            .addFields(
              { name: "User", value: `<@${ticket.userId}> (${ticket.userTag})`, inline: true },
              { name: "Deleted by", value: `<@${message.author.id}>`, inline: true },
              { name: "Claimed by", value: ticket.claimedByTag ?? "Unclaimed", inline: true }
            )
            .setTimestamp();
          await sendViaWebhook(message.client, logCh, { embeds: [embed], files: [transcript] });
        }
      } catch { }
    }

    deleteTicketRecord(message.channel.id);
    setTimeout(() => (message.channel as TextChannel).delete().catch(() => {}), 3000);
  },
};

// ── >reopen ───────────────────────────────────────────────────────────────────
export const ticketReopenCommand: Command = {
  name: "reopen",
  aliases: ["treopen"],
  description: "Reopen a closed ticket",
  usage: "",
  requiredPermissions: [],

  async execute(message: Message) {
    if (!message.guild) return;
    const ticket = getTicket(message.channel.id);
    if (!ticket) return message.reply("❌ This command can only be used inside a ticket channel.");
    if (!ticket.closed) return message.reply("❌ This ticket is not closed.");

    const cfg = await getMergedConfig(message.guild.id);
    const isStaff = isStaffMember(message, cfg);
    if (!isStaff && message.author.id !== ticket.userId) {
      return message.reply("❌ You don't have permission to reopen this ticket.");
    }

    const channel = message.channel as TextChannel;
    try {
      await channel.permissionOverwrites.edit(ticket.userId, {
        ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
      });
    } catch { }

    updateTicket(channel.id, { closed: false, alertedNoResponse: false, alertedWaiting: false });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setDescription(`🔓 Ticket reopened by <@${message.author.id}>.`)
      .setTimestamp();

    await channel.send({ embeds: [embed], components: buildActiveButtons() });
    await message.delete().catch(() => {});
  },
};

// ── >add @user ────────────────────────────────────────────────────────────────
export const ticketAddCommand: Command = {
  name: "add",
  aliases: ["tadd"],
  description: "Add a user to this ticket",
  usage: "@user",
  requiredPermissions: [],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const ticket = getTicket(message.channel.id);
    if (!ticket) return message.reply("❌ This command can only be used inside a ticket channel.");

    const cfg = await getMergedConfig(message.guild.id);
    const isStaff = isStaffMember(message, cfg);
    if (!isStaff && message.author.id !== ticket.userId) {
      return message.reply("❌ Only staff or the ticket opener can add users.");
    }

    const target = message.mentions.users.first() ?? (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : null);
    if (!target) return message.reply("❌ Please mention a user or provide their ID.");

    const channel = message.channel as TextChannel;
    await channel.permissionOverwrites.edit(target.id, {
      ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
    });

    await message.reply(`✅ Added <@${target.id}> to the ticket.`);
  },
};

// ── >remove @user ─────────────────────────────────────────────────────────────
export const ticketRemoveCommand: Command = {
  name: "remove",
  aliases: ["tremove"],
  description: "Remove a user from this ticket",
  usage: "@user",
  requiredPermissions: [],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const ticket = getTicket(message.channel.id);
    if (!ticket) return message.reply("❌ This command can only be used inside a ticket channel.");

    const cfg = await getMergedConfig(message.guild.id);
    if (!isStaffMember(message, cfg)) {
      return message.reply("❌ Only staff can remove users from tickets.");
    }

    const target = message.mentions.users.first() ?? (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : null);
    if (!target) return message.reply("❌ Please mention a user or provide their ID.");
    if (target.id === ticket.userId) return message.reply("❌ You cannot remove the ticket opener.");

    const channel = message.channel as TextChannel;
    await channel.permissionOverwrites.edit(target.id, { ViewChannel: false });

    await message.reply(`✅ Removed <@${target.id}> from the ticket.`);
  },
};

// ── >claim ────────────────────────────────────────────────────────────────────
export const ticketClaimCommand: Command = {
  name: "claim",
  aliases: ["tclaim"],
  description: "Claim this ticket as the handling staff member",
  usage: "",
  requiredPermissions: [],

  async execute(message: Message) {
    if (!message.guild) return;
    const ticket = getTicket(message.channel.id);
    if (!ticket) return message.reply("❌ This command can only be used inside a ticket channel.");
    if (ticket.closed) return message.reply("❌ This ticket is closed.");

    const cfg = await getMergedConfig(message.guild.id);
    if (!isStaffMember(message, cfg)) {
      return message.reply("❌ Only staff can claim tickets.");
    }
    if (ticket.claimedBy) {
      return message.reply(`❌ This ticket is already claimed by <@${ticket.claimedBy}>.`);
    }

    updateTicket(message.channel.id, {
      claimedBy: message.author.id,
      claimedByTag: message.author.tag,
    });
    incrementStat(message.guild.id, message.author.id, "claimed");

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setDescription(`🗂️ Ticket claimed by <@${message.author.id}>.`);
    await message.channel.send({ embeds: [embed] });
    await message.delete().catch(() => {});
  },
};

// ── >transcript ───────────────────────────────────────────────────────────────
export const ticketTranscriptCommand: Command = {
  name: "transcript",
  aliases: ["ttranscript"],
  description: "Generate a transcript of this ticket",
  usage: "",
  requiredPermissions: [],

  async execute(message: Message) {
    if (!message.guild) return;
    const ticket = getTicket(message.channel.id);
    if (!ticket) return message.reply("❌ This command can only be used inside a ticket channel.");

    const cfg = await getMergedConfig(message.guild.id);
    if (!isStaffMember(message, cfg) && message.author.id !== ticket.userId) {
      return message.reply("❌ Only staff or the ticket opener can generate transcripts.");
    }

    const channel = message.channel as TextChannel;
    const transcript = await generateTranscript(channel, ticket);
    await channel.send({ content: `📄 Transcript generated by <@${message.author.id}>`, files: [transcript] });
    if (message.guild) incrementStat(message.guild.id, message.author.id, "transcripts");
  },
};

// ── >stats ────────────────────────────────────────────────────────────────────
export const ticketStatsCommand: Command = {
  name: "stats",
  aliases: ["tstats", "ticketstats"],
  description: "View ticket handling stats for staff",
  usage: "",
  requiredPermissions: [],

  async execute(message: Message) {
    if (!message.guild) return;
    const cfg = await getMergedConfig(message.guild.id);
    if (!isStaffMember(message, cfg)) {
      return message.reply("❌ Only staff can view ticket stats.");
    }

    const stats = getStaffStats(message.guild.id);
    const entries = Object.entries(stats);

    if (entries.length === 0) {
      return message.reply("📊 No ticket stats recorded yet.");
    }

    const lines = await Promise.all(
      entries
        .sort((a, b) => (b[1].closed + b[1].claimed) - (a[1].closed + a[1].claimed))
        .map(async ([userId, s]) => {
          try {
            const user = await message.client.users.fetch(userId);
            return `**${user.tag}** — Claimed: ${s.claimed} | Closed: ${s.closed} | Transcripts: ${s.transcripts}`;
          } catch {
            return `**${userId}** — Claimed: ${s.claimed} | Closed: ${s.closed} | Transcripts: ${s.transcripts}`;
          }
        })
    );

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("📊 Ticket Staff Stats")
      .setDescription(lines.join("\n"))
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  },
};
