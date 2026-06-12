import { GuildMember, Message } from "discord.js";

export async function getExecutorMember(message: Message): Promise<GuildMember | null> {
  if (!message.guild) return null;
  return message.guild.members.fetch(message.author.id).catch(() => null);
}

export function isHierarchyBlocked(executor: GuildMember, target: GuildMember): boolean {
  return target.roles.highest.position >= executor.roles.highest.position;
}
