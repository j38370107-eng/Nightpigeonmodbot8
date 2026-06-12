import { Client, TextChannel, EmbedBuilder } from "discord.js";
import { sendViaWebhook } from "../lib/webhookSender";
import {
  getAllOpenTickets,
  closeTicketRecord,
  updateTicket,
  getTicket,
  recordActivity,
  incrementStat,
} from "../store/tickets";
import { dbGet } from "../store/db";
import { generateTranscript } from "../lib/transcript";
import { logger } from "../../lib/logger";

async function getMergedConfig(guildId: string): Promise<any> {
  const dbCfg = await dbGet<any>("ticketConfig", guildId) ?? {};
  return dbCfg;
}

async function sendToLogChannel(client: Client, guildId: string, cfg: any, embed: EmbedBuilder): Promise<void> {
  const logChannelId = cfg.logChannelId;
  if (!logChannelId) return;
  try {
    const ch = await client.channels.fetch(logChannelId) as TextChannel;
    if (ch && "send" in ch) await sendViaWebhook(client, ch, { embeds: [embed] });
  } catch { }
}

async function runAutoClose(client: Client): Promise<void> {
  const openTickets = getAllOpenTickets();
  const now = Date.now();

  for (const ticket of openTickets) {
    if (!ticket.guildId) continue;
    try {
      const cfg = await getMergedConfig(ticket.guildId);
      const autoCloseHours = Number(cfg.autoCloseHours ?? 0);
      if (!autoCloseHours) continue;

      const inactiveMs = now - (ticket.lastActivityAt || ticket.createdAt);
      if (inactiveMs < autoCloseHours * 3_600_000) continue;

      const channel = await client.channels.fetch(ticket.channelId).catch(() => null) as TextChannel | null;
      if (!channel || !("send" in channel)) {
        closeTicketRecord(ticket.channelId);
        continue;
      }

      closeTicketRecord(ticket.channelId);

      const embed = new EmbedBuilder()
        .setColor(0xe67e22)
        .setDescription(`🔒 Ticket auto-closed due to **${autoCloseHours}h** of inactivity.`)
        .setTimestamp();

      await channel.send({ embeds: [embed] }).catch(() => {});

      if (cfg.dmOnClose) {
        try {
          const user = await client.users.fetch(ticket.userId);
          const dmEmbed = new EmbedBuilder()
            .setColor(0xe67e22)
            .setTitle("🔒 Your Ticket Was Closed")
            .setDescription(`Your ticket **#${ticket.number}** in **${channel.guild?.name ?? "the server"}** was auto-closed after ${autoCloseHours}h of inactivity.`)
            .setTimestamp();
          await user.send({ embeds: [dmEmbed] }).catch(() => {});
        } catch { }
      }

      const logEmbed = new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle("🔒 Ticket Auto-Closed")
        .addFields(
          { name: "Ticket", value: `#${ticket.number} — ${channel.name}`, inline: true },
          { name: "User", value: `<@${ticket.userId}>`, inline: true },
          { name: "Reason", value: `Inactive for ${autoCloseHours}h`, inline: true }
        )
        .setTimestamp();
      await sendToLogChannel(client, ticket.guildId, cfg, logEmbed);

      logger.info({ channelId: ticket.channelId }, "Ticket auto-closed due to inactivity");
    } catch (err) {
      logger.error({ err, channelId: ticket.channelId }, "Auto-close error");
    }
  }
}

async function runAlerts(client: Client): Promise<void> {
  const openTickets = getAllOpenTickets();
  const now = Date.now();

  for (const ticket of openTickets) {
    if (!ticket.guildId) continue;
    try {
      const cfg = await getMergedConfig(ticket.guildId);
      const noResponseHours = Number(cfg.alertNoResponseHours ?? 0);
      const waitingHours = Number(cfg.alertWaitingHours ?? 0);
      const logChannelId = cfg.logChannelId;
      if (!logChannelId) continue;

      if (noResponseHours && !ticket.hasStaffResponse && !ticket.alertedNoResponse) {
        const ageMs = now - ticket.createdAt;
        if (ageMs >= noResponseHours * 3_600_000) {
          updateTicket(ticket.channelId, { alertedNoResponse: true });
          const embed = new EmbedBuilder()
            .setColor(0xf39c12)
            .setTitle("⚠️ Ticket Has No Staff Response")
            .addFields(
              { name: "Ticket", value: `<#${ticket.channelId}>`, inline: true },
              { name: "User", value: `<@${ticket.userId}>`, inline: true },
              { name: "Opened", value: `<t:${Math.floor(ticket.createdAt / 1000)}:R>`, inline: true }
            )
            .setDescription("This ticket has had no staff response yet.")
            .setTimestamp();
          await sendToLogChannel(client, ticket.guildId, cfg, embed);
        }
      }

      if (waitingHours && !ticket.alertedWaiting) {
        const ageMs = now - ticket.createdAt;
        if (ageMs >= waitingHours * 3_600_000) {
          updateTicket(ticket.channelId, { alertedWaiting: true });
          const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("🚨 Ticket Waiting Too Long")
            .addFields(
              { name: "Ticket", value: `<#${ticket.channelId}>`, inline: true },
              { name: "User", value: `<@${ticket.userId}>`, inline: true },
              { name: "Opened", value: `<t:${Math.floor(ticket.createdAt / 1000)}:R>`, inline: true }
            )
            .setDescription(`This ticket has been open for over ${waitingHours}h.`)
            .setTimestamp();
          await sendToLogChannel(client, ticket.guildId, cfg, embed);
        }
      }
    } catch (err) {
      logger.error({ err, channelId: ticket.channelId }, "Alert check error");
    }
  }
}

export function registerStaffResponseDetector(client: Client): void {
  client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;
    const ticket = getTicket(message.channel.id);
    if (!ticket || ticket.closed || ticket.hasStaffResponse) return;
    if (message.author.id === ticket.userId) {
      recordActivity(message.channel.id);
      return;
    }

    try {
      const cfg = await getMergedConfig(message.guild.id);
      const supportRoleIds: string[] = [];
      if (cfg.supportRoleId) supportRoleIds.push(cfg.supportRoleId);
      if (Array.isArray(cfg.supportRoleIds)) supportRoleIds.push(...cfg.supportRoleIds);

      const member = message.member;
      if (!member) return;

      const isStaff =
        member.permissions.has(8n) ||
        supportRoleIds.some((id) => member.roles.cache.has(id));

      if (!isStaff) {
        recordActivity(message.channel.id);
        return;
      }

      updateTicket(message.channel.id, { hasStaffResponse: true });
      recordActivity(message.channel.id);

      if (cfg.dmOnStaffResponse) {
        try {
          const user = await client.users.fetch(ticket.userId);
          const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("💬 Staff Responded to Your Ticket")
            .setDescription(`A staff member has responded to your ticket **#${ticket.number}**.\n\nHead back to <#${ticket.channelId}> to continue the conversation.`)
            .setTimestamp();
          await user.send({ embeds: [embed] }).catch(() => {});
        } catch { }
      }
    } catch { }
  });
}

export function startTicketScheduler(client: Client): void {
  const INTERVAL_MS = 5 * 60 * 1000;

  setInterval(async () => {
    await runAutoClose(client).catch((err) =>
      logger.error({ err }, "Auto-close scheduler error")
    );
    await runAlerts(client).catch((err) =>
      logger.error({ err }, "Alert scheduler error")
    );
  }, INTERVAL_MS);

  logger.info("Ticket scheduler started (5-min interval)");
}
