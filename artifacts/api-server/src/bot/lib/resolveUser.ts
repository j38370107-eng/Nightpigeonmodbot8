import { Message, User, GuildMember } from "discord.js";

export interface ResolvedTarget {
  user: User;
  member: GuildMember | null;
}

export async function resolveTarget(
  message: Message,
  args: string[]
): Promise<ResolvedTarget | null> {
  let user: User | null = message.mentions.users.first() ?? null;

  if (!user && args[0]) {
    const id = args[0].replace(/[<@!>]/g, "");
    if (/^\d{15,20}$/.test(id)) {
      user = await message.client.users.fetch(id).catch(() => null);
    }
  }

  if (!user) return null;

  const member = message.guild
    ? await message.guild.members.fetch(user.id).catch(() => null)
    : null;

  return { user, member };
}

export function getArgs(message: Message, args: string[]): string[] {
  if (message.mentions.users.size > 0) {
    return args.slice(1);
  }
  const first = args[0] ?? "";
  const id = first.replace(/[<@!>]/g, "");
  if (/^\d{15,20}$/.test(id)) {
    return args.slice(1);
  }
  return args;
}
