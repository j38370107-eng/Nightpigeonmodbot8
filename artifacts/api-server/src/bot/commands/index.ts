import { Client, Collection } from "discord.js";
import type { Command } from "./types";
import { changePrefixCommand } from "./changeprefix";
import { helpCommand } from "./help";
import { setLogChannelCommand } from "./setlogchannel";
import { setExpireDateCommand } from "./setexpiredate";
import { shortcutCommand } from "./shortcut";
import { automodCommand } from "./automod";
import { modroleCommand } from "./modrole";
import { pingCommand } from "./ping";
import { aliasCommand } from "./alias";
import { setServerLogsCommand } from "./setserverlogs";
import { antinukeCommand } from "./antinuke";
import { antiraidCommand } from "./antiraid";
import { setAutomodWarnExpiryCommand } from "./setautomodwarnexpiry";
import { evalCommand } from "./eval";
import { backupCommand } from "./backup";
import { resetConfigCommand } from "./resetconfig";
import { muteconfigCommand } from "./muteconfig";
import { dashboardCommand } from "./dashboard";
import { protectedRoleCommand } from "./protectedrole";

export const commands: Command[] = [
  changePrefixCommand,
  setLogChannelCommand,
  setExpireDateCommand,
  setAutomodWarnExpiryCommand,
  shortcutCommand,
  automodCommand,
  modroleCommand,
  pingCommand,
  aliasCommand,
  setServerLogsCommand,
  antinukeCommand,
  antiraidCommand,
  evalCommand,
  backupCommand,
  resetConfigCommand,
  muteconfigCommand,
  dashboardCommand,
  protectedRoleCommand,
  helpCommand,
];

export function loadCommands(client: Client) {
  const collection: Collection<string, Command> = new Collection();

  for (const cmd of commands) {
    collection.set(cmd.name, cmd);
    for (const alias of cmd.aliases) {
      collection.set(alias, cmd);
    }
  }

  (client as any).commands = collection;
}
