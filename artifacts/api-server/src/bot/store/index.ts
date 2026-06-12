import { initDb } from "./db";
import { initAliasesStore } from "./aliases";
import { initAltsStore } from "./alts";
import { initAntinukeStore } from "./antinuke";
import { initAntiraidStore } from "./antiraid";
import { initAutomodStore } from "./automod";
import { initInfractionsStore } from "./infractions";
import { initLockdownStore } from "./lockdown";
import { initModrolesStore } from "./modroles";
import { initOwnerBlacklistsStore } from "./ownerBlacklists";
import { initSettingsStore } from "./settings";
import { initShortcutsStore } from "./shortcuts";
import { initTicketsStore } from "./tickets";
import { initTimedBansStore } from "./timedBans";
import { initTimedMutesStore } from "./timedMutes";
import { initWarningsStore } from "./warnings";
import { initAdditionalInfoStore } from "./additionalInfo";
import { initMuteConfigStore } from "./muteConfig";
import { initDisabledCommandsStore } from "./disabledCommands";
import { initCommandPermsStore } from "./commandPerms";
import { initApplicationFormsStore, initAppBlacklistStore } from "./applicationForms";
import { initProtectedRolesStore } from "./protectedRoles";
import { initCustomCommandsStore } from "./customCommands";
import { initServerLoggingStore } from "./serverlogging";
import { logger } from "../../lib/logger";

export async function initAllStores(): Promise<void> {
  await initDb();
  await Promise.all([
    initAliasesStore(),
    initAltsStore(),
    initAntinukeStore(),
    initAntiraidStore(),
    initAutomodStore(),
    initInfractionsStore(),
    initLockdownStore(),
    initModrolesStore(),
    initOwnerBlacklistsStore(),
    initSettingsStore(),
    initShortcutsStore(),
    initTicketsStore(),
    initTimedBansStore(),
    initTimedMutesStore(),
    initWarningsStore(),
    initAdditionalInfoStore(),
    initMuteConfigStore(),
    initDisabledCommandsStore(),
    initCommandPermsStore(),
    initApplicationFormsStore(),
    initAppBlacklistStore(),
    initProtectedRolesStore(),
    initCustomCommandsStore(),
    initServerLoggingStore(),
  ]);
  logger.info("All stores initialised from PostgreSQL");
}
