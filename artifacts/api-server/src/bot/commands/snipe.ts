import { Message, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import {
  getDeletedSnipe,
  getEditedSnipe,
  clearSnipes,
} from "../store/snipe";

export const snipeCommand: Command = {
  name: "snipe",
  aliases: ["s"],
  description: "Show the most recently deleted message in this channel",
  usage: "",
  requiredPermissions: [],

  async execute(message: Message) {
    if (!message.guild) return;

    const snipe = getDeletedSnipe(message.channelId);
    if (!snipe) {
      return message.reply("❌ There's nothing to snipe in this channel.");
    }

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setAuthor({ name: snipe.author.tag, iconURL: snipe.author.displayAvatarURL })
      .setDescription(snipe.content || "*[no text content]*")
      .setFooter({ text: `Deleted` })
      .setTimestamp(snipe.deletedAt);

    if (snipe.attachments.length > 0) {
      const first = snipe.attachments[0]!;
      const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(first.name);
      if (isImage) embed.setImage(first.url);

      if (snipe.attachments.length > 1) {
        embed.addFields({
          name: "Attachments",
          value: snipe.attachments.map((a) => `[${a.name}](${a.url})`).join("\n"),
        });
      }
    }

    await message.channel.send({ embeds: [embed] });
  },
};

export const editSnipeCommand: Command = {
  name: "editsnipe",
  aliases: ["es"],
  description: "Show the most recently edited message in this channel",
  usage: "",
  requiredPermissions: [],

  async execute(message: Message) {
    if (!message.guild) return;

    const snipe = getEditedSnipe(message.channelId);
    if (!snipe) {
      return message.reply("❌ There's nothing to edit-snipe in this channel.");
    }

    const embed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setAuthor({ name: snipe.author.tag, iconURL: snipe.author.displayAvatarURL })
      .addFields(
        { name: "Before", value: snipe.oldContent || "*[empty]*", inline: false },
        { name: "After", value: snipe.newContent || "*[empty]*", inline: false },
      )
      .setFooter({ text: "Edited" })
      .setTimestamp(snipe.editedAt);

    await message.channel.send({ embeds: [embed], components: [] });
  },
};

export const clearSnipeCommand: Command = {
  name: "clearsnipe",
  aliases: ["cs"],
  description: "Clear the snipe cache for this channel",
  usage: "",
  requiredPermissions: [],

  async execute(message: Message) {
    if (!message.guild) return;

    clearSnipes(message.channelId);
    const reply = await message.channel.send("🗑️ Snipe cache cleared for this channel.");
    setTimeout(() => reply.delete().catch(() => {}), 5000);
  },
};
