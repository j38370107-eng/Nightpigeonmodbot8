import { initDb } from "./db";
import { initGuildConfigStore } from "./guildConfig";
import { initAliasesStore } from "./aliases";
import { initAntinukeStore } from "./antinuke";
import { initAntiraidStore } from "./antiraid";
import { initAutomodStore } from "./automod";
import { initModrolesStore } from "./modroles";
import { initOwnerBlacklistsStore } from "./ownerBlacklists";
import { initSettingsStore } from "./settings";
import { initShortcutsStore } from "./shortcuts";
import { initMuteConfigStore } from "./muteConfig";
import { initDisabledCommandsStore } from "./disabledCommands";
import { initCommandPermsStore } from "./commandPerms";
import { initProtectedRolesStore } from "./protectedRoles";
import { initCustomCommandsStore } from "./customCommands";
import { initServerLoggingStore } from "./serverlogging";
import { logger } from "../../lib/logger";

export async function initAllStores(): Promise<void> {
  await initDb();
  await initGuildConfigStore();
  await Promise.all([
    initAliasesStore(),
    initAntinukeStore(),
    initAntiraidStore(),
    initAutomodStore(),
    initModrolesStore(),
    initOwnerBlacklistsStore(),
    initSettingsStore(),
    initShortcutsStore(),
    initMuteConfigStore(),
    initDisabledCommandsStore(),
    initCommandPermsStore(),
    initProtectedRolesStore(),
    initCustomCommandsStore(),
    initServerLoggingStore(),
  ]);
  logger.info("All stores initialised from PostgreSQL");
}
