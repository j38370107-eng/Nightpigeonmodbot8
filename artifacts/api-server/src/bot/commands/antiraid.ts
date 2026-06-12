import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import {
  getAntiRaid,
  updateAntiRaid,
  NewAccountAction,
  BotGuardAdderAction,
} from "../store/antiraid";

const VALID_LEVELS = [1, 2, 3, 4] as const;
const VALID_NA_ACTS: NewAccountAction[] = ["flag", "timeout", "kick", "ban"];
const VALID_BG_ADDER_ACTS: BotGuardAdderAction[] = ["flag", "kick", "ban", "strip"];

export const antiraidCommand: Command = {
  name: "antiraid",
  aliases: ["ar", "raid"],
  description: "Configure the anti-raid protection system",
  usage:
    "enable | disable | status | level <1-4> | threshold <count> | window <secs> | scope <all|suspicious> | lockdown <on|off> | " +
    "newaccount <enable|disable|age <days>|action <flag|timeout|kick|ban>> | " +
    "noavatar <enable|disable|action <flag|timeout|kick|ban>> | " +
    "defaultusername <enable|disable|action <flag|timeout|kick|ban>> | " +
    "usernamefilter <enable|disable|add <pattern>|remove <pattern>|list|action <flag|timeout|kick|ban>> | " +
    "suspicious <enable|disable|threshold <1-4>|action <flag|timeout|kick|ban>> | " +
    "botguard <enable|disable|removebot <on|off>|punishadder <on|off>|adderaction <flag|kick|ban|strip>|allowbot <add|remove|list> [botID]> | " +
    "whitelist <add|remove|list> [@user|@role] | logchannel <#ch|clear>",
  requiredPermissions: [PermissionFlagsBits.Administrator],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const baseUrl =
      process.env["DASHBOARD_URL"] ?? "https://utilitypulse-dashboard-pzu9.onrender.com";
    const dashUrl = `${baseUrl}/dashboard/${message.guild.id}/antiraid`;

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("🛡️ Anti-Raid — Use the Dashboard")
          .setDescription(
            `Anti-Raid settings are managed through the **web dashboard**.\n\n[**Open Anti-Raid Dashboard →**](${dashUrl})\n\`${dashUrl}\``,
          )
          .addFields({
            name: "What you can configure there",
            value: [
              "🟢 Enable / disable raid protection",
              "⚡ Action levels 1–4 (alert → ban + lockdown)",
              "👤 New account, no-avatar & username filters",
              "🔤 Custom username pattern filter",
              "🤖 Bot guard — control who can add bots",
              "📋 Suspicious account detection",
              "✅ User & role whitelist",
              "📢 Alert log channel",
            ].join("\n"),
          })
          .setFooter({ text: "Only the server owner or whitelisted users can edit Anti-Raid settings" })
          .setTimestamp(),
      ],
    });

    // ── dead code below preserved for reference ────────────────────────────
    const guildId = message.guild.id;
    const sub = args[0]?.toLowerCase();

    // ── enable / disable ──────────────────────────────────────────────────
    if (sub === "enable" || sub === "on") {
      updateAntiRaid(guildId, { enabled: true });
      return message.reply("✅ Anti-Raid protection **enabled**.");
    }
    if (sub === "disable" || sub === "off") {
      updateAntiRaid(guildId, { enabled: false });
      return message.reply("✅ Anti-Raid protection **disabled**.");
    }

    // ── action level ──────────────────────────────────────────────────────
    if (sub === "level") {
      const level = parseInt(args[1] ?? "", 10) as 1 | 2 | 3 | 4;
      if (!VALID_LEVELS.includes(level)) {
        return message.reply(usageErr(message, antiraidCommand, "Level must be 1, 2, 3, or 4"));
      }
      updateAntiRaid(guildId, { actionLevel: level });
      const desc: Record<number, string> = {
        1: "Alert only (log + DM owner)",
        2: "Timeout all raid joiners (1h)",
        3: "Kick all raid joiners",
        4: "Ban all + auto-lockdown",
      };
      return message.reply(`✅ Anti-Raid level set to **Level ${level}** — ${desc[level]}`);
    }

    // ── threshold ─────────────────────────────────────────────────────────
    if (sub === "threshold") {
      const count = parseInt(args[1] ?? "", 10);
      if (isNaN(count) || count < 2 || count > 100) {
        return message.reply("❌ Threshold must be between 2 and 100.");
      }
      updateAntiRaid(guildId, { joinThreshold: count });
      return message.reply(`✅ Raid threshold set to **${count} joins**.`);
    }

    // ── window ────────────────────────────────────────────────────────────
    if (sub === "window") {
      const secs = parseInt(args[1] ?? "", 10);
      if (isNaN(secs) || secs < 1 || secs > 120) {
        return message.reply("❌ Window must be between 1 and 120 seconds.");
      }
      updateAntiRaid(guildId, { joinWindowMs: secs * 1000 });
      return message.reply(`✅ Detection window set to **${secs}s**.`);
    }

    // ── scope ─────────────────────────────────────────────────────────────
    if (sub === "scope") {
      const val = args[1]?.toLowerCase();
      if (val !== "all" && val !== "suspicious") {
        return message.reply(usageErr(message, antiraidCommand, "Specify `all` or `suspicious`"));
      }
      updateAntiRaid(guildId, { joinScope: val });
      const desc =
        val === "all"
          ? "Every join counts toward the raid threshold."
          : "Only joins that have at least one suspicious signal count toward the raid threshold.";
      return message.reply(`✅ Join scope set to **${val}** — ${desc}`);
    }

    // ── lockdown ──────────────────────────────────────────────────────────
    if (sub === "lockdown") {
      const toggle = args[1]?.toLowerCase();
      if (toggle !== "on" && toggle !== "off") {
        return message.reply(usageErr(message, antiraidCommand, "Specify on or off"));
      }
      updateAntiRaid(guildId, { lockdown: toggle === "on" });
      return message.reply(
        toggle === "on"
          ? "✅ Auto-lockdown on raid **enabled** (also activates at Level 4)."
          : "✅ Auto-lockdown **disabled**.",
      );
    }

    // ── newaccount ────────────────────────────────────────────────────────
    if (sub === "newaccount") {
      const naSub = args[1]?.toLowerCase();
      if (naSub === "enable") {
        updateAntiRaid(guildId, { newAccountEnabled: true });
        return message.reply("✅ New account detection **enabled**.");
      }
      if (naSub === "disable") {
        updateAntiRaid(guildId, { newAccountEnabled: false });
        return message.reply("✅ New account detection **disabled**.");
      }
      if (naSub === "age") {
        const days = parseInt(args[2] ?? "", 10);
        if (isNaN(days) || days < 1 || days > 365) {
          return message.reply("❌ Age must be between 1 and 365 days.");
        }
        updateAntiRaid(guildId, { newAccountAgeDays: days });
        return message.reply(`✅ Accounts younger than **${days} days** will be flagged.`);
      }
      if (naSub === "action") {
        const act = args[2]?.toLowerCase() as NewAccountAction;
        if (!VALID_NA_ACTS.includes(act)) {
          return message.reply(
            usageErr(message, antiraidCommand, `Action must be: ${VALID_NA_ACTS.join(", ")}`),
          );
        }
        updateAntiRaid(guildId, { newAccountAction: act });
        return message.reply(`✅ New account action set to **${act}**.`);
      }
      return message.reply(
        usageErr(message, antiraidCommand, "Usage: newaccount <enable|disable|age <days>|action <flag|timeout|kick|ban>>"),
      );
    }

    // ── noavatar ──────────────────────────────────────────────────────────
    if (sub === "noavatar") {
      const naSub = args[1]?.toLowerCase();
      if (naSub === "enable") {
        updateAntiRaid(guildId, { noAvatarEnabled: true });
        return message.reply("✅ No-avatar filter **enabled**. Accounts without a profile picture will be flagged.");
      }
      if (naSub === "disable") {
        updateAntiRaid(guildId, { noAvatarEnabled: false });
        return message.reply("✅ No-avatar filter **disabled**.");
      }
      if (naSub === "action") {
        const act = args[2]?.toLowerCase() as NewAccountAction;
        if (!VALID_NA_ACTS.includes(act)) {
          return message.reply(
            usageErr(message, antiraidCommand, `Action must be: ${VALID_NA_ACTS.join(", ")}`),
          );
        }
        updateAntiRaid(guildId, { noAvatarAction: act });
        return message.reply(`✅ No-avatar action set to **${act}**.`);
      }
      const cfg = getAntiRaid(guildId);
      return message.reply(
        `**No-Avatar Filter:** ${cfg.noAvatarEnabled ? "✅ Enabled" : "❌ Disabled"} — Action: \`${cfg.noAvatarAction}\`\n` +
          `Usage: \`noavatar <enable|disable|action <flag|timeout|kick|ban>>\``,
      );
    }

    // ── defaultusername ───────────────────────────────────────────────────
    if (sub === "defaultusername") {
      const dSub = args[1]?.toLowerCase();
      if (dSub === "enable") {
        updateAntiRaid(guildId, { defaultUsernameEnabled: true });
        return message.reply("✅ Default username filter **enabled**.");
      }
      if (dSub === "disable") {
        updateAntiRaid(guildId, { defaultUsernameEnabled: false });
        return message.reply("✅ Default username filter **disabled**.");
      }
      if (dSub === "action") {
        const act = args[2]?.toLowerCase() as NewAccountAction;
        if (!VALID_NA_ACTS.includes(act)) {
          return message.reply(
            usageErr(message, antiraidCommand, `Action must be: ${VALID_NA_ACTS.join(", ")}`),
          );
        }
        updateAntiRaid(guildId, { defaultUsernameAction: act });
        return message.reply(`✅ Default username action set to **${act}**.`);
      }
      const cfg = getAntiRaid(guildId);
      return message.reply(
        `**Default Username Filter:** ${cfg.defaultUsernameEnabled ? "✅ Enabled" : "❌ Disabled"} — Action: \`${cfg.defaultUsernameAction}\`\n` +
          `Catches Discord auto-generated usernames (e.g. \`user123456789\`).\n` +
          `Usage: \`defaultusername <enable|disable|action <flag|timeout|kick|ban>>\``,
      );
    }

    // ── usernamefilter ────────────────────────────────────────────────────
    if (sub === "usernamefilter" || sub === "uf") {
      const ufSub = args[1]?.toLowerCase();
      const cfg = getAntiRaid(guildId);

      if (ufSub === "enable") {
        updateAntiRaid(guildId, { usernameFilterEnabled: true });
        return message.reply("✅ Username filter **enabled**.");
      }
      if (ufSub === "disable") {
        updateAntiRaid(guildId, { usernameFilterEnabled: false });
        return message.reply("✅ Username filter **disabled**.");
      }
      if (ufSub === "action") {
        const act = args[2]?.toLowerCase() as NewAccountAction;
        if (!VALID_NA_ACTS.includes(act)) {
          return message.reply(
            usageErr(message, antiraidCommand, `Action must be: ${VALID_NA_ACTS.join(", ")}`),
          );
        }
        updateAntiRaid(guildId, { usernameFilterAction: act });
        return message.reply(`✅ Username filter action set to **${act}**.`);
      }
      if (ufSub === "add") {
        const pattern = args.slice(2).join(" ");
        if (!pattern) return message.reply("❌ Provide a pattern to add.");
        if (cfg.usernameFilterPatterns.includes(pattern)) return message.reply("❌ Pattern already exists.");
        updateAntiRaid(guildId, { usernameFilterPatterns: [...cfg.usernameFilterPatterns, pattern] });
        return message.reply(`✅ Pattern \`${pattern}\` added to username filter.`);
      }
      if (ufSub === "remove") {
        const pattern = args.slice(2).join(" ");
        if (!pattern) return message.reply("❌ Provide a pattern to remove.");
        const arr = cfg.usernameFilterPatterns.filter((p) => p !== pattern);
        if (arr.length === cfg.usernameFilterPatterns.length) return message.reply("❌ Pattern not found.");
        updateAntiRaid(guildId, { usernameFilterPatterns: arr });
        return message.reply(`✅ Pattern \`${pattern}\` removed.`);
      }
      if (ufSub === "list") {
        const list = cfg.usernameFilterPatterns.length
          ? cfg.usernameFilterPatterns.map((p, i) => `${i + 1}. \`${p}\``).join("\n")
          : "No patterns set.";
        return message.reply(
          `**Username Filter** — ${cfg.usernameFilterEnabled ? "✅ Enabled" : "❌ Disabled"} — Action: \`${cfg.usernameFilterAction}\`\n\n${list}`,
        );
      }
      return message.reply(
        usageErr(message, antiraidCommand, "Usage: usernamefilter <enable|disable|add <pattern>|remove <pattern>|list|action <act>>"),
      );
    }

    // ── suspicious ────────────────────────────────────────────────────────
    if (sub === "suspicious" || sub === "sus") {
      const sSub = args[1]?.toLowerCase();
      if (sSub === "enable") {
        updateAntiRaid(guildId, { suspiciousEnabled: true });
        return message.reply("✅ Suspicious account detection **enabled**.");
      }
      if (sSub === "disable") {
        updateAntiRaid(guildId, { suspiciousEnabled: false });
        return message.reply("✅ Suspicious account detection **disabled**.");
      }
      if (sSub === "threshold") {
        const t = parseInt(args[2] ?? "", 10);
        if (isNaN(t) || t < 1 || t > 4) {
          return message.reply("❌ Threshold must be between 1 and 4 (number of suspicious signals required).");
        }
        updateAntiRaid(guildId, { suspiciousThreshold: t });
        return message.reply(
          `✅ Suspicious threshold set to **${t}**.\nAn account needs ${t} signal(s) to be actioned:\n• New account\n• No avatar\n• Default username\n• Username matches filter`,
        );
      }
      if (sSub === "action") {
        const act = args[2]?.toLowerCase() as NewAccountAction;
        if (!VALID_NA_ACTS.includes(act)) {
          return message.reply(
            usageErr(message, antiraidCommand, `Action must be: ${VALID_NA_ACTS.join(", ")}`),
          );
        }
        updateAntiRaid(guildId, { suspiciousAction: act });
        return message.reply(`✅ Suspicious account action set to **${act}**.`);
      }
      const cfg = getAntiRaid(guildId);
      return message.reply(
        `**Suspicious Detection:** ${cfg.suspiciousEnabled ? "✅ Enabled" : "❌ Disabled"}\n` +
          `Threshold: **${cfg.suspiciousThreshold}** signal(s) required\n` +
          `Action: \`${cfg.suspiciousAction}\`\n\n` +
          `Signals tracked:\n• New account (age < ${cfg.newAccountAgeDays}d)\n• No profile picture\n• Default/auto-generated username\n• Username matches custom filter`,
      );
    }

    // ── botguard ──────────────────────────────────────────────────────────
    if (sub === "botguard" || sub === "bg") {
      const bgSub = args[1]?.toLowerCase();
      const cfg = getAntiRaid(guildId);

      if (bgSub === "enable") {
        updateAntiRaid(guildId, { botGuardEnabled: true });
        return message.reply(
          "✅ Bot Guard **enabled**. Only whitelisted users may add bots.\nUse `>antiraid whitelist add @user` to whitelist someone.",
        );
      }
      if (bgSub === "disable") {
        updateAntiRaid(guildId, { botGuardEnabled: false });
        return message.reply("✅ Bot Guard **disabled**.");
      }
      if (bgSub === "removebot") {
        const val = args[2]?.toLowerCase();
        if (val !== "on" && val !== "off") return message.reply(usageErr(message, antiraidCommand, "Specify on or off"));
        updateAntiRaid(guildId, { botGuardRemoveBot: val === "on" });
        return message.reply(`✅ Unauthorized bot auto-kick: **${val}**.`);
      }
      if (bgSub === "punishadder") {
        const val = args[2]?.toLowerCase();
        if (val !== "on" && val !== "off") return message.reply(usageErr(message, antiraidCommand, "Specify on or off"));
        updateAntiRaid(guildId, { botGuardPunishAdder: val === "on" });
        return message.reply(`✅ Punish unauthorized bot adder: **${val}**.`);
      }
      if (bgSub === "adderaction") {
        const act = args[2]?.toLowerCase() as BotGuardAdderAction;
        if (!VALID_BG_ADDER_ACTS.includes(act)) {
          return message.reply(
            usageErr(message, antiraidCommand, `Action must be: ${VALID_BG_ADDER_ACTS.join(", ")}`),
          );
        }
        updateAntiRaid(guildId, { botGuardAdderAction: act });
        return message.reply(`✅ Unauthorized bot adder action set to **${act}**.`);
      }
      if (bgSub === "allowbot") {
        const abSub = args[2]?.toLowerCase();
        const botId = args[3];

        if (abSub === "list") {
          const list = cfg.botGuardAllowedBots.length
            ? cfg.botGuardAllowedBots.map((id) => `<@${id}> (${id})`).join("\n")
            : "No bots in the always-allowed list.";
          return message.reply(`**Always-Allowed Bots:**\n${list}`);
        }
        if (!botId) return message.reply("❌ Provide a bot user ID.");
        if (abSub === "add") {
          if (cfg.botGuardAllowedBots.includes(botId)) return message.reply("❌ Already in allowed list.");
          updateAntiRaid(guildId, { botGuardAllowedBots: [...cfg.botGuardAllowedBots, botId] });
          return message.reply(`✅ Bot \`${botId}\` added to the always-allowed list.`);
        }
        if (abSub === "remove") {
          const arr = cfg.botGuardAllowedBots.filter((id) => id !== botId);
          if (arr.length === cfg.botGuardAllowedBots.length) return message.reply("❌ Not in list.");
          updateAntiRaid(guildId, { botGuardAllowedBots: arr });
          return message.reply(`✅ Bot \`${botId}\` removed from always-allowed list.`);
        }
        return message.reply(usageErr(message, antiraidCommand, "Usage: botguard allowbot <add|remove|list> [botID]"));
      }

      // Status
      return message.reply(
        new EmbedBuilder()
          .setColor(cfg.botGuardEnabled ? 0x2ecc71 : 0xe74c3c)
          .setTitle("🤖 Bot Guard Configuration")
          .addFields(
            { name: "Status", value: cfg.botGuardEnabled ? "✅ Enabled" : "❌ Disabled", inline: true },
            { name: "Remove Bot", value: cfg.botGuardRemoveBot ? "✅ Yes" : "❌ No", inline: true },
            { name: "Punish Adder", value: cfg.botGuardPunishAdder ? "✅ Yes" : "❌ No", inline: true },
            { name: "Adder Action", value: `\`${cfg.botGuardAdderAction}\``, inline: true },
            {
              name: `Always-Allowed Bots (${cfg.botGuardAllowedBots.length})`,
              value: cfg.botGuardAllowedBots.length
                ? cfg.botGuardAllowedBots.map((id) => `\`${id}\``).join(", ")
                : "None",
            },
            {
              name: "How It Works",
              value:
                "Only users in the Anti-Raid **whitelist** may add bots. " +
                "Anyone else who adds a bot will have the bot kicked and themselves actioned.",
            },
          )
          .setTimestamp(),
      );
    }

    // ── logchannel ────────────────────────────────────────────────────────
    if (sub === "logchannel") {
      if (args[1]?.toLowerCase() === "clear") {
        updateAntiRaid(guildId, { logChannel: undefined });
        return message.reply("✅ Anti-Raid log channel cleared.");
      }
      const ch =
        message.mentions.channels.first() ??
        (args[1] ? message.guild.channels.cache.get(args[1]) : null);
      if (!ch || !("send" in ch))
        return message.reply(usageErr(message, antiraidCommand, "Mention a valid text channel"));
      updateAntiRaid(guildId, { logChannel: ch.id });
      return message.reply(`✅ Logging to <#${ch.id}>.`);
    }

    // ── whitelist ─────────────────────────────────────────────────────────
    if (sub === "whitelist") {
      const wlSub = args[1]?.toLowerCase();
      const cfg = getAntiRaid(guildId);

      if (wlSub === "list") {
        const users = cfg.whitelist.length ? cfg.whitelist.map((id) => `<@${id}>`).join(", ") : "None";
        const roles = cfg.whitelistRoles.length ? cfg.whitelistRoles.map((id) => `<@&${id}>`).join(", ") : "None";
        return message.reply(`**Whitelisted users:** ${users}\n**Whitelisted roles:** ${roles}\n\n*Whitelisted users may also add bots when Bot Guard is enabled.*`);
      }

      const target =
        message.mentions.users.first()?.id ??
        message.mentions.roles.first()?.id ??
        args[2];
      const isRole = !!message.mentions.roles.first();
      if (!target) return message.reply(usageErr(message, antiraidCommand, "Mention a user/role or provide their ID"));

      if (wlSub === "add") {
        if (isRole) {
          if (cfg.whitelistRoles.includes(target)) return message.reply("❌ Already whitelisted.");
          updateAntiRaid(guildId, { whitelistRoles: [...cfg.whitelistRoles, target] });
          return message.reply(`✅ <@&${target}> added to the role whitelist.`);
        } else {
          if (cfg.whitelist.includes(target)) return message.reply("❌ Already whitelisted.");
          updateAntiRaid(guildId, { whitelist: [...cfg.whitelist, target] });
          return message.reply(`✅ <@${target}> whitelisted from Anti-Raid.`);
        }
      }
      if (wlSub === "remove") {
        if (isRole) {
          const arr = cfg.whitelistRoles.filter((r) => r !== target);
          updateAntiRaid(guildId, { whitelistRoles: arr });
          return message.reply(`✅ <@&${target}> removed from role whitelist.`);
        } else {
          const arr = cfg.whitelist.filter((r) => r !== target);
          updateAntiRaid(guildId, { whitelist: arr });
          return message.reply(`✅ <@${target}> removed from whitelist.`);
        }
      }
      return message.reply(usageErr(message, antiraidCommand, "Usage: whitelist <add|remove|list> [@user|@role]"));
    }

  },
};
