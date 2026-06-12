import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import {
  setAutomodWarnExpiry,
  getAutomodWarnExpiryLabel,
  parseDurationMs,
  msToLabel,
} from "../store/expiry";

const PERMANENT_WORDS = new Set(["0", "none", "off", "permanent", "never"]);

const USAGE =
  "`>setautomodwarnexpiry <duration|0>`\nExamples: `1d`, `3d`, `7d`, `14d`, `1m`\nRange: 1 day → 1 month  |  Use `0` or `none` for **permanent** (never expire)";

export const setAutomodWarnExpiryCommand: Command = {
  name: "setautomodwarnexpiry",
  aliases: ["automodwarnexpiry", "setamwarnexpiry"],
  description:
    "Set how long AutoMod-issued warnings last (1 day – 1 month, or 0 for permanent)",
  usage: "<duration: 1d / 7d / 14d / 1m | 0>",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const input = args[0]?.toLowerCase();
    if (!input) {
      const current = getAutomodWarnExpiryLabel(message.guild.id);
      return message.reply(
        `ℹ️ Current AutoMod warning expiry: **${current}**.\n${USAGE}`,
      );
    }

    // 0 / none / off / permanent → automod warnings never expire
    if (PERMANENT_WORDS.has(input)) {
      setAutomodWarnExpiry(message.guild.id, 0);
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("✅ AutoMod Warning Expiry Updated")
        .setDescription("AutoMod warnings are now **permanent** and will never expire.")
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    const ms = parseDurationMs(input);
    if (ms === null) {
      return message.reply(usageErr(message, setAutomodWarnExpiryCommand, "Invalid duration — use e.g. 1d, 7d, 14d, 1m, or 0 for permanent"));
    }

    const minMs = 24 * 60 * 60 * 1000;
    const maxMs = 30 * 24 * 60 * 60 * 1000;

    if (ms < minMs)
      return message.reply("❌ Minimum AutoMod warning expiry is **1 day**.");
    if (ms > maxMs)
      return message.reply(
        "❌ Maximum AutoMod warning expiry is **1 month** (30 days).",
      );

    setAutomodWarnExpiry(message.guild.id, ms);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("✅ AutoMod Warning Expiry Updated")
      .setDescription(
        `AutoMod warnings will now expire after **${msToLabel(ms)}**.`,
      )
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  },
};
