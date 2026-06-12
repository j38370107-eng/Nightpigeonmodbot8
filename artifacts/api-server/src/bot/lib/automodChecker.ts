import { Message } from "discord.js";
import { getAutomodConfig, type RulePermissions } from "../store/automod";
import { memberHasProtectedRole } from "../store/protectedRoles";

// ── Text normalisation (anti-bypass) ─────────────────────────────────────────

function normalizeForFilter(text: string): string {
  let s = text.toLowerCase();
  s = s.replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2064\u00ad\uFEFF]/g, "");
  s = s
    .replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e")
    .replace(/4/g, "a").replace(/5/g, "s").replace(/@/g, "a")
    .replace(/\$/g, "s").replace(/!/g, "i").replace(/\+/g, "t")
    .replace(/7/g, "t").replace(/8/g, "b").replace(/9/g, "g")
    .replace(/€/g, "e").replace(/£/g, "l").replace(/\|/g, "i");
  s = s.replace(/(?<!\S)((?:\S ){2,}\S)(?!\S)/g, (m) => m.replace(/ /g, ""));
  s = s.replace(/([a-z])[.\-_*•·](?=[a-z])/g, "$1");
  return s;
}

function exactWordMatch(word: string, normalizedText: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z])${escaped}(?![a-z])`, "i").test(normalizedText);
}

function wildcardWordMatch(word: string, normalizedText: string): boolean {
  if (word.includes("*")) {
    const escaped = word.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(escaped, "i").test(normalizedText);
  }
  return normalizedText.includes(word);
}

// ── Per-rule permission gate ──────────────────────────────────────────────────

function passesRulePermissions(message: Message, perms: RulePermissions, channelId: string): boolean {
  if (perms.ignoredChannels?.length && perms.ignoredChannels.includes(channelId)) return false;
  if (perms.affectedChannels?.length && !perms.affectedChannels.includes(channelId)) return false;
  if (message.member) {
    const memberRoles = [...message.member.roles.cache.keys()];
    if (perms.ignoredRoles?.length && memberRoles.some((r) => perms.ignoredRoles!.includes(r))) return false;
    if (perms.affectedRoles?.length && !memberRoles.some((r) => perms.affectedRoles!.includes(r))) return false;
  }
  return true;
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface AutomodResult {
  triggered: true;
  module: string;
  reason: string;
  publicReason?: string;
  action: string;
  actionDuration?: string;
}
export interface AutomodPass {
  triggered: false;
}
export type AutomodCheck = AutomodResult | AutomodPass;

function hit(module: string, reason: string, perms: RulePermissions, publicReason?: string): AutomodResult {
  return {
    triggered: true,
    module,
    reason,
    publicReason,
    action: perms.action ?? "warn",
    actionDuration: perms.actionDuration,
  };
}

// ── URL helpers ───────────────────────────────────────────────────────────────

const URL_RE = /https?:\/\/[^\s<>"]+|(?:^|\s)(www\.[^\s<>"]+)/gi;
const INVITE_RE = /(?:discord\.gg|discord(?:app)?\.com\/invite)\/[a-zA-Z0-9-]+/i;

function extractUrls(text: string): string[] {
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  const re = /https?:\/\/[^\s<>"]+/gi;
  while ((m = re.exec(text)) !== null) matches.push(m[0]);
  return matches;
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.replace(/^(?:https?:\/\/)?(?:www\.)?/, "").split("/")[0]!.toLowerCase();
  }
}

// ── Known phishing domains ────────────────────────────────────────────────────

const PHISHING_DOMAINS = new Set([
  "discordnitro.gift", "discord-nitro.gift", "discordgift.site", "discordgift.io",
  "dlscordapp.com", "discordapp.io", "discord-gift.com", "nitro-discord.xyz",
  "free-nitro.ru", "steamcommunity.ru", "steamgift.com", "freeboost.club",
  "discord-verify.com", "discordapp.org", "nitrogift.pro", "discordnito.com",
  "steamcommuntiy.com", "nitropremium.ru", "discordfree.gift",
]);

// ── Per-user rate-tracking maps ───────────────────────────────────────────────
// spam:     guild:user → sorted array of message timestamps
const spamMap = new Map<string, number[]>();
// linkSpam: guild:user → sorted array of timestamps for messages that contained links
const linkMap = new Map<string, number[]>();
// duplicate: guild:user → { last normalised content, run count }
const dupMap  = new Map<string, { content: string; count: number }>();

function pruneWindow(arr: number[], windowMs: number): number[] {
  const cutoff = Date.now() - windowMs;
  return arr.filter((t) => t >= cutoff);
}

// ── Emoji counter ─────────────────────────────────────────────────────────────

const EMOJI_RE = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;

function countEmoji(text: string): number {
  return (text.match(EMOJI_RE) ?? []).length;
}

function maxRepeatedChar(text: string): number {
  let max = 0, cur = 1;
  for (let i = 1; i < text.length; i++) {
    if (text[i] === text[i - 1]) { cur++; if (cur > max) max = cur; }
    else cur = 1;
  }
  return max;
}

// ── Main checker ──────────────────────────────────────────────────────────────

export function checkMessage(message: Message): AutomodCheck {
  if (!message.guild) return { triggered: false };

  const guildId   = message.guild.id;
  const channelId = message.channelId;
  const cfg       = getAutomodConfig(guildId);
  const content   = message.content ?? "";
  const normalized = normalizeForFilter(content);

  // Guild-wide exemptions
  if (cfg.exemptChannels.includes(channelId)) return { triggered: false };
  if (message.member) {
    const memberRoles = [...message.member.roles.cache.keys()];
    if (memberHasProtectedRole(guildId, memberRoles)) return { triggered: false };
    if (cfg.exemptRoles.length > 0 && memberRoles.some((r) => cfg.exemptRoles.includes(r))) {
      return { triggered: false };
    }
  }

  const userId = message.author.id;
  const key    = `${guildId}:${userId}`;
  const now    = Date.now();

  // ── 1. Filter (bad words — global word list) ──────────────────────────────
  const filterMod = cfg.filter;
  if (filterMod?.enabled && passesRulePermissions(message, filterMod, channelId)) {
    for (const w of filterMod.words ?? []) {
      if (exactWordMatch(w, normalized)) {
        return hit("Bad Words", `Filtered word: \`${w}\``, filterMod, "Used a filtered word");
      }
    }
    for (const w of filterMod.wildcardWords ?? []) {
      if (wildcardWordMatch(w, normalized)) {
        return hit("Bad Words", `Wildcard filter matched: \`${w}\``, filterMod, "Used a filtered word");
      }
    }
  }

  // ── 2. Invite links ───────────────────────────────────────────────────────
  const inviteMod = cfg.invite;
  if (inviteMod?.enabled && passesRulePermissions(message, inviteMod, channelId)) {
    if (INVITE_RE.test(content)) {
      return hit("Invite Links", "Posted a Discord invite link", inviteMod, "No invite links allowed");
    }
  }

  // ── 3. Mass mentions ──────────────────────────────────────────────────────
  const mentionMod = cfg.mention;
  if (mentionMod?.enabled && passesRulePermissions(message, mentionMod, channelId)) {
    const threshold = mentionMod.threshold ?? 5;
    const mentionCount = message.mentions.users.size + message.mentions.roles.size;
    if (mentionCount >= threshold) {
      return hit("Mass Mentions", `Mentioned ${mentionCount} users/roles (limit: ${threshold})`, mentionMod, "Too many mentions");
    }
  }

  // ── 4. Spam detection ─────────────────────────────────────────────────────
  const spamMod = cfg.spam;
  if (spamMod?.enabled && passesRulePermissions(message, spamMod, channelId)) {
    const limit    = spamMod.limit    ?? 5;
    const windowMs = spamMod.windowMs ?? 5000;
    const times    = pruneWindow(spamMap.get(key) ?? [], windowMs);
    times.push(now);
    spamMap.set(key, times);
    if (times.length >= limit) {
      spamMap.delete(key);
      return hit("Spam Detection", `Sent ${times.length} messages in ${windowMs}ms`, spamMod, "Sending messages too fast");
    }
  }

  // ── 5. Duplicate messages ─────────────────────────────────────────────────
  const dupMod = cfg.duplicate;
  if (dupMod?.enabled && passesRulePermissions(message, dupMod, channelId)) {
    const maxCount = dupMod.count ?? 3;
    const entry    = dupMap.get(key) ?? { content: "", count: 0 };
    const norm     = content.trim().toLowerCase();
    if (norm && norm === entry.content) {
      entry.count++;
      dupMap.set(key, entry);
      if (entry.count >= maxCount) {
        dupMap.delete(key);
        return hit("Duplicate Messages", `Sent the same message ${entry.count + 1} times in a row`, dupMod, "Stop repeating messages");
      }
    } else {
      dupMap.set(key, { content: norm, count: 1 });
    }
  }

  // ── 6. Character / emoji flood ────────────────────────────────────────────
  const charFloodMod = cfg.charFlood;
  if (charFloodMod?.enabled && passesRulePermissions(message, charFloodMod, channelId)) {
    const maxRepeat = charFloodMod.maxRepeat ?? 10;
    const maxEmoji  = charFloodMod.maxEmoji  ?? 10;
    if (maxRepeatedChar(content) >= maxRepeat) {
      return hit("Character Flood", `Message contains ${maxRepeatedChar(content)}+ repeated characters`, charFloodMod, "Too many repeated characters");
    }
    if (countEmoji(content) >= maxEmoji) {
      return hit("Emoji Flood", `Message contains ${countEmoji(content)} emoji (limit: ${maxEmoji})`, charFloodMod, "Too many emoji");
    }
  }

  // ── 7. Link spam ──────────────────────────────────────────────────────────
  const linkSpamMod = cfg.linkSpam;
  if (linkSpamMod?.enabled && passesRulePermissions(message, linkSpamMod, channelId)) {
    const urls = extractUrls(content);
    if (urls.length > 0) {
      const limit    = linkSpamMod.limit    ?? 5;
      const windowMs = linkSpamMod.windowMs ?? 10000;
      const times    = pruneWindow(linkMap.get(key) ?? [], windowMs);
      // Each URL in this message counts as one entry
      for (let i = 0; i < urls.length; i++) times.push(now + i);
      linkMap.set(key, times);
      if (times.length >= limit) {
        linkMap.delete(key);
        return hit("Link Spam", `Sent ${times.length} links in ${windowMs}ms`, linkSpamMod, "Too many links");
      }
    }
  }

  // ── 8. URL filter ─────────────────────────────────────────────────────────
  const urlFilterMod = cfg.urlFilter;
  if (urlFilterMod?.enabled && passesRulePermissions(message, urlFilterMod, channelId)) {
    const urls = extractUrls(content);
    if (urls.length > 0) {
      if (urlFilterMod.blockAll) {
        const allowed = urlFilterMod.domains ?? [];
        const blocked = urls.filter((u) => !allowed.includes(extractDomain(u)));
        if (blocked.length > 0) {
          return hit("URL Filter", `Blocked URL: \`${extractDomain(blocked[0]!)}\``, urlFilterMod, "URL not allowed");
        }
      } else if (urlFilterMod.mode === "blacklist") {
        const blocked = urlFilterMod.domains ?? [];
        const found   = urls.find((u) => blocked.includes(extractDomain(u)));
        if (found) {
          return hit("URL Filter", `Blacklisted domain: \`${extractDomain(found)}\``, urlFilterMod, "URL not allowed");
        }
      } else {
        // whitelist mode
        const allowed = urlFilterMod.domains ?? [];
        if (allowed.length > 0) {
          const violation = urls.find((u) => !allowed.includes(extractDomain(u)));
          if (violation) {
            return hit("URL Filter", `Domain not whitelisted: \`${extractDomain(violation)}\``, urlFilterMod, "URL not allowed");
          }
        }
      }
    }
  }

  // ── 9. Wall of text ───────────────────────────────────────────────────────
  const wallTextMod = cfg.wallText;
  if (wallTextMod?.enabled && passesRulePermissions(message, wallTextMod, channelId)) {
    const maxLength = wallTextMod.maxLength ?? 500;
    const maxLines  = wallTextMod.maxLines  ?? 15;
    if (content.length > maxLength) {
      return hit("Wall of Text", `Message is ${content.length} characters (limit: ${maxLength})`, wallTextMod, "Message too long");
    }
    const lineCount = (content.match(/\n/g) ?? []).length + 1;
    if (lineCount > maxLines) {
      return hit("Wall of Text", `Message has ${lineCount} lines (limit: ${maxLines})`, wallTextMod, "Message too long");
    }
  }

  // ── 10. Anti-phishing ─────────────────────────────────────────────────────
  const phishingMod = cfg.phishing;
  if (phishingMod?.enabled && passesRulePermissions(message, phishingMod, channelId)) {
    const urls = extractUrls(content);
    for (const url of urls) {
      const domain = extractDomain(url);
      if (PHISHING_DOMAINS.has(domain)) {
        return hit("Anti-Phishing", `Known phishing domain: \`${domain}\``, phishingMod, "Phishing link detected");
      }
    }
  }

  // ── 11. File filter ───────────────────────────────────────────────────────
  const fileFilterMod = cfg.fileFilter;
  if (fileFilterMod?.enabled && passesRulePermissions(message, fileFilterMod, channelId)) {
    const blocked = (fileFilterMod.blockedExtensions ?? []).map((e) => e.toLowerCase().replace(/^\./, ""));
    if (blocked.length > 0 && message.attachments.size > 0) {
      for (const attachment of message.attachments.values()) {
        const ext = (attachment.name ?? "").split(".").pop()?.toLowerCase() ?? "";
        if (ext && blocked.includes(ext)) {
          return hit("File Filter", `Blocked file extension: \`.${ext}\``, fileFilterMod, "File type not allowed");
        }
      }
    }
  }

  // ── 12. Custom named word-filter rules ────────────────────────────────────
  for (const rule of cfg.rules ?? []) {
    if (!rule.enabled) continue;
    if (!passesRulePermissions(message, rule, channelId)) continue;
    for (const w of rule.words) {
      if (exactWordMatch(w, normalized)) {
        return hit(`Rule: ${rule.name}`, `Rule "${rule.name}" blocked word: \`${w}\``, rule, "Used a filtered word");
      }
    }
    for (const w of rule.wildcardWords ?? []) {
      if (wildcardWordMatch(w, normalized)) {
        return hit(`Rule: ${rule.name}`, `Rule "${rule.name}" wildcard matched: \`${w}\``, rule, "Used a filtered word");
      }
    }
  }

  return { triggered: false };
}
