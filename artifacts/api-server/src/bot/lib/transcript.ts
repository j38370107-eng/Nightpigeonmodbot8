import { TextChannel, AttachmentBuilder } from "discord.js";
import { ActiveTicket } from "../store/tickets";

export async function generateTranscript(
  channel: TextChannel,
  ticket: ActiveTicket
): Promise<AttachmentBuilder> {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = [...messages.values()].reverse();

  const lines: string[] = [
    `═══════════════════════════════════════════`,
    `  TICKET TRANSCRIPT — #${channel.name}`,
    `═══════════════════════════════════════════`,
    `  User:      ${ticket.userTag} (${ticket.userId})`,
    `  Opened:    ${new Date(ticket.createdAt).toUTCString()}`,
    `  Closed:    ${new Date().toUTCString()}`,
    ticket.claimedBy ? `  Claimed by: ${ticket.claimedByTag} (${ticket.claimedBy})` : `  Claimed by: Unclaimed`,
    `═══════════════════════════════════════════`,
    "",
  ];

  for (const msg of sorted) {
    if (msg.author.bot && msg.content === "") continue;
    const time = new Date(msg.createdTimestamp).toUTCString();
    const author = `${msg.author.tag}`;
    const content = msg.content || (msg.embeds.length ? "[embed]" : "[attachment]");
    lines.push(`[${time}] ${author}: ${content}`);
    for (const att of msg.attachments.values()) {
      lines.push(`  📎 Attachment: ${att.url}`);
    }
  }

  const text = lines.join("\n");
  const buffer = Buffer.from(text, "utf8");
  return new AttachmentBuilder(buffer, { name: `transcript-${channel.name}.txt` });
}
