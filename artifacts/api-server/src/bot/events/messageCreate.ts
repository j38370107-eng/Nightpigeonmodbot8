import { Events, Message } from "discord.js";
import { handleConfigCommand } from "../commands/config";
import { logger } from "../../lib/logger";

export function registerMessageCreate(client: import("discord.js").Client): void {
  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot || !message.guild) return;

    const prefix = ">";
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const command = args[0]?.toLowerCase();

    if (command === "config") {
      await handleConfigCommand(message).catch((err) =>
        logger.error({ err }, "Error handling config command")
      );
    }
  });
}
