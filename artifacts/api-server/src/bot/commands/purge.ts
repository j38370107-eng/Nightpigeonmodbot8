import { Message, PermissionFlagsBits, TextChannel, EmbedBuilder } from "discord.js";
import { logger } from "../../lib/logger";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { sendModLog } from "../lib/modlog";

export const purgeCommand: Command = {
  name: "purge",
  aliases: ["clear", "prune"],
  description: "Delete a number of messages from the channel",
  usage: "<amount 1-100> [@user | userID]",
  requiredPermissions: [PermissionFlagsBits.ManageMessages],

  async execute(message: Message, args: string[]) {
    const channel = message.channel as TextChannel;
    if (!("bulkDelete" in channel)) {
      return message.reply("❌ This command can only be used in a text channel.");
    }

    const amount = parseInt(args[0] ?? "", 10);
    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply(usageErr(message, purgeCommand, "Provide a number between 1 and 100"));
    }

    const filterUser =
      message.mentions.users.first() ??
      (args[1] && /^\d{15,20}$/.test(args[1])
        ? await message.client.users.fetch(args[1]).catch(() => null)
        : null);

    try {
      await message.delete().catch(() => {});

      let fetched = await channel.messages.fetch({ limit: 100 });
      if (filterUser) {
        fetched = fetched.filter((m) => m.author.id === filterUser.id);
      }

      const toDelete = fetched.first(amount);
      const deleted = await channel.bulkDelete(toDelete, true);

      const reply = await channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle("🗑️ Messages Purged")
            .setDescription(
              `Deleted **${deleted.size}** message(s)${filterUser ? ` from ${filterUser.tag}` : ""}.`
            )
            .setTimestamp(),
        ],
      });

      setTimeout(() => reply.delete().catch(() => {}), 5000);

      if (message.guild) {
        await sendModLog(message.client, message.guild.id, {
          action: `Messages Purged (${deleted.size}${filterUser ? ` from @${filterUser.tag}` : ""})`,
          executor: { tag: message.author.tag, id: message.author.id },
          channel: { name: channel.name, id: channel.id },
          color: 0x3498db,
        });
      }

      logger.info({ count: deleted.size, channelId: channel.id }, "Messages purged");
    } catch (err) {
      logger.error({ err }, "Failed to purge messages");
      channel.send("❌ Failed to purge. Messages older than 14 days cannot be bulk deleted.");
    }
  },
};
