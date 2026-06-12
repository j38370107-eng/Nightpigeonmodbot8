import { Client, GuildMember } from "discord.js";
import { logger } from "../../lib/logger";

export function registerMemberUpdateHandler(client: Client) {
  client.on("guildMemberUpdate", async (oldMember: GuildMember, newMember: GuildMember) => {
    logger.info({ userId: newMember.id, guildId: newMember.guild.id }, "Member updated");
  });
}
