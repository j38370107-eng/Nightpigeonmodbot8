import { Message, EmbedBuilder, AttachmentBuilder, PermissionFlagsBits } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { getAntiNuke, setAntiNuke } from "../store/antinuke";
import { getAntiRaid, updateAntiRaid } from "../store/antiraid";
import { getAutomodConfig, setAutomodConfig } from "../store/automod";
import { getModRoles, clearModRoles, addModRole } from "../store/modroles";
import { getShortcutsRaw, clearShortcuts, setShortcut } from "../store/shortcuts";
import { listAliases, clearAliases, setAlias } from "../store/aliases";
import { getGuildSetting, setGuildSetting } from "../store/settings";
import { OWNER_ID } from "../store/ownerBlacklists";
import { logger } from "../../lib/logger";

const SETTINGS_KEYS = [
  "logChannelId",
  "serverLogChannelId",
  "prefix",
  "warnExpiryMonths",
  "warnExpiryMs",
  "automodWarnExpiryMs",
] as const;

function buildBackup(guildId: string) {
  const settings: Record<string, unknown> = {};
  for (const key of SETTINGS_KEYS) {
    const val = getGuildSetting(guildId, key);
    if (val !== undefined) settings[key] = val;
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    guildId,
    settings,
    antinuke: getAntiNuke(guildId),
    antiraid: getAntiRaid(guildId),
    automod: getAutomodConfig(guildId),
    modroles: getModRoles(guildId),
    shortcuts: getShortcutsRaw(guildId),
    aliases: listAliases(guildId),
  };
}

async function restoreBackup(guildId: string, data: ReturnType<typeof buildBackup>): Promise<string[]> {
  const log: string[] = [];

  if (data.settings && typeof data.settings === "object") {
    for (const key of SETTINGS_KEYS) {
      if (key in data.settings) {
        setGuildSetting(guildId, key, (data.settings as any)[key]);
      }
    }
    log.push("✅ Settings restored");
  }

  if (data.antinuke) {
    setAntiNuke(guildId, data.antinuke);
    log.push("✅ Anti-Nuke config restored");
  }

  if (data.antiraid) {
    updateAntiRaid(guildId, data.antiraid);
    log.push("✅ Anti-Raid config restored");
  }

  if (data.automod) {
    setAutomodConfig(guildId, data.automod);
    log.push("✅ Automod config restored");
  }

  if (Array.isArray(data.modroles)) {
    clearModRoles(guildId);
    for (const roleId of data.modroles) addModRole(guildId, roleId);
    log.push(`✅ Mod roles restored (${data.modroles.length})`);
  }

  if (data.shortcuts && typeof data.shortcuts === "object") {
    clearShortcuts(guildId);
    const entries = Object.values(data.shortcuts);
    for (const sc of entries) setShortcut(guildId, sc as any);
    log.push(`✅ Shortcuts restored (${entries.length})`);
  }

  if (data.aliases && typeof data.aliases === "object") {
    clearAliases(guildId);
    const entries = Object.entries(data.aliases);
    for (const [alias, cmd] of entries) setAlias(guildId, alias, cmd as string);
    log.push(`✅ Aliases restored (${entries.length})`);
  }

  return log;
}

export const backupCommand: Command = {
  name: "backup",
  aliases: ["bk"],
  description: "Export or import all server settings as a backup file (admin only)",
  usage: "export  |  import (attach a .json backup file)",
  ownerOnly: false,
  requiredPermissions: [PermissionFlagsBits.Administrator],

  async execute(message: Message, args: string[]) {
    const sub = args[0]?.toLowerCase();

    if (!sub || (sub !== "export" && sub !== "import")) {
      return message.reply(usageErr(message, backupCommand, "Specify export or import"));
    }

    // ── Export ────────────────────────────────────────────────────────────────
    if (sub === "export") {
      if (!message.guild) {
        return message.reply("❌ Export must be run inside a server.");
      }
      try {
        const guildId = message.guild.id;
        const data = buildBackup(guildId);
        const json = JSON.stringify(data, null, 2);
        const buf = Buffer.from(json, "utf8");
        const filename = `backup-${guildId}-${Date.now()}.json`;
        const attachment = new AttachmentBuilder(buf, { name: filename });

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle("📦 Settings Backup")
          .setDescription(`Backup for **${message.guild.name}**. Use \`>backup import\` to restore from this file at any time.`)
          .addFields(
            { name: "Shortcuts", value: `${Object.keys(data.shortcuts).length}`, inline: true },
            { name: "Aliases", value: `${Object.keys(data.aliases).length}`, inline: true },
            { name: "Mod Roles", value: `${data.modroles.length}`, inline: true },
            { name: "Anti-Nuke", value: data.antinuke.enabled ? "Enabled" : "Disabled", inline: true },
            { name: "Anti-Raid", value: data.antiraid.enabled ? "Enabled" : "Disabled", inline: true }
          )
          .setTimestamp()
          .setFooter({ text: `Exported by ${message.author.tag}` });

        try {
          await message.author.send({ embeds: [embed], files: [attachment] });
          return message.reply("✅ Backup sent to your DMs.");
        } catch {
          return message.reply("❌ Couldn't send you a DM. Make sure your DMs are open and try again.");
        }
      } catch (err) {
        logger.error({ err }, "Backup export failed");
        return message.reply("❌ Failed to generate backup. Check bot logs.");
      }
    }

    // ── Import (works in server or DMs) ───────────────────────────────────────
    if (sub === "import") {
      const attachment = message.attachments.first();
      if (!attachment) {
        return message.reply(usageErr(message, backupCommand, "Attach a .json backup file to this message"));
      }
      if (!attachment.name?.endsWith(".json")) {
        return message.reply("❌ The attached file must be a `.json` backup file.");
      }
      if (attachment.size > 512_000) {
        return message.reply("❌ Backup file is too large (max 512 KB).");
      }

      // ── 1. Fetch & parse ───────────────────────────────────────────────────
      let raw: unknown;
      try {
        const res = await fetch(attachment.url);
        if (!res.ok) return message.reply("❌ Could not download the backup file from Discord.");
        const text = await res.text();
        if (text.length > 600_000) return message.reply("❌ Backup file content is too large.");
        raw = JSON.parse(text);
      } catch {
        return message.reply("❌ Could not read the backup file — make sure it is valid JSON.");
      }

      // ── 2. Deep validation ─────────────────────────────────────────────────
      const validationError = validateBackup(raw);
      if (validationError) {
        return message.reply(`❌ Invalid backup file: ${validationError}`);
      }
      const data = raw as ReturnType<typeof buildBackup>;

      // ── 3. Resolve the target guild ────────────────────────────────────────
      // If run in a server, always target that server.
      // If run in DMs, look up the guild from the backup's guildId.
      let targetGuild = message.guild;
      if (!targetGuild) {
        targetGuild = message.client.guilds.cache.get(data.guildId) ?? null;
        if (!targetGuild) {
          return message.reply("❌ The bot is not in the server this backup belongs to.");
        }
        // Verify the user has Administrator in the target guild
        const member = await targetGuild.members.fetch(message.author.id).catch(() => null);
        if (!member?.permissions.has(PermissionFlagsBits.Administrator)) {
          return message.reply("❌ You need the **Administrator** permission in that server to import a backup.");
        }
      }

      const guildId = targetGuild.id;
      const crossServer = data.guildId !== guildId;
      const exportedAt  = data.exportedAt
        ? `<t:${Math.floor(new Date(data.exportedAt).getTime() / 1000)}:F>`
        : "Unknown";

      // ── 4. Confirmation ────────────────────────────────────────────────────
      const warningLines = [
        `📦 **Backup ready to import**`,
        `Server: **${targetGuild.name}**`,
        `Exported: ${exportedAt}`,
        crossServer
          ? `⚠️ **This backup came from a different server.** Settings will be applied to **${targetGuild.name}**.`
          : `✅ Backup matches this server.`,
        ``,
        `This will overwrite the current automod, anti-nuke, anti-raid, mod roles, shortcuts and aliases.`,
        ``,
        `Type **\`yes\`** within 30 seconds to confirm, or anything else to cancel.`,
      ];

      const prompt = await message.reply(warningLines.join("\n"));

      let confirmed = false;
      try {
        const collected = await message.channel.awaitMessages({
          filter: (m) => m.author.id === message.author.id,
          max: 1,
          time: 30_000,
          errors: ["time"],
        });
        const response = collected.first()?.content.trim().toLowerCase();
        confirmed = response === "yes";
      } catch {
        // timed out
      }

      if (!confirmed) {
        await prompt.edit("🚫 Import cancelled.");
        return;
      }

      // ── 5. Apply ──────────────────────────────────────────────────────────────
      const processing = await message.reply("⏳ Restoring settings...");

      try {
        const log = await restoreBackup(guildId, data);

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle("✅ Backup Restored")
          .setDescription(log.join("\n"))
          .addFields({
            name: "Originally exported",
            value: exportedAt,
          })
          .setTimestamp()
          .setFooter({ text: `Restored by ${message.author.tag}` });

        await processing.edit({ content: "", embeds: [embed] });
      } catch (err) {
        logger.error({ err }, "Backup import failed");
        await processing.edit("❌ An error occurred while restoring. Some settings may have been partially applied.");
      }
    }
  },
};

// ── Validation ────────────────────────────────────────────────────────────────
// Returns an error string if invalid, or null if the backup is safe to apply.
function validateBackup(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "not a valid object";
  const d = raw as Record<string, unknown>;

  if (d["version"] !== 1)                      return "unsupported version (expected 1)";
  if (typeof d["guildId"] !== "string" || !d["guildId"]) return "missing or invalid guildId";
  if (d["exportedAt"] !== undefined && typeof d["exportedAt"] !== "string") return "invalid exportedAt";

  // settings
  if (d["settings"] !== undefined) {
    if (typeof d["settings"] !== "object" || Array.isArray(d["settings"])) return "settings must be an object";
    const s = d["settings"] as Record<string, unknown>;
    for (const [k, v] of Object.entries(s)) {
      if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") {
        return `settings.${k} has an invalid type`;
      }
      if (typeof v === "string" && v.length > 512) return `settings.${k} value is too long`;
    }
  }

  // modroles — array of strings
  if (d["modroles"] !== undefined) {
    if (!Array.isArray(d["modroles"])) return "modroles must be an array";
    for (const r of d["modroles"] as unknown[]) {
      if (typeof r !== "string" || !/^\d+$/.test(r)) return "modroles must contain Discord snowflake IDs";
    }
    if ((d["modroles"] as unknown[]).length > 50) return "modroles has too many entries (max 50)";
  }

  // lockdownChannels — array of strings
  if (d["lockdownChannels"] !== undefined) {
    if (!Array.isArray(d["lockdownChannels"])) return "lockdownChannels must be an array";
    for (const c of d["lockdownChannels"] as unknown[]) {
      if (typeof c !== "string" || !/^\d+$/.test(c)) return "lockdownChannels must contain Discord snowflake IDs";
    }
    if ((d["lockdownChannels"] as unknown[]).length > 200) return "lockdownChannels has too many entries (max 200)";
  }

  // shortcuts — object of objects
  if (d["shortcuts"] !== undefined) {
    if (typeof d["shortcuts"] !== "object" || Array.isArray(d["shortcuts"])) return "shortcuts must be an object";
    const shortcuts = d["shortcuts"] as Record<string, unknown>;
    if (Object.keys(shortcuts).length > 200) return "too many shortcuts (max 200)";
    for (const [k, v] of Object.entries(shortcuts)) {
      if (typeof k !== "string" || k.length > 64) return `shortcut key "${k}" is too long`;
      if (!v || typeof v !== "object" || Array.isArray(v)) return `shortcut "${k}" is not a valid object`;
    }
  }

  // aliases — object of strings
  if (d["aliases"] !== undefined) {
    if (typeof d["aliases"] !== "object" || Array.isArray(d["aliases"])) return "aliases must be an object";
    const aliases = d["aliases"] as Record<string, unknown>;
    if (Object.keys(aliases).length > 200) return "too many aliases (max 200)";
    for (const [k, v] of Object.entries(aliases)) {
      if (typeof k !== "string" || k.length > 64) return `alias key "${k}" is too long`;
      if (typeof v !== "string" || v.length > 64) return `alias value for "${k}" is invalid`;
    }
  }

  // automod — basic shape check
  if (d["automod"] !== undefined) {
    if (typeof d["automod"] !== "object" || Array.isArray(d["automod"])) return "automod must be an object";
    const am = d["automod"] as Record<string, unknown>;
    if (am["filter"] && Array.isArray((am["filter"] as any)?.words)) {
      const words = (am["filter"] as any).words as unknown[];
      if (words.length > 500) return "automod filter has too many words (max 500)";
      for (const w of words) {
        if (typeof w !== "string" || w.length > 100) return "automod filter word is invalid or too long";
      }
    }
  }

  return null;
}
