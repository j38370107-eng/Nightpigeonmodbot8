import { Client } from "discord.js";
import { sendDmNotification } from "../lib/dmNotify";
import { logger } from "../../lib/logger";
import { dbSet, dbDelete, dbGetAll } from "./db";
import { getMuteConfig } from "./muteConfig";

const STORE = "timedMutes";

export interface TimedMute {
  guildId: string;
  userId: string;
  guildName: string;
  /** Timestamp (ms) when the mute expires. null = permanent (role mode only). */
  expiresAt: number | null;
  /** Roles stripped from the member when muted (role mode + stripRoles). Restored on unmute/expiry. */
  strippedRoles?: string[];
}

const cache = new Map<string, TimedMute>();

export async function initTimedMutesStore(): Promise<void> {
  const rows = await dbGetAll<TimedMute>(STORE);
  for (const { key, data } of rows) cache.set(key, data);
  logger.info({ count: rows.length }, "Loaded timedMutes store from DB");
}

function storeKey(guildId: string, userId: string) {
  return `${guildId}:${userId}`;
}

export function addTimedMute(mute: TimedMute): void {
  const k = storeKey(mute.guildId, mute.userId);
  cache.set(k, mute);
  dbSet(STORE, k, mute).catch((err) => logger.error({ err }, "Failed to save timed mute"));
}

export function removeTimedMute(guildId: string, userId: string): void {
  const k = storeKey(guildId, userId);
  cache.delete(k);
  dbDelete(STORE, k).catch((err) => logger.error({ err }, "Failed to delete timed mute"));
}

export function getTimedMute(guildId: string, userId: string): TimedMute | undefined {
  return cache.get(storeKey(guildId, userId));
}

export function getAllTimedMutes(): TimedMute[] {
  return Array.from(cache.values());
}

async function executeMuteExpiry(client: Client, mute: TimedMute): Promise<void> {
  removeTimedMute(mute.guildId, mute.userId);

  // ── Role mode: remove mute role and restore stripped roles ───────────────
  const muteCfg = getMuteConfig(mute.guildId);
  if (muteCfg.mode === "role" && muteCfg.muteRoleId) {
    const guild = await client.guilds.fetch(mute.guildId).catch(() => null);
    if (guild) {
      const member = await guild.members.fetch(mute.userId).catch(() => null);
      if (member) {
        if (mute.strippedRoles && mute.strippedRoles.length > 0) {
          // restore original roles (filter out any that no longer exist)
          const valid = mute.strippedRoles.filter((id) => guild.roles.cache.has(id));
          await member.roles.set(valid, "Mute expired — restoring roles").catch(() => {});
        } else {
          await member.roles.remove(muteCfg.muteRoleId, "Mute expired").catch(() => {});
        }
      }
    }
  }

  // ── Send expiry DM ────────────────────────────────────────────────────────
  const user = await client.users.fetch(mute.userId).catch(() => null);
  if (!user) return;

  await sendDmNotification(user, {
    action: "Unmuted",
    guildName: mute.guildName,
    reason: "Your mute duration has ended. Please continue to follow the rules!",
  });

  logger.info({ userId: mute.userId, guildId: mute.guildId }, "Unmute DM sent after mute expiry");
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

export function scheduleTimedMute(client: Client, mute: TimedMute): void {
  if (mute.expiresAt === null) return; // permanent mute — no auto-expiry

  const delay = mute.expiresAt - Date.now();
  if (delay <= 0) {
    executeMuteExpiry(client, mute).catch((err) =>
      logger.error({ err }, "Failed to send expiry unmute DM"),
    );
    return;
  }
  safeSetTimeout(() => {
    executeMuteExpiry(client, mute).catch((err) =>
      logger.error({ err }, "Failed to send expiry unmute DM"),
    );
  }, delay);
}

export function scheduleAllTimedMutes(client: Client): void {
  const mutes = getAllTimedMutes();
  for (const mute of mutes) scheduleTimedMute(client, mute);
  logger.info({ count: mutes.length }, "Scheduled timed mutes on startup");
}
