import type { Message } from "discord.js";
import { getCachedConfig, getGuildConfig } from "../store/guildConfig";

const BOT_OWNER_ID = process.env["BOT_OWNER_ID"];

/**
 * Compute a user's effective level from the YAML config.
 * Priority: bot owner (100) > guild owner (100) > user override > highest role level
 */
export function getUserLevel(message: Message): number {
  if (!message.guild) return 0;

  const userId = message.author.id;
  const guildId = message.guild.id;

  if (BOT_OWNER_ID && userId === BOT_OWNER_ID) return 100;
  if (userId === message.guild.ownerId) return 100;

  const cfg = getCachedConfig(guildId);
  const levels = cfg.levels;

  let level = 0;

  if (levels.users[userId] !== undefined) {
    level = Math.max(level, levels.users[userId]!);
  }

  const member = message.member;
  if (member) {
    for (const [roleId, roleLevel] of Object.entries(levels.roles)) {
      if (member.roles.cache.has(roleId)) {
        level = Math.max(level, roleLevel);
      }
    }
  }

  return level;
}

/**
 * Returns the required level for a command from YAML config (default 0).
 */
export function getRequiredLevel(guildId: string, commandName: string): number {
  const cfg = getCachedConfig(guildId);
  return cfg.levels.commands[commandName] ?? 0;
}

/**
 * Returns true if the user's level meets the requirement for the given command.
 */
export function checkYamlLevel(message: Message, commandName: string): boolean {
  if (!message.guild) return false;
  const userLevel = getUserLevel(message);
  const required = getRequiredLevel(message.guild.id, commandName);
  return userLevel >= required;
}

/**
 * Async variant that loads config from DB if not cached yet.
 */
export async function checkYamlLevelAsync(message: Message, commandName: string): Promise<boolean> {
  if (!message.guild) return false;
  const guildId = message.guild.id;
  await getGuildConfig(guildId);
  return checkYamlLevel(message, commandName);
}
