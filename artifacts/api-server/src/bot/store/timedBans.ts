import { Client } from "discord.js";
import { addInfraction } from "./infractions";
import { sendModLog } from "../lib/modlog";
import { logger } from "../../lib/logger";
import { dbSet, dbDelete, dbGetAll } from "./db";

const STORE = "timedBans";

export interface TimedBan {
  guildId: string;
  userId: string;
  userTag: string;
  reason: string;
  expiresAt: number;
  moderatorId: string;
  moderatorTag: string;
}

const cache = new Map<string, TimedBan>();

export async function initTimedBansStore(): Promise<void> {
  const rows = await dbGetAll<TimedBan>(STORE);
  for (const { key, data } of rows) cache.set(key, data);
  logger.info({ count: rows.length }, "Loaded timedBans store from DB");
}

function storeKey(guildId: string, userId: string) {
  return `${guildId}:${userId}`;
}

export function addTimedBan(ban: TimedBan): void {
  const k = storeKey(ban.guildId, ban.userId);
  cache.set(k, ban);
  dbSet(STORE, k, ban).catch((err) => logger.error({ err }, "Failed to save timed ban"));
}

export function removeTimedBan(guildId: string, userId: string): void {
  const k = storeKey(guildId, userId);
  cache.delete(k);
  dbDelete(STORE, k).catch((err) => logger.error({ err }, "Failed to delete timed ban"));
}

export function getAllTimedBans(): TimedBan[] {
  return Array.from(cache.values());
}

async function executeUnban(client: Client, ban: TimedBan): Promise<void> {
  removeTimedBan(ban.guildId, ban.userId);

  const guild = await client.guilds.fetch(ban.guildId).catch(() => null);
  if (!guild) return;

  try {
    await guild.members.unban(ban.userId, "Timed ban expired");
  } catch {
    return;
  }

  const user = await client.users.fetch(ban.userId).catch(() => null);
  if (user) {
    const infraction = addInfraction(ban.guildId, ban.userId, {
      type: "Unban",
      reason: "Timed ban expired",
      moderatorId: client.user?.id ?? "0",
      moderatorTag: client.user?.tag ?? "AutoMod",
    });

    await sendModLog(client, ban.guildId, {
      action: "Timed Ban Expired — Member Unbanned",
      executor: { tag: client.user?.tag ?? "AutoMod", id: client.user?.id ?? "0" },
      target: { tag: user.tag, id: user.id },
      reason: `Timed ban expired (original: ${ban.reason})`,
      color: 0x2ecc71,
      caseId: infraction.id,
    });
  }

  logger.info({ userId: ban.userId, guildId: ban.guildId }, "Timed ban expired, user unbanned");
}

// Node.js setTimeout overflows above 2^31-1 ms (~24.8 days); chunk large delays.
const MAX_TIMEOUT_MS = 2_000_000_000;

function safeSetTimeout(fn: () => void, delayMs: number): void {
  if (delayMs <= MAX_TIMEOUT_MS) {
    setTimeout(fn, delayMs);
  } else {
    setTimeout(() => safeSetTimeout(fn, delayMs - MAX_TIMEOUT_MS), MAX_TIMEOUT_MS);
  }
}

export function scheduleTimedBan(client: Client, ban: TimedBan): void {
  const delay = ban.expiresAt - Date.now();
  if (delay <= 0) {
    executeUnban(client, ban).catch((err) =>
      logger.error({ err }, "Failed to execute expired timed ban")
    );
    return;
  }
  safeSetTimeout(() => {
    executeUnban(client, ban).catch((err) =>
      logger.error({ err }, "Failed to execute timed ban unban")
    );
  }, delay);
}

export function scheduleAllTimedBans(client: Client): void {
  const bans = getAllTimedBans();
  for (const ban of bans) scheduleTimedBan(client, ban);
  logger.info({ count: bans.length }, "Scheduled timed bans on startup");
}
