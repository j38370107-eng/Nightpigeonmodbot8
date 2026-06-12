import { Client, Events, Message, PartialMessage } from "discord.js";
import { logger } from "../../lib/logger";
import { isGuildBlacklisted, isUserBlacklisted, OWNER_ID } from "../store/ownerBlacklists";
import { runAutomod } from "../lib/runAutomod";

export function registerMessageUpdate(client: Client) {
  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    // Ignore bot edits and DMs
    if (!newMessage.guild) return;
    if (newMessage.author?.bot) return;

    // Fetch full message if partial
    let full: Message;
    try {
      full = newMessage.partial ? await newMessage.fetch() : (newMessage as Message);
    } catch {
      return;
    }

    if (full.author.bot) return;

    // Owner blacklist checks
    if (full.author.id !== OWNER_ID) {
      if (isGuildBlacklisted(full.guild!.id)) return;
      if (isUserBlacklisted(full.author.id)) return;
    }

    // Skip if content didn't actually change (e.g. embed resolution)
    if (oldMessage.content === full.content) return;

    logger.info(
      { messageId: full.id, userId: full.author.id, guildId: full.guild!.id },
      "Checking edited message for automod",
    );

    await runAutomod(client, full);
  });
}
