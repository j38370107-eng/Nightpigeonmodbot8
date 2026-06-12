import { Client, GuildMember } from "discord.js";
import { consumeManualUnmute } from "../store/manualUnmutes";
import { sendDmNotification } from "../lib/dmNotify";
import { logger } from "../../lib/logger";

export function registerMemberUpdateHandler(client: Client) {
  client.on("guildMemberUpdate", async (oldMember: GuildMember, newMember: GuildMember) => {
    // Detect when a timeout expires naturally
    const wasTimedOut =
      oldMember.communicationDisabledUntilTimestamp !== null &&
      (oldMember.communicationDisabledUntilTimestamp ?? 0) > Date.now() - 10_000;
    const isNowFree = !newMember.isCommunicationDisabled();

    if (!wasTimedOut || !isNowFree) return;

    // Skip if a mod manually unmuted — the unmute command already sent a DM
    if (consumeManualUnmute(newMember.guild.id, newMember.id)) return;

    await sendDmNotification(newMember.user, {
      action: "Unmuted",
      guildName: newMember.guild.name,
      reason: "Your mute duration has ended.",
    });

    logger.info({ userId: newMember.id }, "Unmute DM sent after mute expiry");
  });
}
