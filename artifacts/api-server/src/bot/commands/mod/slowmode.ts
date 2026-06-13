import { Client, Message, TextChannel } from "discord.js";
import type { Command } from "../types";
import { checkYamlLevelAsync } from "../../lib/yamlLevels";
import { getCachedConfig } from "../../store/guildConfig";
import { buildPayload } from "../../lib/msgTemplate";

const slowmodeCmd: Command = {
  name: "slowmode",
  aliases: ["sm"],
  usage: "<seconds|off> [#channel]",
  description: "Set or remove slowmode in a channel.",
  async execute(message: Message, args: string[], _client: Client) {
    if (!message.guild) return;
    if (!(await checkYamlLevelAsync(message, "slowmode"))) {
      return void message.reply("❌ You don't have permission to use this command.");
    }

    if (!args[0]) return void message.reply("❌ Usage: `slowmode <seconds|off> [#channel]`");

    const targetChannel = (message.mentions.channels.first() as TextChannel | undefined) ?? (message.channel as TextChannel);
    const input = args[0]!.toLowerCase();
    const isOff = input === "off" || input === "0";
    const seconds = isOff ? 0 : parseInt(input, 10);

    if (!isOff && (isNaN(seconds) || seconds < 0 || seconds > 21600)) {
      return void message.reply("❌ Seconds must be between 0 and 21600.");
    }

    await targetChannel.setRateLimitPerUser(seconds, `Set by ${message.author.tag}`);

    const cfg = getCachedConfig(message.guild.id);
    const msgs = (cfg.plugins.moderation as any)?.messages ?? {};
    const vars = {
      count: seconds,
      channel: `<#${targetChannel.id}>`,
    };

    const key = isOff ? "slowmode_off" : "slowmode_success";
    const fallback = isOff
      ? `✅ Slowmode removed in <#${targetChannel.id}>.`
      : `⏱️ Slowmode set to **${seconds}s** in <#${targetChannel.id}>.`;

    const payload = buildPayload(msgs[key], vars, fallback);
    await message.channel.send(payload);
  },
};

export default slowmodeCmd;
