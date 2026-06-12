import {
  Client,
  GuildMember,
  TextChannel,
  EmbedBuilder,
  PermissionOverwriteResolvable,
  AuditLogEvent,
} from "discord.js";
import { getAntiRaid } from "../store/antiraid";
import { sendSecurityLog } from "../lib/securityLog";
import { logger } from "../../lib/logger";

// ── Per-guild join tracking ───────────────────────────────────────────────────
const joinLog = new Map<
  string,
  {
    userId: string;
    userTag: string;
    joinedAt: number;
    accountCreatedAt: number;
    hasAvatar: boolean;
    suspiciousSignals: number;
  }[]
>();
const raidActive = new Set<string>();

// ── Account age helpers ───────────────────────────────────────────────────────
function accountAgeDays(member: GuildMember): number {
  return (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
}

// ── Default username detection ────────────────────────────────────────────────
// Discord generates usernames like "user123456789" for migrated accounts
// Also catches the old "User#0000" pattern and very generic placeholders
const DEFAULT_USERNAME_PATTERNS = [
  /^user\d{6,}$/i,
  /^discord_user\d*/i,
  /^new_user\d*/i,
];

function isDefaultUsername(username: string): boolean {
  return DEFAULT_USERNAME_PATTERNS.some((p) => p.test(username));
}

// ── Username filter check ─────────────────────────────────────────────────────
function matchesUsernameFilter(username: string, patterns: string[]): boolean {
  const lower = username.toLowerCase();
  return patterns.some((p) => {
    try {
      return new RegExp(p, "i").test(username);
    } catch {
      return lower.includes(p.toLowerCase());
    }
  });
}

// ── Count suspicious signals for a member ────────────────────────────────────
function countSignals(
  member: GuildMember,
  ageDays: number,
  cfg: ReturnType<typeof getAntiRaid>,
): number {
  let signals = 0;
  if (cfg.newAccountEnabled && ageDays < cfg.newAccountAgeDays) signals++;
  if (!member.user.avatar) signals++;
  if (isDefaultUsername(member.user.username)) signals++;
  if (
    cfg.usernameFilterEnabled &&
    cfg.usernameFilterPatterns.length > 0 &&
    matchesUsernameFilter(member.user.username, cfg.usernameFilterPatterns)
  )
    signals++;
  return signals;
}

async function dmOwner(
  client: Client,
  member: GuildMember,
  title: string,
  description: string,
): Promise<void> {
  try {
    const owner = await client.users
      .fetch(member.guild.ownerId)
      .catch(() => null);
    if (!owner) return;
    await owner
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle(`🚨 Anti-Raid Alert — ${member.guild.name}`)
            .setDescription(`**${title}**\n\n${description}`)
            .setTimestamp(),
        ],
      })
      .catch(() => {});
  } catch {
    /* dm failed */
  }
}

// ── Apply a NewAccountAction to a member ─────────────────────────────────────
async function applyAction(
  client: Client,
  member: GuildMember,
  action: import("../store/antiraid").NewAccountAction,
  reason: string,
  logTitle: string,
  logColor: number,
  extraFields: { name: string; value: string; inline?: boolean }[],
): Promise<void> {
  const cfg = getAntiRaid(member.guild.id);

  // DM the member before actioning (not for flag/alert)
  if (action === "timeout" || action === "kick" || action === "ban") {
    const actionLabel =
      action === "timeout" ? "timed out in" : action === "kick" ? "kicked from" : "banned from";
    await member.user
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle(`🛡️ Anti-Raid Action — ${member.guild.name}`)
            .setDescription(
              `You have been **${actionLabel}** **${member.guild.name}** because the anti-raid system flagged your account.`,
            )
            .addFields(
              { name: "Action", value: `\`${action}\``, inline: true },
              { name: "Reason", value: reason },
            )
            .setTimestamp(),
        ],
      })
      .catch(() => {});
  }

  // Execute the action (flag = alert-only, handled by the log below)
  if (action === "timeout") {
    await member.timeout(60 * 60 * 1000, reason).catch(() => {});
  } else if (action === "kick") {
    await member.kick(reason).catch(() => {});
  } else if (action === "ban") {
    await member.ban({ reason, deleteMessageSeconds: 604800 }).catch(() => {});
  }

  // Send a single log — prefer dedicated antiraid channel, fall back to modlog channel
  const logChannelId = cfg.alertChannelId ?? cfg.logChannel;
  await sendSecurityLog(client, member.guild.id, logChannelId, {
    title: logTitle,
    color: logColor,
    fields: [
      {
        name: "User",
        value: `<@${member.id}> (${member.user.tag})`,
        inline: true,
      },
      {
        name: "Action",
        value: action === "flag" ? "🚩 Flagged (alert only)" : action,
        inline: true,
      },
      ...extraFields,
    ],
  });
}

// ── Execute raid response based on actionLevel ────────────────────────────────
async function executeRaidResponse(
  client: Client,
  member: GuildMember,
  raiders: { userId: string; userTag: string }[],
  reason: string,
): Promise<{ punished: string[]; failed: string[] }> {
  const cfg = getAntiRaid(member.guild.id);
  const level = cfg.actionLevel;
  const punished: string[] = [];
  const failed: string[] = [];

  if (level === 1) return { punished: [], failed: [] };

  for (const { userId, userTag } of raiders) {
    try {
      const raider = await member.guild.members
        .fetch(userId)
        .catch(() => null);
      if (!raider) continue;

      const actionDesc =
        level === 4
          ? "been banned from"
          : level === 3
            ? "been kicked from"
            : "been timed out in";

      const dmEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle(`🚨 Anti-Raid Action — ${member.guild.name}`)
        .setDescription(
          `You have ${actionDesc} **${member.guild.name}** because the anti-raid system detected a mass-join raid and your account was flagged.`,
        )
        .addFields(
          { name: "Action Level", value: `Level ${level}`, inline: true },
          { name: "Raid Size", value: `${raiders.length} joins`, inline: true },
          { name: "Reason", value: reason },
        )
        .setTimestamp();
      await raider.user.send({ embeds: [dmEmbed] }).catch(() => {});

      if (level === 4) {
        await member.guild.members.ban(userId, { reason, deleteMessageSeconds: 604800 });
      } else if (level === 3) {
        await raider.kick(reason);
      } else if (level === 2) {
        await raider.timeout(60 * 60 * 1000, reason);
      }

      punished.push(`<@${userId}> (${userTag})`);
    } catch {
      failed.push(userId);
    }
  }

  return { punished, failed };
}

// ── Handle individual new-account join ───────────────────────────────────────
async function handleNewAccountJoin(
  client: Client,
  member: GuildMember,
): Promise<boolean> {
  const cfg = getAntiRaid(member.guild.id);
  if (!cfg.newAccountEnabled) return false;

  const ageDays = accountAgeDays(member);
  if (ageDays >= cfg.newAccountAgeDays) return false;

  const roleIds = [...member.roles.cache.keys()];
  if (cfg.whitelist.includes(member.id)) return false;
  if (cfg.whitelistRoles.some((r) => roleIds.includes(r))) return false;

  const ageFmt =
    ageDays < 1
      ? `${Math.floor(ageDays * 24)}h old`
      : `${ageDays.toFixed(1)} days old`;

  const reason = `Anti-Raid: New account (${ageFmt}) — threshold: ${cfg.newAccountAgeDays}d`;
  logger.warn({ guildId: member.guild.id, userId: member.id, ageDays }, "New account flagged");

  await applyAction(
    client,
    member,
    cfg.newAccountAction,
    reason,
    cfg.newAccountAction === "flag"
      ? "⚠️ Anti-Raid — New Account Joined"
      : "🚨 Anti-Raid — New Account Actioned",
    cfg.newAccountAction === "flag" ? 0xf39c12 : 0xe74c3c,
    [{ name: "Account Age", value: ageFmt, inline: true }],
  );
  return true;
}

// ── Handle no-avatar filter ───────────────────────────────────────────────────
async function handleNoAvatarJoin(
  client: Client,
  member: GuildMember,
): Promise<boolean> {
  const cfg = getAntiRaid(member.guild.id);
  if (!cfg.noAvatarEnabled) return false;
  if (member.user.avatar) return false;

  const roleIds = [...member.roles.cache.keys()];
  if (cfg.whitelist.includes(member.id)) return false;
  if (cfg.whitelistRoles.some((r) => roleIds.includes(r))) return false;

  logger.warn({ guildId: member.guild.id, userId: member.id }, "No-avatar join flagged");

  await applyAction(
    client,
    member,
    cfg.noAvatarAction,
    `Anti-Raid: Account has no profile picture`,
    cfg.noAvatarAction === "flag"
      ? "⚠️ Anti-Raid — No Avatar Account"
      : "🚨 Anti-Raid — No Avatar Account Actioned",
    cfg.noAvatarAction === "flag" ? 0xf39c12 : 0xe74c3c,
    [{ name: "Avatar", value: "None (default)", inline: true }],
  );
  return true;
}

// ── Handle default username filter ────────────────────────────────────────────
async function handleDefaultUsernameJoin(
  client: Client,
  member: GuildMember,
): Promise<boolean> {
  const cfg = getAntiRaid(member.guild.id);
  if (!cfg.defaultUsernameEnabled) return false;
  if (!isDefaultUsername(member.user.username)) return false;

  const roleIds = [...member.roles.cache.keys()];
  if (cfg.whitelist.includes(member.id)) return false;
  if (cfg.whitelistRoles.some((r) => roleIds.includes(r))) return false;

  logger.warn({ guildId: member.guild.id, userId: member.id, username: member.user.username }, "Default username flagged");

  await applyAction(
    client,
    member,
    cfg.defaultUsernameAction,
    `Anti-Raid: Account has a default/auto-generated username`,
    cfg.defaultUsernameAction === "flag"
      ? "⚠️ Anti-Raid — Default Username"
      : "🚨 Anti-Raid — Default Username Actioned",
    cfg.defaultUsernameAction === "flag" ? 0xf39c12 : 0xe74c3c,
    [{ name: "Username", value: member.user.username, inline: true }],
  );
  return true;
}

// ── Handle custom username filter ─────────────────────────────────────────────
async function handleUsernameFilterJoin(
  client: Client,
  member: GuildMember,
): Promise<boolean> {
  const cfg = getAntiRaid(member.guild.id);
  if (!cfg.usernameFilterEnabled || cfg.usernameFilterPatterns.length === 0) return false;
  if (!matchesUsernameFilter(member.user.username, cfg.usernameFilterPatterns)) return false;

  const roleIds = [...member.roles.cache.keys()];
  if (cfg.whitelist.includes(member.id)) return false;
  if (cfg.whitelistRoles.some((r) => roleIds.includes(r))) return false;

  logger.warn({ guildId: member.guild.id, userId: member.id, username: member.user.username }, "Username filter triggered");

  await applyAction(
    client,
    member,
    cfg.usernameFilterAction,
    `Anti-Raid: Username matches a blocked pattern`,
    cfg.usernameFilterAction === "flag"
      ? "⚠️ Anti-Raid — Username Filter Match"
      : "🚨 Anti-Raid — Username Filter Match Actioned",
    cfg.usernameFilterAction === "flag" ? 0xf39c12 : 0xe74c3c,
    [{ name: "Username", value: member.user.username, inline: true }],
  );
  return true;
}

// ── Handle suspicious account detection ──────────────────────────────────────
async function handleSuspiciousJoin(
  client: Client,
  member: GuildMember,
): Promise<void> {
  const cfg = getAntiRaid(member.guild.id);
  if (!cfg.suspiciousEnabled) return;

  const roleIds = [...member.roles.cache.keys()];
  if (cfg.whitelist.includes(member.id)) return;
  if (cfg.whitelistRoles.some((r) => roleIds.includes(r))) return;

  const ageDays = accountAgeDays(member);
  const signals = countSignals(member, ageDays, cfg);

  if (signals < cfg.suspiciousThreshold) return;

  const signalList: string[] = [];
  if (ageDays < cfg.newAccountAgeDays) {
    const ageFmt = ageDays < 1 ? `${Math.floor(ageDays * 24)}h old` : `${ageDays.toFixed(1)}d old`;
    signalList.push(`New account (${ageFmt})`);
  }
  if (!member.user.avatar) signalList.push("No profile picture");
  if (isDefaultUsername(member.user.username)) signalList.push("Default username");
  if (cfg.usernameFilterEnabled && matchesUsernameFilter(member.user.username, cfg.usernameFilterPatterns)) {
    signalList.push("Username matches filter");
  }

  logger.warn({ guildId: member.guild.id, userId: member.id, signals, signalList }, "Suspicious account detected");

  await applyAction(
    client,
    member,
    cfg.suspiciousAction,
    `Anti-Raid: Account scored ${signals}/${cfg.suspiciousThreshold} suspicious signals`,
    cfg.suspiciousAction === "flag"
      ? "⚠️ Anti-Raid — Suspicious Account"
      : "🚨 Anti-Raid — Suspicious Account Actioned",
    cfg.suspiciousAction === "flag" ? 0xf39c12 : 0xe74c3c,
    [
      { name: "Signals", value: `${signals}/${cfg.suspiciousThreshold}`, inline: true },
      { name: "Reasons", value: signalList.join(", ") || "N/A", inline: false },
    ],
  );
}

// ── Handle unauthorized bot additions ────────────────────────────────────────
async function handleBotAdd(client: Client, member: GuildMember): Promise<void> {
  if (!member.user.bot) return;

  const cfg = getAntiRaid(member.guild.id);
  if (!cfg.botGuardEnabled) return;

  // Check if this bot is on the always-allowed list
  if (cfg.botGuardAllowedBots.includes(member.id)) return;

  // Fetch the audit log to find who added the bot
  let adderId: string | null = null;
  let adderTag = "Unknown";
  try {
    const logs = await member.guild.fetchAuditLogs({
      type: AuditLogEvent.BotAdd,
      limit: 5,
    });
    const entry = logs.entries.find((e) => e.target?.id === member.id);
    if (entry?.executor) {
      adderId = entry.executor.id;
      adderTag = entry.executor.tag;
    }
  } catch {
    /* no audit log access */
  }

  // If the adder is the owner or is whitelisted, allow
  if (adderId) {
    if (adderId === member.guild.ownerId) return;
    if (cfg.whitelist.includes(adderId)) return;
    try {
      const adderMember = member.guild.members.cache.get(adderId);
      const adderRoles = adderMember ? [...adderMember.roles.cache.keys()] : [];
      if (cfg.whitelistRoles.some((r) => adderRoles.includes(r))) return;
    } catch { /* cache miss */ }
  }

  logger.warn(
    { guildId: member.guild.id, botId: member.id, adderId },
    "Unauthorized bot addition detected",
  );

  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: "Bot", value: `<@${member.id}> (${member.user.tag})`, inline: true },
    { name: "Bot ID", value: member.id, inline: true },
    { name: "Added By", value: adderId ? `<@${adderId}> (${adderTag})` : "Unknown", inline: true },
  ];

  // Kick the unauthorized bot
  if (cfg.botGuardRemoveBot) {
    await member.kick("Anti-Raid: Unauthorized bot addition").catch(() => {});
    fields.push({ name: "Bot Action", value: "Kicked", inline: true });
  }

  // Punish the adder
  if (cfg.botGuardPunishAdder && adderId && adderId !== member.guild.ownerId) {
    try {
      const adderMember = await member.guild.members.fetch(adderId).catch(() => null);
      const action = cfg.botGuardAdderAction;
      const reason = "Anti-Raid: Added an unauthorized bot to the server";

      if (action === "ban") {
        await member.guild.members.ban(adderId, { reason, deleteMessageSeconds: 604800 });
      } else if (action === "kick" && adderMember) {
        await adderMember.kick(reason);
      } else if (action === "strip" && adderMember) {
        const roles = adderMember.roles.cache
          .filter((r) => r.id !== member.guild.id && !r.managed)
          .map((r) => r.id);
        await adderMember.roles.remove(roles, reason);
      } else if (action === "flag") {
        // Alert only — no extra action needed
      }

      fields.push({ name: "Adder Action", value: action === "flag" ? "Flagged (alert only)" : action, inline: true });
    } catch {
      /* punishment failed */
    }
  }

  await sendSecurityLog(client, member.guild.id, cfg.logChannel, {
    title: "🚨 Anti-Raid — Unauthorized Bot Added",
    color: 0xe74c3c,
    fields,
  });

  // DM the owner
  const owner = await client.users.fetch(member.guild.ownerId).catch(() => null);
  if (owner) {
    await owner
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle(`🚨 Unauthorized Bot Detected — ${member.guild.name}`)
            .setDescription(
              `Bot **${member.user.tag}** (<@${member.id}>) was added by ${adderId ? `<@${adderId}> (${adderTag})` : "an unknown user"} without authorization.\n\nOnly whitelisted users are permitted to add bots.`,
            )
            .setTimestamp(),
        ],
      })
      .catch(() => {});
  }
}

// ── Registration ──────────────────────────────────────────────────────────────
export function registerAntiRaidEvents(client: Client) {
  client.on("guildMemberAdd", async (member: GuildMember) => {
    const cfg = getAntiRaid(member.guild.id);

    // Bot guard — runs independently of the global enabled flag
    if (member.user.bot) {
      if (cfg.botGuardEnabled) {
        await handleBotAdd(client, member).catch((err) =>
          logger.error({ err }, "Bot guard check failed"),
        );
      }
      return;
    }

    // Individual join checks — each checks its own enabled flag internally.
    // These run regardless of cfg.enabled so features like newAccount/noAvatar
    // work even when mass-join (raid) detection is turned off.
    Promise.all([
      handleNewAccountJoin(client, member),
      handleNoAvatarJoin(client, member),
      handleDefaultUsernameJoin(client, member),
      handleUsernameFilterJoin(client, member),
      handleSuspiciousJoin(client, member),
    ]).catch((err) =>
      logger.error({ err }, "Anti-raid individual join checks failed"),
    );

    // Mass-join (raid) detection — requires global enabled flag
    if (!cfg.enabled) return;

    const guildId = member.guild.id;
    const now = Date.now();

    // Compute suspicious signals for scope filtering
    const ageDays = accountAgeDays(member);
    const signals = countSignals(member, ageDays, cfg);
    const isSuspicious = signals > 0;

    // In "suspicious" scope mode, only count suspicious-signal accounts toward the raid threshold
    if (cfg.joinScope === "suspicious" && !isSuspicious) return;

    // Record join for mass-join detection
    const joins = (joinLog.get(guildId) ?? []).filter(
      (j) => now - j.joinedAt < cfg.joinWindowMs,
    );
    joins.push({
      userId: member.id,
      userTag: member.user.tag,
      joinedAt: now,
      accountCreatedAt: member.user.createdTimestamp,
      hasAvatar: !!member.user.avatar,
      suspiciousSignals: signals,
    });
    joinLog.set(guildId, joins);

    if (joins.length < cfg.joinThreshold) return;
    if (raidActive.has(guildId)) return;

    // ── Raid detected ──────────────────────────────────────────────────────
    raidActive.add(guildId);
    const raidJoins = [...joins];
    joinLog.set(guildId, []);

    logger.warn(
      { guildId, count: raidJoins.length, level: cfg.actionLevel },
      "Raid detected",
    );

    const reason = `Anti-Raid (Level ${cfg.actionLevel}): ${raidJoins.length} joins in ${cfg.joinWindowMs / 1000}s`;

    const { punished, failed } = await executeRaidResponse(client, member, raidJoins, reason);

    const levelDesc: Record<number, string> = {
      1: "Alert only",
      2: "Timed out",
      3: "Kicked",
      4: "Banned + Lockdown",
    };

    const fields: { name: string; value: string; inline?: boolean }[] = [
      {
        name: "Action Level",
        value: `**Level ${cfg.actionLevel}** — ${levelDesc[cfg.actionLevel]}`,
        inline: true,
      },
      {
        name: "Raiders Detected",
        value: `${raidJoins.length}`,
        inline: true,
      },
      {
        name: "Window",
        value: `${cfg.joinWindowMs / 1000}s`,
        inline: true,
      },
    ];

    if (punished.length > 0) {
      fields.push({
        name: `Actioned (${punished.length})`,
        value:
          punished.slice(0, 10).join("\n") +
          (punished.length > 10 ? `\n…+${punished.length - 10} more` : ""),
      });
    }

    if (failed.length > 0) {
      fields.push({
        name: `Failed (${failed.length})`,
        value: failed.map((id) => `<@${id}>`).join(", "),
      });
    }

    // Breakdown by suspicious signals
    const suspicious = raidJoins.filter((j) => j.suspiciousSignals > 0);
    const noAvatarCount = raidJoins.filter((j) => !j.hasAvatar).length;
    const newAccCount = raidJoins.filter((j) => {
      const ageDays = (Date.now() - j.accountCreatedAt) / (1000 * 60 * 60 * 24);
      return ageDays < 7;
    }).length;

    if (suspicious.length > 0) {
      fields.push({
        name: `Suspicious Accounts — ${suspicious.length}`,
        value: [
          noAvatarCount > 0 ? `🚫 No avatar: **${noAvatarCount}**` : null,
          newAccCount > 0 ? `🆕 New accounts (< 7d): **${newAccCount}**` : null,
        ]
          .filter(Boolean)
          .join("\n") || `${suspicious.length} accounts flagged`,
      });
    }

    await sendSecurityLog(client, guildId, cfg.logChannel, {
      title: `🚨 Anti-Raid — Raid Detected (Level ${cfg.actionLevel})`,
      color: 0xe74c3c,
      fields,
    });

    await dmOwner(
      client,
      member,
      `Raid detected — ${raidJoins.length} joins in ${cfg.joinWindowMs / 1000}s`,
      `**Action level:** ${cfg.actionLevel} — ${levelDesc[cfg.actionLevel]}\n**Actioned:** ${punished.length} users\n${lockedChannels.length > 0 ? `**Channels locked:** ${lockedChannels.length}` : ""}`,
    );

    setTimeout(() => raidActive.delete(guildId), 30_000);
  });
}
