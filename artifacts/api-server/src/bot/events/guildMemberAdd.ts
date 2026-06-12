import { Client } from "discord.js";
import { logger } from "../../lib/logger";
import { getTimedMute } from "../store/timedMutes";
import { getMuteConfig } from "../store/muteConfig";

export function registerMemberJoin(client: Client) {
  client.on("guildMemberAdd", async (member) => {
    logger.info({ memberId: member.id, guildId: member.guild.id }, "Member joined");

    // ── Re-apply active mute if the member had one when they left ────────────
    const timedMute = getTimedMute(member.guild.id, member.id);
    if (!timedMute) return;

    const remaining = timedMute.expiresAt - Date.now();
    if (remaining <= 0) return;

    // Small delay — let Discord finish propagating the join before modifying the member
    await new Promise((r) => setTimeout(r, 500));

    // Refetch the member to ensure we have fresh data
    const freshMember = await member.guild.members.fetch(member.id).catch(() => member);

    const muteCfg = getMuteConfig(member.guild.id);

    try {
      if (muteCfg.mode === "role" && muteCfg.muteRoleId) {
        if (muteCfg.stripRoles) {
          await freshMember.roles.set([muteCfg.muteRoleId], "Mute re-applied on rejoin");
        } else {
          await freshMember.roles.add(muteCfg.muteRoleId, "Mute re-applied on rejoin");
        }
        logger.info({ memberId: member.id, guildId: member.guild.id }, "Re-applied mute role on rejoin");
      } else {
        const cappedMs = Math.min(remaining, 7 * 24 * 60 * 60 * 1000);
        await freshMember.timeout(cappedMs, "Mute re-applied on rejoin");
        logger.info({ memberId: member.id, guildId: member.guild.id, remainingMs: cappedMs }, "Re-applied timeout on rejoin");
      }
    } catch (err) {
      logger.error({ err, memberId: member.id, guildId: member.guild.id }, "Failed to re-apply mute on rejoin");
    }
  });
}
