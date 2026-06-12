import { Client, Collection } from "discord.js";
import type { Command } from "./types";
import { banCommand } from "./ban";
import { kickCommand } from "./kick";
import { muteCommand } from "./mute";
import { unmuteCommand } from "./unmute";
import { warnCommand } from "./warn";
import { warningsCommand } from "./warnings";
import { purgeCommand } from "./purge";
import { slowmodeCommand } from "./slowmode";
import { lockCommand } from "./lock";
import { unlockCommand } from "./unlock";
import { lockdownCommand } from "./lockdown";
import { changePrefixCommand } from "./changeprefix";
import { helpCommand } from "./help";
import { setLogChannelCommand } from "./setlogchannel";
import { setExpireDateCommand } from "./setexpiredate";
import { unbanCommand } from "./unban";
import { delCaseCommand } from "./delcase";
import { noteCommand } from "./note";
import { delNoteCommand } from "./delnote";
import { viewNoteCommand } from "./viewnote";
import { editNoteCommand } from "./editnote";
import { caseCommand } from "./case";
import { reasonCommand } from "./reason";
import { shortcutCommand } from "./shortcut";
import { automodCommand } from "./automod";
import { userinfoCommand } from "./userinfo";
import { serverinfoCommand } from "./serverinfo";
import { modnickCommand } from "./modnick";
import { modroleCommand } from "./modrole";
import { pingCommand } from "./ping";
import { nickCommand } from "./nick";
import { afkCommand, afkResetCommand } from "./afk";
import { altCommand, clearAltCommand } from "./alt";
import { addRoleCommand, removeRoleCommand } from "./addrole";
import { remindCommand } from "./remind";
import { aliasCommand } from "./alias";
import { setServerLogsCommand } from "./setserverlogs";
import { antinukeCommand } from "./antinuke";
import { antiraidCommand } from "./antiraid";
import { ticketCommand, ticketBlacklistCommand, ticketUnblacklistCommand } from "./ticket";
import {
  ticketSetupCommand,
  ticketCloseCommand,
  ticketDeleteCommand,
  ticketReopenCommand,
  ticketAddCommand,
  ticketRemoveCommand,
  ticketClaimCommand,
  ticketTranscriptCommand,
  ticketStatsCommand,
} from "./ticketActions";
import { baninfoCommand } from "./baninfo";
import { botinfoCommand } from "./botinfo";
import { durationCommand } from "./duration";
import { setAutomodWarnExpiryCommand } from "./setautomodwarnexpiry";
import { evalCommand } from "./eval";
import { serverBlacklistCommand } from "./serverblacklist";
import { userBlacklistCommand } from "./userblacklist";
import { backupCommand } from "./backup";
import { additionalInformationCommand } from "./additionalinformation";
import { activeActionsCommand } from "./activeactions";
import { modstatsCommand } from "./modstats";
import { resetConfigCommand } from "./resetconfig";
import { muteconfigCommand } from "./muteconfig";
import { dashboardCommand } from "./dashboard";
import { applyCommand } from "./apply";
import { appBlacklistCommand, appUnblacklistCommand } from "./ablacklist";
import { altsListCommand } from "./altslist";
import { snipeCommand, editSnipeCommand, clearSnipeCommand } from "./snipe";
import { protectedRoleCommand } from "./protectedrole";

export const commands: Command[] = [
  banCommand,
  unbanCommand,
  kickCommand,
  muteCommand,
  unmuteCommand,
  warnCommand,
  warningsCommand,
  purgeCommand,
  slowmodeCommand,
  lockCommand,
  unlockCommand,
  lockdownCommand,
  changePrefixCommand,
  setLogChannelCommand,
  setExpireDateCommand,
  setAutomodWarnExpiryCommand,
  delCaseCommand,
  noteCommand,
  delNoteCommand,
  viewNoteCommand,
  editNoteCommand,
  caseCommand,
  reasonCommand,
  shortcutCommand,
  automodCommand,
  userinfoCommand,
  serverinfoCommand,
  modnickCommand,
  modroleCommand,
  pingCommand,
  nickCommand,
  afkCommand,
  afkResetCommand,
  altCommand,
  clearAltCommand,
  addRoleCommand,
  removeRoleCommand,
  remindCommand,
  aliasCommand,
  setServerLogsCommand,
  antinukeCommand,
  antiraidCommand,
  ticketCommand,
  ticketBlacklistCommand,
  ticketUnblacklistCommand,
  ticketSetupCommand,
  ticketCloseCommand,
  ticketDeleteCommand,
  ticketReopenCommand,
  ticketAddCommand,
  ticketRemoveCommand,
  ticketClaimCommand,
  ticketTranscriptCommand,
  ticketStatsCommand,
  baninfoCommand,
  botinfoCommand,
  durationCommand,
  evalCommand,
  serverBlacklistCommand,
  userBlacklistCommand,
  backupCommand,
  additionalInformationCommand,
  activeActionsCommand,
  modstatsCommand,
  resetConfigCommand,
  muteconfigCommand,
  dashboardCommand,
  applyCommand,
  appBlacklistCommand,
  appUnblacklistCommand,
  altsListCommand,
  snipeCommand,
  editSnipeCommand,
  clearSnipeCommand,
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
