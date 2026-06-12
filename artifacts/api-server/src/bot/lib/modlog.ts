import { Client, EmbedBuilder, TextChannel } from "discord.js";
import { getLogChannel } from "../store/modlog";
import { logger } from "../../lib/logger";
import { sendViaWebhook } from "./webhookSender";

export interface ModLogEntry {
  action: string;
  executor: { tag: string; id: string };
  target?: { tag: string; id: string };
  channel?: { name: string; id: string };
  reason?: string;
  color?: number;
  caseId?: string;
}

export async function sendModLog(client: Client, guildId: string, entry: ModLogEntry) {
  const channelId = getLogChannel(guildId);
  if (!channelId) {
    logger.debug({ guildId }, "No mod-log channel set for guild — skipping log");
    return;
  }

  let channel: TextChannel | null = null;
  try {
    channel = (await client.channels.fetch(channelId)) as TextChannel;
  } catch (err) {
    logger.error({ err, channelId, guildId }, "Could not fetch mod-log channel — is the channel deleted?");
    return;
  }

  if (!channel || !("send" in channel)) {
    logger.error({ channelId, guildId }, "Mod-log channel is not a text channel");
    return;
  }

  const lines: string[] = [];
  lines.push(`**Action**\n${entry.action}`);
  lines.push(`**Executor**\n<@${entry.executor.id}> (${entry.executor.id})`);
  if (entry.target) lines.push(`**User**\n<@${entry.target.id}> (${entry.target.id})`);
  if (entry.channel) lines.push(`**Channel**\n<#${entry.channel.id}>`);
  if (entry.reason) lines.push(`**Reason**\n${entry.reason}`);
  if (entry.caseId) lines.push(`**Case ID**\n${entry.caseId}`);

  const embed = new EmbedBuilder()
    .setColor(entry.color ?? 0x5865f2)
    .setDescription(lines.join("\n\n"))
    .setTimestamp();

  await sendViaWebhook(client, channel, { embeds: [embed] });
  logger.debug({ action: entry.action, guildId }, "Mod log sent");
}
