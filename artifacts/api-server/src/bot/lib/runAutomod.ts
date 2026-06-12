import { Client, Message } from "discord.js";
import { logger } from "../../lib/logger";
import { checkMessage } from "./automodChecker";
import { getPunishmentForStrikes, getAutomodConfig } from "../store/automod";
import { applyAutoPunishment } from "./applyAutoPunishment";
import { sendModLog } from "./modlog";

let strikeCounts: Map<string, number> = new Map();

function getStrikeKey(guildId: string, userId: string) {
  return `${guildId}:${userId}`;
}

function incrementStrike(guildId: string, userId: string): number {
  const key = getStrikeKey(guildId, userId);
  const count = (strikeCounts.get(key) ?? 0) + 1;
  strikeCounts.set(key, count);
  return count;
}

/**
 * Run all automod checks against a message.
 * Returns true if the message triggered automod and was deleted.
 */
export async function runAutomod(client: Client, message: Message): Promise<boolean> {
  if (!message.guild) return false;
  if (message.author.bot) return false;

  const result = checkMessage(message);
  if (!result.triggered) return false;

  const guildId  = message.guild.id;
  const userId   = message.author.id;
  const botTag   = client.user?.tag ?? "AutoMod";
  const botId    = client.user?.id ?? "0";
  const isSilent = getAutomodConfig(guildId).silent;

  await message.delete().catch(() => {});

  if (result.action === "delete") {
    await sendModLog(client, guildId, {
      action: `AutoMod — Message Deleted (${result.module})`,
      executor: { tag: botTag, id: botId },
      target: { tag: message.author.tag, id: userId },
      channel: { name: (message.channel as any).name ?? "unknown", id: message.channel.id },
      reason: result.reason,
      color: 0xe67e22,
    });

    if (!isSilent) {
      const notice = await message.channel
        .send(`🚫 <@${userId}> — **${result.module}**: ${result.publicReason ?? result.reason}.`)
        .catch(() => null);
      if (notice) setTimeout(() => notice.delete().catch(() => {}), 7000);
    }

    logger.info({ userId, guildId, module: result.module, action: "delete" }, "AutoMod triggered (delete-only)");
    return true;
  }

  if (result.action === "mute" || result.action === "kick" || result.action === "ban") {
    const warnReason = `AutoMod: ${result.module} — ${result.reason}`;

    if (!isSilent) {
      const notice = await message.channel
        .send(`⛔ <@${userId}> — **${result.module}**: ${result.publicReason ?? result.reason}. (AutoMod ${result.action})`)
        .catch(() => null);
      if (notice) setTimeout(() => notice.delete().catch(() => {}), 7000);
    }

    await sendModLog(client, guildId, {
      action: `AutoMod — ${result.action.charAt(0).toUpperCase() + result.action.slice(1)} (${result.module})`,
      executor: { tag: botTag, id: botId },
      target: { tag: message.author.tag, id: userId },
      channel: { name: (message.channel as any).name ?? "unknown", id: message.channel.id },
      reason: result.reason,
      color: 0xe74c3c,
    });

    if (message.member) {
      await applyAutoPunishment(
        client,
        message.guild,
        message.member,
        result.action as any,
        warnReason,
        result.actionDuration,
      );
    }

    logger.info({ userId, guildId, module: result.module, action: result.action }, "AutoMod triggered (direct punishment)");
    return true;
  }

  // Warn action — warn + escalation
  const warnReason = `AutoMod: ${result.module} — ${result.reason}`;
  const strikeCount = incrementStrike(guildId, userId);
  const step = getPunishmentForStrikes(guildId, strikeCount);

  if (!isSilent) {
    const notice = await message.channel
      .send(`⚠️ <@${userId}> — **${result.module}**: ${result.publicReason ?? result.reason}. (AutoMod warn ${strikeCount})`)
      .catch(() => null);
    if (notice) setTimeout(() => notice.delete().catch(() => {}), 7000);
  }

  await sendModLog(client, guildId, {
    action: `AutoMod — Message Deleted (${result.module})`,
    executor: { tag: botTag, id: botId },
    target: { tag: message.author.tag, id: userId },
    channel: { name: (message.channel as any).name ?? "unknown", id: message.channel.id },
    reason: `${result.reason} — Strike ${strikeCount}`,
    color: 0xe67e22,
  });

  logger.info({ userId, guildId, module: result.module, strikeCount }, "AutoMod triggered (warn)");

  if (step && message.member) {
    await applyAutoPunishment(
      client,
      message.guild,
      message.member,
      step.action,
      warnReason,
      step.duration,
    );
  }

  return true;
}
