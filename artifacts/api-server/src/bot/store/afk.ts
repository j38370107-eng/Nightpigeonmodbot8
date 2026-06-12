const afkMap = new Map<string, { reason: string; since: number }>();

function key(guildId: string, userId: string) {
  return `${guildId}:${userId}`;
}

export function setAfk(guildId: string, userId: string, reason: string): void {
  afkMap.set(key(guildId, userId), { reason, since: Date.now() });
}

export function getAfk(guildId: string, userId: string): { reason: string; since: number } | null {
  return afkMap.get(key(guildId, userId)) ?? null;
}

export function clearAfk(guildId: string, userId: string): boolean {
  return afkMap.delete(key(guildId, userId));
}
