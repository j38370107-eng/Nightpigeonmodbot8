import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import {
  setWarnExpiry,
  getWarnExpiryLabel,
  parseDurationMs,
  msToLabel,
} from "../store/expiry";

const MIN_MS = 1 * 24 * 60 * 60 * 1000;          // 1 day
const MAX_MS = 90 * 24 * 60 * 60 * 1000;          // 3 months

const PERMANENT_WORDS = new Set(["0", "none", "off", "permanent", "never"]);

const USAGE =
  "`>setexpiredate <duration|0>`\n" +
  "Examples: `1d`, `7d`, `2w`, `1m`, `2m`, `3m`\n" +
  "Range: **1 day → 3 months**  |  Use `0` or `none` for **permanent** (never expire)";

export const setExpireDateCommand: Command = {
  name: "setexpiredate",
  aliases: ["setexpiry", "warnexpiry", "setwarnduration"],
  description: "Set how long warnings last (1 day – 3 months, or 0 for permanent)",
  usage: "<duration: 1d / 7d / 2w / 1m / 3m | 0>",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const input = args[0]?.toLowerCase();
    if (!input) {
      const current = getWarnExpiryLabel(message.guild.id);
      return message.reply(`ℹ️ Current warning expiry: **${current}**.\n${USAGE}`);
    }

    // 0 / none / off / permanent → warnings never expire
    if (PERMANENT_WORDS.has(input)) {
      setWarnExpiry(message.guild.id, 0);
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("✅ Warning Expiry Updated")
        .setDescription("Warnings are now **permanent** and will never expire.")
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    let ms: number | null = null;

    // Support plain numbers 1-3 as months for backward compat
    const plainNum = parseInt(input, 10);
    if (!isNaN(plainNum) && /^\d+$/.test(input)) {
      if (plainNum < 1 || plainNum > 3) {
        return message.reply(usageErr(message, setExpireDateCommand, "Plain number must be 1–3 months — or use a duration like 7d, 2w, 2m"));
      }
      ms = plainNum * 30 * 24 * 60 * 60 * 1000;
    } else {
      ms = parseDurationMs(input);
      if (ms === null) return message.reply(usageErr(message, setExpireDateCommand, "Invalid duration"));
    }

    if (ms < MIN_MS) return message.reply(usageErr(message, setExpireDateCommand, "Minimum warning expiry is 1 day"));
    if (ms > MAX_MS) return message.reply(usageErr(message, setExpireDateCommand, "Maximum warning expiry is 3 months (90 days)"));

    setWarnExpiry(message.guild.id, ms);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("✅ Warning Expiry Updated")
      .setDescription(`Warnings will now expire after **${msToLabel(ms)}**.`)
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  },
};
