import { User, Attachment } from "discord.js";

export interface DeletedSnipe {
  content: string;
  author: { id: string; tag: string; displayAvatarURL: string };
  attachments: { url: string; name: string }[];
  deletedAt: number;
}

export interface EditedSnipe {
  oldContent: string;
  newContent: string;
  author: { id: string; tag: string; displayAvatarURL: string };
  editedAt: number;
  messageUrl: string;
}

const deletedCache = new Map<string, DeletedSnipe>();
const editedCache = new Map<string, EditedSnipe>();

export function setDeletedSnipe(channelId: string, snipe: DeletedSnipe): void {
  deletedCache.set(channelId, snipe);
}

export function getDeletedSnipe(channelId: string): DeletedSnipe | undefined {
  return deletedCache.get(channelId);
}

export function setEditedSnipe(channelId: string, snipe: EditedSnipe): void {
  editedCache.set(channelId, snipe);
}

export function getEditedSnipe(channelId: string): EditedSnipe | undefined {
  return editedCache.get(channelId);
}

export function clearSnipes(channelId: string): void {
  deletedCache.delete(channelId);
  editedCache.delete(channelId);
}
