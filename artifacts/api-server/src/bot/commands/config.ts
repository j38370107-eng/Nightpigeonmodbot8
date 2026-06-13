import {
  Message,
  PermissionFlagsBits,
  AttachmentBuilder,
} from "discord.js";
import { getRawYaml, setRawYaml, DEFAULT_CONFIG } from "../store/guildConfig";
import yaml from "js-yaml";
import { logger } from "../../lib/logger";

const HELP = `**config** — view or update this server's YAML configuration.

**View config:**
\`>config\`

**Update config:**
Attach a \`.yaml\` file to your message:
\`>config\` *(with .yaml attachment)*

Only server administrators can use this command.`;

export async function handleConfigCommand(message: Message): Promise<void> {
  if (!message.guild) return;

  const member = message.guild.members.cache.get(message.author.id)
    ?? await message.guild.members.fetch(message.author.id).catch(() => null);

  if (!member?.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ You need **Administrator** permission to use this command.");
    return;
  }

  const attachment = message.attachments.find(
    (a) => a.name?.endsWith(".yaml") || a.name?.endsWith(".yml")
  );

  // ── Upload new config ─────────────────────────────────────────────────────
  if (attachment) {
    try {
      const response = await fetch(attachment.url);
      const rawYaml = await response.text();

      // Validate YAML
      const parsed = yaml.load(rawYaml);
      if (!parsed || typeof parsed !== "object") {
        await message.reply("❌ Invalid YAML: must be a mapping (key: value) at the top level.");
        return;
      }

      await setRawYaml(message.guild.id, rawYaml);
      await message.reply("✅ Config saved! Changes take effect immediately.");
      logger.info({ guildId: message.guild.id, user: message.author.tag }, "Config updated via command");
    } catch (e: any) {
      const msg = e instanceof yaml.YAMLException ? e.message : String(e);
      await message.reply(`❌ Failed to save config: ${msg}`);
    }
    return;
  }

  // ── Show current config ───────────────────────────────────────────────────
  try {
    const raw = await getRawYaml(message.guild.id);
    const content = raw?.trim()
      ? raw
      : yaml.dump(DEFAULT_CONFIG, { indent: 2, lineWidth: 120 });

    const file = new AttachmentBuilder(Buffer.from(content, "utf-8"), {
      name: `config-${message.guild.id}.yaml`,
    });

    await message.reply({
      content: `📄 Current config for **${message.guild.name}**. Edit and re-attach to update.`,
      files: [file],
    });
  } catch (e: any) {
    await message.reply(`❌ Failed to fetch config: ${e.message}`);
  }
}
