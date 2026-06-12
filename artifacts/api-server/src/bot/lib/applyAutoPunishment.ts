import { Client, Guild, GuildMember } from "discord.js";
import { logger } from "../../lib/logger";
import type { AutomodAction } from "../store/automod";
import { getMuteConfig } from "../store/muteConfig";

const DURATION_RE = /^(\d+)(s|m|h|d)$/i;

function parseDurationSeconds(input: string): number | null {
  const match = input.match(DURATION_RE);
  if (!match) return null;
  const value = parseInt(match[1]!, 10);
  const unit = match[2]!.toLowerCase();
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * (multipliers[unit] ?? 1);
}

export async function applyAutoPunishment(
  client: Client,
  guild: Guild,
  member: GuildMember,
  action: AutomodAction,
  reason: string,
  duration?: string,
): Promise<void> {
  try {
    if (action === "warn") {
      // Warn is handled at the automod level via strike counting
    } else if (action === "mute" && duration) {
      const seconds = parseDurationSeconds(duration);
      if (!seconds) return;

      const muteCfg = getMuteConfig(guild.id);

      if (muteCfg.mode === "role" && muteCfg.muteRoleId) {
        const muteRole = guild.roles.cache.get(muteCfg.muteRoleId);
        if (muteRole) {
          if (muteCfg.stripRoles) {
            await member.roles.set([muteRole.id], reason);
          } else {
            await member.roles.add(muteRole, reason);
          }
        } else {
          await member.timeout(seconds * 1000, reason);
        }
      } else {
        await member.timeout(seconds * 1000, reason);
      }
    } else if (action === "kick") {
      await member.kick(reason);
    } else if (action === "ban") {
      await guild.members.ban(member.id, { reason, deleteMessageSeconds: 604800 });
    }
  } catch (err) {
    logger.error({ err, action, userId: member.id }, "AutoMod punishment failed");
  }
}
