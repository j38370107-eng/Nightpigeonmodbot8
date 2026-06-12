import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Card, Button, Input, Toggle, PageHeader, Spinner, useToast, SaveBar } from "../../components/ui";
import { Plus, Trash2, Hash, ChevronDown, ChevronUp, Pencil, X, Check } from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────────

const RULE_TYPES = [
  { value: "filter",    label: "Bad Words",             color: "#ef4444", desc: "Block specific words and phrases" },
  { value: "invite",    label: "Invite Links",          color: "#f97316", desc: "Delete Discord server invite links" },
  { value: "mention",   label: "Mass Mentions",         color: "#eab308", desc: "Block messages with too many @mentions" },
  { value: "spam",      label: "Spam Detection",        color: "#22c55e", desc: "Block rapid repeated messages" },
  { value: "duplicate", label: "Duplicate Messages",    color: "#06b6d4", desc: "Block identical messages sent in a row" },
  { value: "charFlood", label: "Character/Emoji Flood", color: "#6366f1", desc: "Block repeated characters or emoji spam" },
  { value: "linkSpam",  label: "Link Spam",             color: "#8b5cf6", desc: "Block too many links in a short window" },
  { value: "urlFilter", label: "URL Filter",            color: "#ec4899", desc: "Block or whitelist specific domains" },
  { value: "wallText",  label: "Wall of Text",          color: "#64748b", desc: "Block excessively long messages" },
  { value: "phishing",  label: "Anti-Phishing",         color: "#dc2626", desc: "Block known scam and phishing links automatically" },
  { value: "fileFilter",label: "File Filter",           color: "#ea580c", desc: "Block file uploads by extension (e.g. .exe, .sh, .bat)" },
  { value: "custom",    label: "Custom Word List",      color: "#f59e0b", desc: "Named group of exact/wildcard words" },
];
const RULE_TYPE_MAP = Object.fromEntries(RULE_TYPES.map(t => [t.value, t]));
const SINGLETON_TYPES = new Set([
  "filter","invite","mention","spam","duplicate","charFlood",
  "linkSpam","urlFilter","wallText","phishing","fileFilter",
]);

const ACTIONS = [
  { value: "warn",   label: "Warn" },
  { value: "delete", label: "Delete Message" },
  { value: "mute",   label: "Automute" },
  { value: "kick",   label: "Kick" },
  { value: "ban",    label: "Autoban" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function defaultOptions(type: string): Record<string, any> {
  if (type === "filter")     return { words: [], wildcardWords: [] };
  if (type === "mention")    return { threshold: 5 };
  if (type === "spam")       return { limit: 5, windowMs: 5000 };
  if (type === "duplicate")  return { count: 3 };
  if (type === "charFlood")  return { maxRepeat: 10, maxEmoji: 10 };
  if (type === "linkSpam")   return { limit: 5, windowMs: 10000 };
  if (type === "urlFilter")  return { mode: "blacklist", blockAll: false, domains: [] };
  if (type === "wallText")   return { maxLength: 500, maxLines: 15 };
  if (type === "fileFilter") return { blockedExtensions: [] };
  if (type === "custom")     return { words: [], wildcardWords: [] };
  return {};
}

function configToUIRules(c: any) {
  const rules: any[] = [];
  const modLabels: Record<string,string> = {
    filter:     "Bad Words",
    invite:     "Invite Links",
    mention:    "Mass Mentions",
    spam:       "Spam Detection",
    duplicate:  "Duplicate Messages",
    charFlood:  "Character/Emoji Flood",
    linkSpam:   "Link Spam",
    urlFilter:  "URL Filter",
    wallText:   "Wall of Text",
    phishing:   "Anti-Phishing",
    fileFilter: "File Filter",
  };
  for (const key of Object.keys(modLabels)) {
    const mod = c[key];
    if (mod == null) continue;
    rules.push({
      id: key, name: mod.name ?? modLabels[key], type: key,
      action: mod.action ?? "warn", actionDuration: mod.actionDuration ?? "",
      ignoredRoles: mod.ignoredRoles ?? [], ignoredChannels: mod.ignoredChannels ?? [],
      affectedRoles: mod.affectedRoles ?? [], affectedChannels: mod.affectedChannels ?? [],
      enabled: mod.enabled ?? true, options: { ...defaultOptions(key), ...extractOptions(key, mod) },
    });
  }
  for (const r of (c.rules ?? [])) {
    rules.push({
      id: r.id ?? uid(), name: r.name ?? "Custom Rule", type: "custom",
      action: r.action ?? "warn", actionDuration: r.actionDuration ?? "",
      ignoredRoles: r.ignoredRoles ?? [], ignoredChannels: r.ignoredChannels ?? [],
      affectedRoles: r.affectedRoles ?? [], affectedChannels: r.affectedChannels ?? [],
      enabled: r.enabled ?? true,
      options: { words: r.words ?? [], wildcardWords: r.wildcardWords ?? [] },
    });
  }
  return rules;
}

function extractOptions(key: string, mod: any) {
  if (key === "filter")     return { words: mod.words ?? [], wildcardWords: mod.wildcardWords ?? [] };
  if (key === "mention")    return { threshold: mod.threshold ?? 5 };
  if (key === "spam")       return { limit: mod.limit ?? 5, windowMs: mod.windowMs ?? 5000 };
  if (key === "duplicate")  return { count: mod.count ?? 3 };
  if (key === "charFlood")  return { maxRepeat: mod.maxRepeat ?? 10, maxEmoji: mod.maxEmoji ?? 10 };
  if (key === "linkSpam")   return { limit: mod.limit ?? 5, windowMs: mod.windowMs ?? 10000 };
  if (key === "urlFilter")  return { mode: mod.mode ?? "blacklist", blockAll: mod.blockAll ?? false, domains: mod.domains ?? [] };
  if (key === "wallText")   return { maxLength: mod.maxLength ?? 500, maxLines: mod.maxLines ?? 15 };
  if (key === "fileFilter") return { blockedExtensions: mod.blockedExtensions ?? [] };
  return {};
}

function uiRulesToConfig(uiRules: any[], base: any) {
  const cfg: any = {
    silent: base.silent, punishment: base.punishment, warnExpiryDays: base.warnExpiryDays,
    filter:     { enabled: false }, invite:     { enabled: false }, mention:    { enabled: false },
    spam:       { enabled: false }, duplicate:  { enabled: false }, charFlood:  { enabled: false },
    linkSpam:   { enabled: false }, urlFilter:  { enabled: false }, wallText:   { enabled: false },
    phishing:   { enabled: false }, fileFilter: { enabled: false },
    rules: [],
  };
  for (const r of uiRules) {
    const perms = {
      action: r.action, actionDuration: r.actionDuration,
      ignoredRoles: r.ignoredRoles, ignoredChannels: r.ignoredChannels,
      affectedRoles: r.affectedRoles, affectedChannels: r.affectedChannels,
    };
    if (r.type === "custom") {
      cfg.rules.push({ id: r.id, name: r.name, enabled: r.enabled, words: r.options.words ?? [], wildcardWords: r.options.wildcardWords ?? [], ...perms });
    } else {
      cfg[r.type] = { enabled: r.enabled, name: r.name, ...r.options, ...perms };
    }
  }
  return cfg;
}

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2,6)}`; }

// ── Sub-components ───────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const t = RULE_TYPE_MAP[type];
  if (!t) return null;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
      background: `${t.color}18`, border: `1px solid ${t.color}40`, color: t.color,
      whiteSpace: "nowrap", letterSpacing: "0.02em",
    }}>{t.label}</span>
  );
}

function WordPill({ word, color, onRemove }: { word: string; color: "red"|"amber"; onRemove: () => void }) {
  const isRed = color === "red";
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 6, fontSize: 12,
      background: isRed ? "var(--danger-dim)" : "rgba(240,165,0,0.08)",
      border: `1px solid ${isRed ? "rgba(239,68,68,0.2)" : "rgba(240,165,0,0.2)"}`,
      color: isRed ? "var(--danger)" : "var(--accent)",
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      {word}
      <button onClick={onRemove} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
    </span>
  );
}

function InlineWordInput({ placeholder, onAdd }: { placeholder: string; onAdd: (w: string) => void }) {
  const [val, setVal] = useState("");
  const go = () => { if (val.trim()) { onAdd(val.trim().toLowerCase()); setVal(""); } };
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === "Enter" && go()}
        placeholder={placeholder}
        style={{ flex: 1, padding: "7px 10px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-primary)", fontSize: 12, outline: "none" }} />
      <Button size="sm" onClick={go}><Plus size={12} /> Add</Button>
    </div>
  );
}

function SectionDivider({ label, open, onToggle, icon }: { label: string; open: boolean; onToggle: () => void; icon: "plus"|"minus" }) {
  return (
    <button onClick={onToggle} style={{
      display: "flex", alignItems: "center", gap: 8, width: "100%",
      background: "none", border: "none", cursor: "pointer", padding: "6px 0", color: "var(--text-secondary)",
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>
        {icon === "minus" ? "⊖" : "⊕"} {label}
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </button>
  );
}

function ChipSelector({ label, items, selected, onToggle, getLabel, getIcon }:
  { label: string; items: any[]; selected: string[]; onToggle: (id: string) => void; getLabel: (i: any) => string; getIcon?: (i: any) => any }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      {items.length === 0
        ? <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "6px 0" }}>No {label.toLowerCase()} found</div>
        : <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {items.map((item: any) => {
              const active = selected.includes(item.id);
              return (
                <button key={item.id} onClick={() => onToggle(item.id)} style={{
                  padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  background: active ? "rgba(88,101,242,0.15)" : "var(--bg-input)",
                  color: active ? "#5865f2" : "var(--text-secondary)",
                  border: active ? "1px solid rgba(88,101,242,0.3)" : "1px solid var(--border)",
                  transition: "all 0.12s", display: "flex", alignItems: "center", gap: 4,
                }}>
                  {getIcon?.(item)}{getLabel(item)}
                </button>
              );
            })}
          </div>
      }
    </div>
  );
}

// ── Rule Form ────────────────────────────────────────────────────────────────

function RuleForm({ initial, usedSingletonTypes, roles, channels, onSave, onCancel, isEdit }:
  { initial: any; usedSingletonTypes: Set<string>; roles: any[]; channels: any[]; onSave: (r: any) => void; onCancel: () => void; isEdit: boolean }) {
  const [draft, setDraft] = useState<any>(initial);
  const [permOpen, setPermOpen] = useState(false);
  const [optsOpen, setOptsOpen] = useState(false);

  const set = (key: string, val: any) => setDraft((d: any) => ({ ...d, [key]: val }));
  const setOpt = (key: string, val: any) => setDraft((d: any) => ({ ...d, options: { ...d.options, [key]: val } }));
  const togglePerm = (key: string, id: string) => {
    setDraft((d: any) => {
      const list: string[] = d[key] ?? [];
      return { ...d, [key]: list.includes(id) ? list.filter((x: string) => x !== id) : [...list, id] };
    });
  };

  const changeType = (type: string) => {
    setDraft((d: any) => ({ ...d, type, options: defaultOptions(type) }));
  };

  const availableTypes = RULE_TYPES.filter(t =>
    !SINGLETON_TYPES.has(t.value) ||
    !usedSingletonTypes.has(t.value) ||
    (isEdit && draft.type === t.value)
  );

  const typeInfo = RULE_TYPE_MAP[draft.type];
  const hasOptions = !["invite", "ghostPing", "phishing"].includes(draft.type);
  const needsDuration = draft.action === "mute" || draft.action === "ban";

  const addWord = (list: "words"|"wildcardWords", w: string) => {
    setOpt(list, [...(draft.options[list] ?? []), w]);
  };
  const removeWord = (list: "words"|"wildcardWords", w: string) => {
    setOpt(list, (draft.options[list] ?? []).filter((x: string) => x !== w));
  };
  const addDomain = (domain: string) => {
    const d = domain.toLowerCase().replace(/^(?:https?:\/\/)?(?:www\.)?/, "").split("/")[0];
    if (!d || (draft.options.domains ?? []).includes(d)) return;
    setOpt("domains", [...(draft.options.domains ?? []), d]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Name */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Name</div>
        <input value={draft.name} onChange={e => set("name", e.target.value)} placeholder="Rule Name"
          style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, outline: "none" }} />
      </div>

      {/* Rule Type */}
      {!isEdit && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Rule Type</div>
          <select value={draft.type} onChange={e => changeType(e.target.value)}
            style={{ width: "100%", padding: "9px 12px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, color: draft.type ? "var(--text-primary)" : "var(--text-muted)", fontSize: 13, outline: "none", cursor: "pointer" }}>
            <option value="" disabled>Select...</option>
            {availableTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {typeInfo && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>{typeInfo.desc}</div>}
        </div>
      )}

      {draft.type && (
        <>
          {/* Actions */}
          <SectionDivider label="Actions" open icon="minus" onToggle={() => {}} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 0 4px" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Actions</div>
              <select value={draft.action} onChange={e => set("action", e.target.value)}
                style={{ width: "100%", padding: "9px 12px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, outline: "none", cursor: "pointer" }}>
                <option value="" disabled>Select...</option>
                {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            {needsDuration && (
              <input value={draft.actionDuration} onChange={e => set("actionDuration", e.target.value)}
                placeholder="Duration (e.g. 10m, 1h, 7d)"
                style={{ padding: "9px 12px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, outline: "none" }} />
            )}
          </div>

          {/* Permissions */}
          <SectionDivider label="Permissions" open={permOpen} icon={permOpen ? "minus" : "plus"} onToggle={() => setPermOpen(v => !v)} />
          {permOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "4px 0 8px" }}>
              <ChipSelector label="Affected Roles" items={roles} selected={draft.affectedRoles}
                onToggle={id => togglePerm("affectedRoles", id)} getLabel={(r: any) => `@${r.name}`} />
              <ChipSelector label="Ignored Roles" items={roles} selected={draft.ignoredRoles}
                onToggle={id => togglePerm("ignoredRoles", id)} getLabel={(r: any) => `@${r.name}`} />
              <ChipSelector label="Affected Channels" items={channels} selected={draft.affectedChannels}
                onToggle={id => togglePerm("affectedChannels", id)} getLabel={(ch: any) => `#${ch.name}`}
                getIcon={() => <Hash size={10} />} />
              <ChipSelector label="Ignored Channels" items={channels} selected={draft.ignoredChannels}
                onToggle={id => togglePerm("ignoredChannels", id)} getLabel={(ch: any) => `#${ch.name}`}
                getIcon={() => <Hash size={10} />} />
            </div>
          )}

          {/* Additional Options */}
          {hasOptions && (
            <>
              <SectionDivider label="Additional Options" open={optsOpen} icon={optsOpen ? "minus" : "plus"} onToggle={() => setOptsOpen(v => !v)} />
              {optsOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "4px 0 8px" }}>
                  {(draft.type === "filter" || draft.type === "custom") && (
                    <>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Exact-Match Words</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>Whole word only — <em>"bad"</em> won't catch <em>"badge"</em>. Anti-bypass normalized.</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                          {(draft.options.words ?? []).map((w: string) => (
                            <WordPill key={w} word={w} color="red" onRemove={() => removeWord("words", w)} />
                          ))}
                          {(draft.options.words ?? []).length === 0 && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>None</span>}
                        </div>
                        <InlineWordInput placeholder="Add word…" onAdd={w => addWord("words", w)} />
                      </div>
                      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Wildcard / Substring</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>Triggers anywhere in the message. Use <code style={{ background: "var(--bg-input)", padding: "1px 4px", borderRadius: 3 }}>*</code> as wildcard.</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                          {(draft.options.wildcardWords ?? []).map((w: string) => (
                            <WordPill key={w} word={w} color="amber" onRemove={() => removeWord("wildcardWords", w)} />
                          ))}
                          {(draft.options.wildcardWords ?? []).length === 0 && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>None</span>}
                        </div>
                        <InlineWordInput placeholder="e.g. f*ck, *nsfw*" onAdd={w => addWord("wildcardWords", w)} />
                      </div>
                    </>
                  )}
                  {draft.type === "mention" && (
                    <Input label="Max Mentions" type="number" value={String(draft.options.threshold ?? 5)} onChange={v => setOpt("threshold", Number(v))} />
                  )}
                  {draft.type === "spam" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <Input label="Max messages" type="number" value={String(draft.options.limit ?? 5)} onChange={v => setOpt("limit", Number(v))} />
                      <Input label="Window (ms)" type="number" value={String(draft.options.windowMs ?? 5000)} onChange={v => setOpt("windowMs", Number(v))} />
                    </div>
                  )}
                  {draft.type === "duplicate" && (
                    <Input label="Duplicate count" type="number" value={String(draft.options.count ?? 3)} onChange={v => setOpt("count", Number(v))} />
                  )}
                  {draft.type === "charFlood" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <Input label="Max repeated chars" type="number" value={String(draft.options.maxRepeat ?? 10)} onChange={v => setOpt("maxRepeat", Number(v))} />
                      <Input label="Max emoji" type="number" value={String(draft.options.maxEmoji ?? 10)} onChange={v => setOpt("maxEmoji", Number(v))} />
                    </div>
                  )}
                  {draft.type === "linkSpam" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <Input label="Max links" type="number" value={String(draft.options.limit ?? 5)} onChange={v => setOpt("limit", Number(v))} />
                      <Input label="Window (ms)" type="number" value={String(draft.options.windowMs ?? 10000)} onChange={v => setOpt("windowMs", Number(v))} />
                    </div>
                  )}
                  {draft.type === "urlFilter" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{
                        padding: "12px 14px", borderRadius: 8,
                        background: draft.options.blockAll ? "rgba(239,68,68,0.07)" : "var(--bg-input)",
                        border: `1px solid ${draft.options.blockAll ? "rgba(239,68,68,0.25)" : "var(--border)"}`,
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>🚫 Block All Links</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Delete every URL. Only domains below are allowed.</div>
                        </div>
                        <Toggle checked={draft.options.blockAll ?? false} onChange={v => { setOpt("blockAll", v); if (v) setOpt("mode", "whitelist"); }} />
                      </div>
                      {!draft.options.blockAll && (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Mode</div>
                          <select value={draft.options.mode} onChange={e => setOpt("mode", e.target.value)}
                            style={{ width: "100%", padding: "9px 12px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, outline: "none", cursor: "pointer" }}>
                            <option value="blacklist">Blacklist — block listed domains</option>
                            <option value="whitelist">Whitelist — only allow listed domains</option>
                          </select>
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {draft.options.blockAll || draft.options.mode === "whitelist" ? "Allowed Domains" : "Blocked Domains"}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                          {(draft.options.domains ?? []).map((d: string) => (
                            <WordPill key={d} word={d} color={draft.options.blockAll || draft.options.mode === "whitelist" ? "amber" : "red"}
                              onRemove={() => setOpt("domains", (draft.options.domains ?? []).filter((x: string) => x !== d))} />
                          ))}
                          {(draft.options.domains ?? []).length === 0 && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{draft.options.blockAll ? "No exceptions — all links blocked" : "No domains yet"}</span>}
                        </div>
                        <InlineWordInput placeholder="e.g. discord.com, youtube.com" onAdd={addDomain} />
                      </div>
                    </div>
                  )}
                  {draft.type === "wallText" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <Input label="Max chars" type="number" value={String(draft.options.maxLength ?? 500)} onChange={v => setOpt("maxLength", Number(v))} />
                      <Input label="Max lines" type="number" value={String(draft.options.maxLines ?? 15)} onChange={v => setOpt("maxLines", Number(v))} />
                    </div>
                  )}
                  {draft.type === "fileFilter" && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Blocked Extensions</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>Without the dot — e.g. <code style={{ background: "var(--bg-input)", padding: "1px 4px", borderRadius: 3 }}>exe</code>, <code style={{ background: "var(--bg-input)", padding: "1px 4px", borderRadius: 3 }}>sh</code>, <code style={{ background: "var(--bg-input)", padding: "1px 4px", borderRadius: 3 }}>bat</code></div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                        {(draft.options.blockedExtensions ?? []).map((ext: string) => (
                          <WordPill key={ext} word={`.${ext}`} color="red"
                            onRemove={() => setOpt("blockedExtensions", (draft.options.blockedExtensions ?? []).filter((x: string) => x !== ext))} />
                        ))}
                        {(draft.options.blockedExtensions ?? []).length === 0 && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>No extensions blocked yet</span>}
                      </div>
                      <InlineWordInput placeholder="e.g. exe, bat, sh, js" onAdd={rawExt => {
                        const ext = rawExt.toLowerCase().replace(/^\./, "");
                        if (!ext || (draft.options.blockedExtensions ?? []).includes(ext)) return;
                        setOpt("blockedExtensions", [...(draft.options.blockedExtensions ?? []), ext]);
                      }} />
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Footer buttons */}
          <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
            <Button onClick={() => onSave(draft)} style={{ background: "#e0234e", color: "#fff", border: "none" }}>
              {isEdit ? <><Check size={13} /> Save Changes</> : <><Plus size={13} /> Create Rule</>}
            </Button>
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Automod() {
  const { guildId } = useParams<{ guildId: string }>();
  const [uiRules, setUiRules] = useState<any[]>([]);
  const [base, setBase] = useState<any>({ silent: false, punishment: { steps: [] }, warnExpiryDays: "7" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { show, ToastEl } = useToast();
  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const savedState = useRef<any>(null);
  const currentState = () => ({ uiRules, base });
  const dirty = savedState.current !== null && JSON.stringify(currentState()) !== JSON.stringify(savedState.current);

  const load = async () => {
    if (!guildId) return;
    const [c, chs, rls] = await Promise.all([
      api.guild.automod(guildId).catch(() => null),
      api.guild.channels(guildId).catch(() => []),
      api.guild.roles(guildId).catch(() => []),
    ]);
    setChannels(chs);
    setRoles(rls);
    if (c) {
      const rules = configToUIRules(c);
      const b = { silent: c.silent ?? false, punishment: c.punishment ?? { steps: [] }, warnExpiryDays: c.warnExpiryDays?.toString() ?? "7" };
      setUiRules(rules);
      setBase(b);
      savedState.current = JSON.parse(JSON.stringify({ uiRules: rules, base: b }));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [guildId]);

  const usedSingletonTypes = new Set(uiRules.filter(r => SINGLETON_TYPES.has(r.type)).map(r => r.type));

  const deleteRule = (id: string) => setUiRules(prev => prev.filter(r => r.id !== id));
  const toggleRule = (id: string) => setUiRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  const saveRule = (updated: any) => {
    setUiRules(prev => {
      const idx = prev.findIndex(r => r.id === updated.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
      return [...prev, updated];
    });
    setEditingId(null);
    setCreating(false);
  };

  const STEP_CAP = 10;
  const updateBase = (key: string, val: any) => setBase((b: any) => ({ ...b, [key]: val }));
  const updateStep = (i: number, patch: any) => {
    const steps = [...(base.punishment?.steps ?? [])];
    steps[i] = { ...steps[i], ...patch };
    updateBase("punishment", { ...base.punishment, steps });
  };
  const addStep = () => {
    const steps = [...(base.punishment?.steps ?? [])];
    if (steps.length >= STEP_CAP) return show(`Maximum ${STEP_CAP} steps.`, "error");
    steps.push({ strikes: steps.length + 3, action: "mute" });
    updateBase("punishment", { ...base.punishment, steps });
  };
  const removeStep = (i: number) => {
    const steps = [...(base.punishment?.steps ?? [])];
    steps.splice(i, 1);
    updateBase("punishment", { ...base.punishment, steps });
  };

  const expiryError = Number(base.warnExpiryDays) > 30;

  const save = async () => {
    if (!guildId) return;
    if (expiryError) return show("AutoMod warning expiry cannot exceed 30 days.", "error");
    setSaving(true);
    try {
      await api.guild.updateAutomod(guildId, uiRulesToConfig(uiRules, base));
      savedState.current = JSON.parse(JSON.stringify(currentState()));
      show("AutoMod settings saved!", "success");
    } catch (e: any) { show(e.message ?? "Failed", "error"); }
    finally { setSaving(false); }
  };

  const discard = () => {
    if (savedState.current) {
      setUiRules(JSON.parse(JSON.stringify(savedState.current.uiRules)));
      setBase(JSON.parse(JSON.stringify(savedState.current.base)));
      setEditingId(null);
      setCreating(false);
    }
  };

  if (loading) return <Spinner />;

  const newRuleDraft = () => ({
    id: uid(), name: "", type: "", action: "warn", actionDuration: "",
    ignoredRoles: [], ignoredChannels: [], affectedRoles: [], affectedChannels: [],
    enabled: true, options: {},
  });

  return (
    <div style={{ padding: "32px 32px 96px", maxWidth: 800 }}>
      {ToastEl}
      <PageHeader title="AutoMod" subtitle="Configure automatic moderation rules for your server" />

      {/* ── Rules ─────────────────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Rules</div>
          {!creating && (
            <Button size="sm" onClick={() => { setCreating(true); setEditingId(null); }}
              style={{ background: "#e0234e", color: "#fff", border: "none" }}>
              <Plus size={13} /> Add Rule
            </Button>
          )}
        </div>

        {/* Rule list */}
        {uiRules.length === 0 && !creating && (
          <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>
            No rules yet. Click <strong>Add Rule</strong> to create your first automod rule.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {uiRules.map(rule => {
            const isEditing = editingId === rule.id;
            return (
              <div key={rule.id} style={{
                borderRadius: 10, border: `1px solid ${isEditing ? "rgba(88,101,242,0.4)" : "var(--border)"}`,
                background: isEditing ? "rgba(88,101,242,0.04)" : rule.enabled ? "var(--bg-input)" : "rgba(0,0,0,0.12)",
                overflow: "hidden", transition: "border-color 0.15s",
              }}>
                {/* Row header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px" }}>
                  <TypeBadge type={rule.type} />
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: rule.enabled ? "var(--text-primary)" : "var(--text-muted)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {rule.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginRight: 4, whiteSpace: "nowrap" }}>
                    {ACTIONS.find(a => a.value === rule.action)?.label ?? rule.action}
                  </div>
                  <Toggle checked={rule.enabled} onChange={() => toggleRule(rule.id)} />
                  <button onClick={() => { setEditingId(isEditing ? null : rule.id); setCreating(false); }}
                    style={{ background: "none", border: "none", color: isEditing ? "#5865f2" : "var(--text-muted)", cursor: "pointer", padding: "4px 6px", borderRadius: 5 }}>
                    {isEditing ? <X size={14} /> : <Pencil size={13} />}
                  </button>
                  <button onClick={() => { deleteRule(rule.id); if (editingId === rule.id) setEditingId(null); }}
                    style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: "4px 6px", borderRadius: 5, opacity: 0.75 }}>
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Inline edit form */}
                {isEditing && (
                  <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--border)" }}>
                    <div style={{ height: 14 }} />
                    <RuleForm
                      initial={rule}
                      usedSingletonTypes={usedSingletonTypes}
                      roles={roles}
                      channels={channels}
                      onSave={saveRule}
                      onCancel={() => setEditingId(null)}
                      isEdit
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* Create form */}
          {creating && (
            <div style={{
              borderRadius: 10, border: "1px solid rgba(224,35,78,0.4)",
              background: "rgba(224,35,78,0.03)", padding: "16px",
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>New Rule</div>
              <RuleForm
                initial={newRuleDraft()}
                usedSingletonTypes={usedSingletonTypes}
                roles={roles}
                channels={channels}
                onSave={saveRule}
                onCancel={() => setCreating(false)}
                isEdit={false}
              />
            </div>
          )}
        </div>
      </Card>

      {/* ── Warning Expiry ───────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>⏱ AutoMod Warning Expiry</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14 }}>
          Strikes older than this many days are ignored when counting escalation steps. Enter <strong>0</strong> to never expire.
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Input label="Strikes expire after (days)" type="number"
              value={base.warnExpiryDays ?? ""} onChange={v => updateBase("warnExpiryDays", v.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 7" hint="0 = never expire. Maximum: 30 days." />
          </div>
          {base.warnExpiryDays !== "" && (
            <div style={{ paddingBottom: 22, fontSize: 13, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
              {base.warnExpiryDays === "0" ? "Never expires" : `= ${base.warnExpiryDays} day${base.warnExpiryDays === "1" ? "" : "s"}`}
            </div>
          )}
        </div>
        {expiryError && (
          <div style={{ marginTop: 8, padding: "8px 12px", background: "var(--danger-dim)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 7, fontSize: 12, color: "var(--danger)" }}>
            ❌ Maximum is 30 days. Enter a value between 0 and 30.
          </div>
        )}
      </Card>

      {/* ── Silent Mode ──────────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Silent Mode</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              Only DM the user when AutoMod triggers — no public warning in channel
            </div>
          </div>
          <Toggle checked={base.silent} onChange={v => updateBase("silent", v)} />
        </div>
      </Card>

      {/* ── Punishment Escalation ────────────────────────────────────────── */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Punishment Escalation</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: base.punishment.steps.length >= STEP_CAP ? "var(--danger)" : "var(--text-muted)" }}>
              {base.punishment.steps.length}/{STEP_CAP}
            </span>
            <Button size="sm" onClick={addStep} disabled={base.punishment.steps.length >= STEP_CAP}>
              <Plus size={13} /> Add Step
            </Button>
          </div>
        </div>
        {base.punishment.steps.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>
            No escalation steps. Violations only trigger a warning by default.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {base.punishment.steps.map((step: any, i: number) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ flex: 0, fontSize: 12, fontWeight: 700, color: "var(--text-muted)", minWidth: 20 }}>#{i+1}</div>
                <input type="number" value={step.strikes} onChange={e => updateStep(i, { strikes: Number(e.target.value) })}
                  style={{ width: 60, padding: "7px 10px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: 12, outline: "none", textAlign: "center" }} />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>strikes →</span>
                <select value={step.action} onChange={e => updateStep(i, { action: e.target.value })}
                  style={{ padding: "7px 10px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: 12, outline: "none", cursor: "pointer", flex: 1 }}>
                  {["mute","kick","ban"].map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase()+a.slice(1)}</option>)}
                </select>
                {(step.action === "mute" || step.action === "ban") && (
                  <input value={step.duration ?? ""} onChange={e => updateStep(i, { duration: e.target.value })}
                    placeholder="e.g. 1h"
                    style={{ width: 80, padding: "7px 10px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: 12, outline: "none" }} />
                )}
                <button onClick={() => removeStep(i)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 4 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
    </div>
  );
}
