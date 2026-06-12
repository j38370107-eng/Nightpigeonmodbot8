import { Client } from "discord.js";
import { logger } from "../../lib/logger";

export function registerMemberJoin(client: Client) {
  client.on("guildMemberAdd", async (member) => {
    logger.info({ memberId: member.id, guildId: member.guild.id }, "Member joined");
  });
}
