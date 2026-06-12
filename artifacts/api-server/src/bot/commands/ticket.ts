import {
  Message,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  ChannelType,
} from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import {
  getTicketConfig,
  updateTicketConfig,
  blacklistUser,
  unblacklistUser,
} from "../store/tickets";

function buildPanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🎫 Support Tickets")
    .setDescription(
      "Need help? Click the button below to open a support ticket.\n\n" +
      "Please be ready to describe your issue in detail so our team can assist you quickly."
    )
    .setFooter({ text: "One ticket per user • Do not abuse the ticket system" });
}

function buildPanelRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket:create")
      .setLabel("Create Ticket")
      .setEmoji("🎫")
      .setStyle(ButtonStyle.Primary)
  );
}

export const ticketCommand: Command = {
  name: "ticket",
  // This command is disabled — ticket panels are created and managed from the dashboard only.
  aliases: ["tickets"],
  description: "Manage the ticket system",
  usage: "setup | config category <id> | config logs #ch | config pingrole @role | config supportrole @role | status",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const baseUrl =
      process.env["DASHBOARD_URL"] ?? "https://utilitypulse-dashboard-pzu9.onrender.com";
    const dashboardUrl = `${baseUrl}/dashboard/${message.guild.id}`;

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("🎫 Ticket Settings — Use the Dashboard")
          .setDescription(
            `Ticket panels and settings are now managed through the **web dashboard**.\n\n[**Open Dashboard →**](${dashboardUrl})\n\`${dashboardUrl}\``,
          )
          .addFields({
            name: "What you can configure there",
            value: [
              "🎫 Create & post ticket panels",
              "📂 Set the ticket category",
              "📋 Set the log channel",
              "🔔 Set the ping role",
              "🛡️ Set the support role",
              "🚫 Manage the ticket blacklist",
              "✉️ Customize the open message",
            ].join("\n"),
          })
          .setFooter({ text: "You must be a server admin to access the dashboard" })
          .setTimestamp(),
      ],
    });
    const guildId = message.guild.id;
    const sub = args[0]?.toLowerCase();

    // ── setup ─────────────────────────────────────────────────────────────────
    if (sub === "setup") {
      const embed = buildPanelEmbed();
      const row = buildPanelRow();
      await message.channel.send({ embeds: [embed], components: [row] });
      updateTicketConfig(guildId, { panelChannelId: message.channel.id });
      return message.reply("✅ Ticket panel sent! Users can now click the button to create a ticket.");
    }

    // ── config ────────────────────────────────────────────────────────────────
    if (sub === "config") {
      const key = args[1]?.toLowerCase();

      if (key === "category") {
        const id = args[2];
        if (!id) return message.reply(usageErr(message, ticketCommand, "Provide a category ID"));
        const cat = message.guild.channels.cache.get(id);
        if (!cat || cat.type !== ChannelType.GuildCategory) {
          return message.reply("❌ That is not a valid category ID.");
        }
        updateTicketConfig(guildId, { categoryId: id });
        return message.reply(`✅ Ticket category set to **${cat.name}**.`);
      }

      if (key === "logs") {
        const channel = message.mentions.channels.first() ?? (args[2] ? message.guild.channels.cache.get(args[2]) : null);
        if (!channel || !("send" in channel)) return message.reply(usageErr(message, ticketCommand, "Mention a valid text channel"));
        updateTicketConfig(guildId, { logChannelId: channel.id });
        return message.reply(`✅ Ticket logs will be sent to <#${channel.id}>.`);
      }

      if (key === "pingrole") {
        const role = message.mentions.roles.first() ?? (args[2] ? message.guild.roles.cache.get(args[2]) : null);
        if (!role) return message.reply(usageErr(message, ticketCommand, "Mention a valid role"));
        updateTicketConfig(guildId, { pingRoleId: role.id });
        return message.reply(`✅ Ticket ping role set to <@&${role.id}>.`);
      }

      if (key === "supportrole") {
        const role = message.mentions.roles.first() ?? (args[2] ? message.guild.roles.cache.get(args[2]) : null);
        if (!role) return message.reply(usageErr(message, ticketCommand, "Mention a valid role or provide a role ID"));
        updateTicketConfig(guildId, { supportRoleId: role.id });
        return message.reply(`✅ Support role set to <@&${role.id}>. Members with this role can now see and reply in all new tickets.`);
      }

      if (key === "removesupportrole") {
        updateTicketConfig(guildId, { supportRoleId: undefined });
        return message.reply("✅ Support role removed.");
      }

      return message.reply(usageErr(message, ticketCommand, "Invalid config key — use category, logs, pingrole, or supportrole"));
    }

    // ── status ────────────────────────────────────────────────────────────────
    const cfg = getTicketConfig(guildId);
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🎫 Ticket System Config")
      .addFields(
        { name: "Category", value: cfg.categoryId ? `<#${cfg.categoryId}>` : "Not set", inline: true },
        { name: "Log Channel", value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : "Not set", inline: true },
        { name: "Ping Role", value: cfg.pingRoleId ? `<@&${cfg.pingRoleId}>` : "Not set", inline: true },
        { name: "Support Role", value: cfg.supportRoleId ? `<@&${cfg.supportRoleId}>` : "Not set", inline: true },
        { name: `Blacklist (${cfg.blacklist.length})`, value: cfg.blacklist.length ? cfg.blacklist.map((id) => `<@${id}>`).join(", ") : "None" }
      )
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  },
};

// ── Blacklist commands ────────────────────────────────────────────────────────

export const ticketBlacklistCommand: Command = {
  name: "tblacklist",
  aliases: ["ticketblacklist", "tblist"],
  description: "Blacklist a user from creating tickets",
  usage: "@user",
  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const target = message.mentions.users.first() ?? (args[0] ? { id: args[0] } : null);
    if (!target) return message.reply(usageErr(message, ticketBlacklistCommand, "Mention a user or provide their ID"));
    blacklistUser(message.guild.id, target.id);
    return message.reply(`✅ <@${target.id}> has been blacklisted from creating tickets.`);
  },
};

export const ticketUnblacklistCommand: Command = {
  name: "tunblacklist",
  aliases: ["ticketunblacklist", "tbunlist"],
  description: "Remove a user from the ticket blacklist",
  usage: "@user",
  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const target = message.mentions.users.first() ?? (args[0] ? { id: args[0] } : null);
    if (!target) return message.reply(usageErr(message, ticketUnblacklistCommand, "Mention a user or provide their ID"));
    const removed = unblacklistUser(message.guild.id, target.id);
    return message.reply(
      removed
        ? `✅ <@${target.id}> removed from the ticket blacklist.`
        : `❌ <@${target.id}> is not blacklisted.`
    );
  },
};
