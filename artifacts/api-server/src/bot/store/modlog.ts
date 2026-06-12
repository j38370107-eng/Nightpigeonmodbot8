import { getGuildSetting, setGuildSetting } from "./settings";

export function getLogChannel(guildId: string): string | null {
  return getGuildSetting(guildId, "logChannelId") ?? null;
}

export function setLogChannel(guildId: string, channelId: string): void {
  setGuildSetting(guildId, "logChannelId", channelId);
}
