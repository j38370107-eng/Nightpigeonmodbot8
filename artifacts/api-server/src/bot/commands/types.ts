import { Message, PermissionResolvable } from "discord.js";

export interface Command {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  requiredPermissions?: PermissionResolvable[];
  ownerOnly?: boolean;
  execute(message: Message, args: string[]): Promise<unknown>;
}
