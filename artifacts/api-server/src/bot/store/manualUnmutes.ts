// Tracks users manually unmuted by a mod so guildMemberUpdate
// doesn't also send an "expired" DM for the same event.
const pending = new Set<string>();

function key(guildId: string, userId: string) {
  return `${guildId}:${userId}`;
}

export function markManualUnmute(guildId: string, userId: string): void {
  const k = key(guildId, userId);
  pending.add(k);
  // Auto-clear after 5 seconds in case the event fires late
  setTimeout(() => pending.delete(k), 5000);
}

export function consumeManualUnmute(guildId: string, userId: string): boolean {
  const k = key(guildId, userId);
  if (pending.has(k)) {
    pending.delete(k);
    return true;
  }
  return false;
}
