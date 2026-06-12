import { Client, Events, Message, PartialMessage } from "discord.js";
import { getAutomodConfig, refreshAutomodForGuild } from "../store/automod";
import { sendModLog } from "../lib/modlog";
import { addInfraction } from "../store/infractions";
import { applyAutoPunishment } from "../lib/applyAutoPunishment";
import { sendDmNotification } from "../lib/dmNotify";
import { getAdditionalInfo } from "../store/additionalInfo";
import { getAutomodWarnExpiry } from "../store/expiry";
import { memberHasProtectedRole } from "../store/protectedRoles";
import { logger } from "../../lib/logger";

interface CachedMsg {
  guildId:           string;
  authorId:          string;
  authorTag:         string;
  channelId:         string;
  channelName:       string;
  mentionedUserIds:  string[];
  mentionedRoleIds:  string[];
  mentionedEveryone: boolean;
  memberRoleIds:     string[];
  ts:                number;
}

const CACHE_TTL_MS = 60_000;
const msgCache = new Map<string, CachedMsg>();

// Per-guild timestamp of last DB config refresh (used at delete time)
const lastCfgRefresh = new Map<string, number>();
const CFG_REFRESH_INTERVAL_MS = 5_000;

async function getLatestGhostPingEnabled(guildId: string): Promise<boolean> {
  const now = Date.now();
  const last = lastCfgRefresh.get(guildId) ?? 0;
  if (now - last > CFG_REFRESH_INTERVAL_MS) {
    lastCfgRefresh.set(guildId, now);
    await refreshAutomodForGuild(guildId).catch(() => {});
  }
  return getAutomodConfig(guildId).ghostPing?.enabled ?? false;
}

setInterval(() => {
  const cutoff = Date.now() - CACHE_TTL_MS;
  for (const [id, entry] of msgCache) {
    if (entry.ts < cutoff) msgCache.delete(id);
  }
}, 15_000).unref();

function hasMentions(message: Message): boolean {
  return (
    message.mentions.users.size > 0 ||
    message.mentions.roles.size > 0 ||
    message.mentions.everyone
  );
}

function buildCacheEntry(message: Message): CachedMsg {
  return {
    guildId:           message.guild!.id,
    authorId:          message.author.id,
    authorTag:         message.author.tag,
    channelId:         message.channel.id,
    channelName:       (message.channel as any).name ?? "unknown",
    mentionedUserIds:  [...message.mentions.users.keys()],
    mentionedRoleIds:  [...message.mentions.roles.keys()],
    mentionedEveryone: message.mentions.everyone,
    memberRoleIds:     message.member ? [...message.member.roles.cache.keys()] : [],
    ts:                Date.now(),
  };
}

async function handleGhostPing(
  client: Client,
  cached: CachedMsg,
  messageId: string,
): Promise<void> {
  const { guildId, authorId, authorTag, channelId, channelName, mentionedUserIds, mentionedRoleIds, mentionedEveryone, memberRoleIds } = cached;

  const enabled = await getLatestGhostPingEnabled(guildId);
  if (!enabled) {
    logger.info({ guildId, authorId }, "GhostPing: aborted — module disabled");
    return;
  }

  const cfg = getAutomodConfig(guildId);
  const mod = cfg.ghostPing;
  if (!mod) return;

  if (cfg.exemptChannels.includes(channelId)) {
    logger.info({ guildId, authorId, channelId }, "GhostPing: aborted — exempt channel");
    return;
  }
  if (memberHasProtectedRole(guildId, memberRoleIds)) {
    logger.info({ guildId, authorId }, "GhostPing: aborted — author has protected role");
    return;
  }
  if (cfg.exemptRoles.length > 0 && memberRoleIds.some((r) => cfg.exemptRoles.includes(r))) {
    logger.info({ guildId, authorId }, "GhostPing: aborted — author has exempt role");
    return;
  }
  if (mod.ignoredChannels?.length && mod.ignoredChannels.includes(channelId)) {
    logger.info({ guildId, authorId, channelId }, "GhostPing: aborted — ignored channel");
    return;
  }
  if (mod.ignoredRoles?.length && memberRoleIds.some((r) => mod.ignoredRoles!.includes(r))) {
    logger.info({ guildId, authorId }, "GhostPing: aborted — author has ignored role");
    return;
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    logger.warn({ guildId }, "GhostPing: aborted — guild not in cache");
    return;
  }

  const botTag  = client.user?.tag ?? "AutoMod";
  const botId   = client.user?.id  ?? "0";
  const action  = mod.action ?? "warn";

  // Build mention list — include @everyone/@here if applicable
  const allMentions: string[] = [
    ...mentionedUserIds.map((id) => `<@${id}>`),
    ...mentionedRoleIds.map((id) => `<@&${id}>`),
  ];
  if (mentionedEveryone) allMentions.push("@everyone");

  const mentionText = allMentions.length > 0 ? allMentions.join(", ") : "someone";
  const reason      = `Ghost-pinged ${mentionText} then deleted the message`;
  const warnReason  = `AutoMod: Ghost Ping — ${reason}`;

  const automodExpiry = getAutomodWarnExpiry(guildId);
  const expiresAt     = automodExpiry === 0 ? undefined : Date.now() + automodExpiry;

  // Create the infraction once here for all action types
  const infraction = addInfraction(guildId, authorId, {
    type:         action.charAt(0).toUpperCase() + action.slice(1) as any,
    reason:       warnReason,
    moderatorId:  botId,
    moderatorTag: botTag,
    expiresAt,
    automod: true,
  });

  // DM the offender
  const author = await client.users.fetch(authorId).catch(() => null);
  if (author) {
    await sendDmNotification(author, {
      action:         action.charAt(0).toUpperCase() + action.slice(1) as any,
      guildName:      guild.name,
      reason:         warnReason,
      caseId:         infraction.id,
      expiresAt,
      additionalInfo: getAdditionalInfo(guildId, action as any),
      description:    `You were flagged by AutoMod for ghost pinging.`,
    });
  }

  // Public notice in channel (unless silent mode)
  if (!cfg.silent) {
    const channel = guild.channels.cache.get(channelId) as any;
    if (channel?.send) {
      const notice = await channel
        .send(`👻 <@${authorId}> — **Ghost Ping**: You pinged ${mentionText} and deleted the message. (AutoMod ${action})`)
        .catch(() => null);
      if (notice) setTimeout(() => notice.delete().catch(() => {}), 7000);
    }
  }

  // Mod log (ghost-ping specific format)
  await sendModLog(client, guildId, {
    action:    `AutoMod — Ghost Ping (${action.charAt(0).toUpperCase() + action.slice(1)})`,
    executor:  { tag: botTag, id: botId },
    target:    { tag: authorTag, id: authorId },
    channel:   { name: channelName, id: channelId },
    reason,
    color:     0xa855f7,
    caseId:    infraction.id,
  });

  // For non-warn actions: apply the actual Discord punishment.
  // Pass skipNotifications=true so applyAutoPunishment only performs the
  // Discord action (timeout / kick / ban) without creating a second infraction,
  // sending a second DM, or sending a second mod log.
  const member = guild.members.cache.get(authorId);
  if (member && action !== "warn") {
    await applyAutoPunishment(
      client,
      guild,
      member,
      action as any,
      warnReason,
      mod.actionDuration,
      undefined,
      true, // skipNotifications
    );
  }

  logger.info(
    { authorId, guildId, mentionCount: allMentions.length, action },
    "AutoMod ghost ping detected and actioned",
  );
}

export function registerGhostPingEvents(client: Client) {
  // Always cache messages that contain mentions — the enabled check is deferred
  // to delete/edit time so a stale in-memory config never causes a miss.
  client.on(Events.MessageCreate, (message: Message) => {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!hasMentions(message)) return;

    msgCache.set(message.id, buildCacheEntry(message));

    logger.debug(
      { guildId: message.guild.id, messageId: message.id, authorId: message.author.id },
      "GhostPing: message with mentions cached",
    );
  });

  // ── Delete path ─────────────────────────────────────────────────────────────
  client.on(Events.MessageDelete, async (message: Message | PartialMessage) => {
    const cached = msgCache.get(message.id);
    if (!cached) return;
    msgCache.delete(message.id);

    logger.info(
      { guildId: cached.guildId, authorId: cached.authorId, messageId: message.id },
      "GhostPing: cached message deleted — checking config",
    );

    await handleGhostPing(client, cached, message.id);
  });

  // ── Edit path ────────────────────────────────────────────────────────────────
  // Catches ghost pings performed by editing a message to remove all mentions
  // instead of deleting it.
  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    if (!newMessage.guild) return;
    if (newMessage.author?.bot) return;

    const cached = msgCache.get(newMessage.id);
    if (!cached) return;

    // Fetch the full new message if partial so we can read its mentions
    let full: Message;
    try {
      full = newMessage.partial ? await newMessage.fetch() : (newMessage as Message);
    } catch {
      return;
    }

    if (full.author.bot) return;

    // Ghost ping via edit: the cached version had mentions, the new version has none
    if (!hasMentions(full)) {
      msgCache.delete(newMessage.id);

      logger.info(
        { guildId: cached.guildId, authorId: cached.authorId, messageId: newMessage.id },
        "GhostPing: mentions removed via edit — checking config",
      );

      await handleGhostPing(client, cached, newMessage.id);
      return;
    }

    // Mentions changed but still present — update the cache entry
    msgCache.set(newMessage.id, buildCacheEntry(full));
  });
}
