import { User, EmbedBuilder } from "discord.js";

interface DmPayload {
  action: "Warned" | "Muted" | "Unmuted" | "Kicked" | "Banned";
  guildName: string;
  reason: string;
  caseId?: string;
  duration?: string;
  expiresAt?: number;
  additionalInfo?: string;
  // false = no description, string = custom, undefined = use default
  description?: string | false;
}

const DEFAULT_DESCRIPTIONS: Record<DmPayload["action"], string> = {
  Warned: "You received a warning. Further infractions may result in an escalated punishment.",
  Muted: "You can no longer speak, join voice channels, or engage with the server in any way.",
  Unmuted: "Your mute has elapsed, you may now resume chatting. Please follow the rules!",
  Kicked: "You have been removed from the server. You may rejoin with a valid invite.",
  Banned: false as unknown as string,
};

// "banned from" / "kicked from" vs "warned in" etc.
const PREPOSITION: Record<DmPayload["action"], string> = {
  Warned: "in",
  Muted: "in",
  Unmuted: "in",
  Kicked: "from",
  Banned: "from",
};

const COLORS: Record<DmPayload["action"], number> = {
  Warned: 0xf1c40f,
  Muted: 0xf39c12,
  Unmuted: 0x2ecc71,
  Kicked: 0xe67e22,
  Banned: 0xe74c3c,
};

export function buildDmEmbed(payload: DmPayload, guildName: string): EmbedBuilder {
  const lines: string[] = [];

  const desc =
    payload.description === false
      ? null
      : payload.description !== undefined
      ? payload.description
      : DEFAULT_DESCRIPTIONS[payload.action] || null;

  if (desc) {
    lines.push(desc);
    lines.push("");
  }

  lines.push(`**Reason**\n${payload.reason}`);

  if (payload.additionalInfo) {
    lines.push(`**Additional Information**\n${payload.additionalInfo}`);
  }

  if (payload.duration) {
    lines.push(`**Duration**\n${payload.duration}`);
  }

  if (payload.expiresAt) {
    lines.push(`**Expires**\n<t:${Math.floor(payload.expiresAt / 1000)}:F>`);
  }

  if (payload.caseId) {
    lines.push(`**ID**\n${payload.caseId}`);
  }

  const prep = PREPOSITION[payload.action];
  return new EmbedBuilder()
    .setColor(COLORS[payload.action])
    .setTitle(`You've been ${payload.action.toLowerCase()} ${prep} ${guildName}.`)
    .setDescription(lines.join("\n"));
}

export async function sendDmNotification(user: User, payload: DmPayload): Promise<void> {
  const embed = buildDmEmbed(payload, payload.guildName);
  await user.send({ embeds: [embed] }).catch(() => {});
}
