import { Client, Message, TextChannel } from "discord.js";
import type { Command } from "../types";
import { checkYamlLevelAsync } from "../../lib/yamlLevels";
import { getCachedConfig } from "../../store/guildConfig";
import { buildPayload } from "../../lib/msgTemplate";

const MAX_PURGE = 100;

const purgeCmd: Command = {
  name: "purge",
  aliases: ["p"],
  usage: "<amount> [@user]",
  description: "Delete up to 100 messages. Optionally filter by user.",
  async execute(message: Message, args: string[], _client: Client) {
    if (!message.guild) return;
    if (!(await checkYamlLevelAsync(message, "purge"))) {
      return void message.reply("❌ You don't have permission to use this command.");
    }

    const amount = parseInt(args[0] ?? "0", 10);
    if (isNaN(amount) || amount < 1 || amount > MAX_PURGE) {
      return void message.reply(`❌ Please provide a number between 1 and ${MAX_PURGE}.`);
    }

    const filterUser = message.mentions.users.first() ?? null;
    const channel = message.channel as TextChannel;

    await message.delete().catch(() => {});

    const fetched = await channel.messages.fetch({ limit: MAX_PURGE });
    let toDelete = [...fetched.values()];

    // Filter by user if mentioned
    if (filterUser) {
      toDelete = toDelete.filter((m) => m.author.id === filterUser.id);
    }

    // Only keep up to `amount` messages, skip messages older than 14 days
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    toDelete = toDelete.filter((m) => m.createdTimestamp > cutoff).slice(0, amount);

    if (toDelete.length === 0) {
      const notice = await channel.send("❌ No messages to delete (messages may be older than 14 days).");
      setTimeout(() => notice.delete().catch(() => {}), 5000);
      return;
    }

    let deleted = 0;
    if (toDelete.length === 1) {
      await toDelete[0]!.delete().catch(() => {});
      deleted = 1;
    } else {
      const bulk = await channel.bulkDelete(toDelete, true);
      deleted = bulk.size;
    }

    const cfg = getCachedConfig(message.guild.id);
    const msgs = (cfg.plugins.moderation as any)?.messages ?? {};
    const payload = buildPayload(msgs.purge_success, { count: deleted }, `🗑️ Deleted **${deleted}** message${deleted !== 1 ? "s" : ""}.`);

    const notice = await channel.send(payload);
    setTimeout(() => notice.delete().catch(() => {}), 5000);
  },
};

export default purgeCmd;
