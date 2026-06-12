import { dbSet, dbGet, dbGetAll } from "./db";
import { logger } from "../../lib/logger";

const APP_BLACKLIST_STORE = "appBlacklist";

const FORMS_STORE = "applicationForms";
const SUBMISSIONS_STORE = "applicationSubmissions";

export interface FormQuestion {
  id: string;
  label: string;
  description?: string;
  type: "short" | "long" | "choice";
  required: boolean;
  choices?: string[];
}

export interface ApplicationForm {
  id: string;
  title: string;
  description: string;
  questions: FormQuestion[];
  responseChannelId?: string;
  active: boolean;
  createdAt: number;
}

export interface FormSubmission {
  id: string;
  formId: string;
  formTitle: string;
  userId: string;
  userTag: string;
  userAvatar?: string;
  guildId: string;
  answers: Record<string, string>;
  submittedAt: number;
  status: "pending" | "approved" | "denied";
  reviewNote?: string;
}

type GuildForms = Record<string, ApplicationForm>;
type GuildSubmissions = Record<string, FormSubmission>;

const formsCache = new Map<string, GuildForms>();
const submissionsCache = new Map<string, GuildSubmissions>();
const appBlacklistCache = new Map<string, Set<string>>();

function saveBlacklist(guildId: string): void {
  const ids = [...(appBlacklistCache.get(guildId) ?? [])];
  dbSet(APP_BLACKLIST_STORE, guildId, ids).catch(err =>
    logger.error({ err }, "Failed to save app blacklist")
  );
}

export async function initAppBlacklistStore(): Promise<void> {
  const rows = await dbGetAll<string[]>(APP_BLACKLIST_STORE);
  for (const { key, data } of rows) appBlacklistCache.set(key, new Set(data));
  logger.info({ count: rows.length }, "Loaded app blacklist store");
}

export function appBlacklistUser(guildId: string, userId: string): void {
  if (!appBlacklistCache.has(guildId)) appBlacklistCache.set(guildId, new Set());
  appBlacklistCache.get(guildId)!.add(userId);
  saveBlacklist(guildId);
}

export function appUnblacklistUser(guildId: string, userId: string): boolean {
  const set = appBlacklistCache.get(guildId);
  if (!set?.has(userId)) return false;
  set.delete(userId);
  saveBlacklist(guildId);
  return true;
}

export function isAppBlacklisted(guildId: string, userId: string): boolean {
  return appBlacklistCache.get(guildId)?.has(userId) ?? false;
}

export async function initApplicationFormsStore(): Promise<void> {
  const formRows = await dbGetAll<GuildForms>(FORMS_STORE);
  for (const { key, data } of formRows) formsCache.set(key, data);
  const subRows = await dbGetAll<GuildSubmissions>(SUBMISSIONS_STORE);
  for (const { key, data } of subRows) submissionsCache.set(key, data);
  logger.info(
    { forms: formRows.length, submissions: subRows.length },
    "Loaded applicationForms store"
  );
}

export function getGuildForms(guildId: string): ApplicationForm[] {
  return Object.values(formsCache.get(guildId) ?? {});
}

export function getForm(guildId: string, formId: string): ApplicationForm | null {
  return formsCache.get(guildId)?.[formId] ?? null;
}

export function setForm(guildId: string, form: ApplicationForm): void {
  if (!formsCache.has(guildId)) formsCache.set(guildId, {});
  formsCache.get(guildId)![form.id] = form;
  dbSet(FORMS_STORE, guildId, formsCache.get(guildId)).catch((err) =>
    logger.error({ err }, "Failed to save application form")
  );
}

export function deleteForm(guildId: string, formId: string): void {
  const forms = formsCache.get(guildId);
  if (!forms?.[formId]) return;
  delete forms[formId];
  dbSet(FORMS_STORE, guildId, forms).catch((err) =>
    logger.error({ err }, "Failed to delete application form")
  );
}

export function getGuildSubmissions(
  guildId: string,
  formId?: string
): FormSubmission[] {
  const subs = Object.values(submissionsCache.get(guildId) ?? {});
  return formId ? subs.filter((s) => s.formId === formId) : subs;
}

export function addSubmission(guildId: string, submission: FormSubmission): void {
  if (!submissionsCache.has(guildId)) submissionsCache.set(guildId, {});
  submissionsCache.get(guildId)![submission.id] = submission;
  dbSet(SUBMISSIONS_STORE, guildId, submissionsCache.get(guildId)).catch((err) =>
    logger.error({ err }, "Failed to save submission")
  );
}

export function updateSubmissionStatus(
  guildId: string,
  submissionId: string,
  status: "approved" | "denied",
  reviewNote?: string
): boolean {
  const sub = submissionsCache.get(guildId)?.[submissionId];
  if (!sub) return false;
  sub.status = status;
  if (reviewNote !== undefined) sub.reviewNote = reviewNote;
  dbSet(SUBMISSIONS_STORE, guildId, submissionsCache.get(guildId)).catch((err) =>
    logger.error({ err }, "Failed to update submission status")
  );
  return true;
}
