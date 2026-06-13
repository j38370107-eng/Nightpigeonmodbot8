import { Client, Message } from "discord.js";
import type { Command } from "../types";
import { getCachedConfig } from "../../store/guildConfig";

const tagCmd: Command = {
  name: "tag",
  aliases: [],
  usage: "<tagname>",
  description: "Display a server tag.",
  async execute(message: Message, args: string[], _client: Client) {
    if (!message.guild) return;

    const tagName = args[0]?.toLowerCase();
    if (!tagName) return void message.reply("❌ Please provide a tag name. Use `help` to see available tags.");

    const cfg = getCachedConfig(message.guild.id);
    const tags = cfg.tags ?? {};
    const response = tags[tagName];

    if (!response) {
      return void message.reply(`❌ No tag found for \`${tagName}\`.`);
    }

    await message.channel.send(response.replace(/\{user\}/g, `<@${message.author.id}>`));
  },
};

export default tagCmd;
