import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import yaml from "js-yaml";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function YamlConfig() {
  const { guildId } = useParams<{ guildId: string }>();
  const [guildName, setGuildName] = useState("");
  const [original, setOriginal] = useState("");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [validationError, setValidationError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    if (!guildId) return;
    setLoading(true);
    Promise.all([
      api.guild.yamlConfig(guildId),
      api.auth.guilds(),
    ]).then(([res, guilds]) => {
      setValue((res as any).yaml);
      setOriginal((res as any).yaml);
      const g = guilds.find((g: any) => g.id === guildId);
      if (g) setGuildName(g.name);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [guildId]);

  useEffect(() => { load(); }, [load]);

  const handleChange = (v: string) => {
    setValue(v);
    setSaveState("idle");
    setErrorMsg("");
    try {
      yaml.load(v);
      setValidationError("");
    } catch (e: any) {
      setValidationError(e.message ?? "Invalid YAML");
    }
  };

  const handleSave = async () => {
    if (!guildId || validationError || saveState === "saving") return;
    setSaveState("saving");
    setErrorMsg("");
    try {
      await api.guild.updateYamlConfig(guildId, value);
      setOriginal(value);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 3000);
    } catch (e: any) {
      setErrorMsg(e.message ?? "Failed to save");
      setSaveState("error");
    }
  };

  // Sync gutter scroll with textarea
  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Keyboard shortcut: Ctrl/Cmd+S to save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const lines = value.split("\n");
  const isDirty = value !== original;

  const saveLabel =
    saveState === "saving" ? "Saving…" :
    saveState === "saved"  ? "Saved!" :
    saveState === "error"  ? "Error" :
    "Save";

  const saveBg =
    saveState === "saved"  ? "#388040" :
    saveState === "error"  ? "#8b2020" :
    validationError        ? "#3a4a3a" :
    "#4a9e5c";

  return (
    <div style={{ padding: "36px 32px", maxWidth: 980, minHeight: "100%", boxSizing: "border-box" }}>
      {/* Title */}
      <h1 style={{
        fontSize: 28, fontWeight: 700, color: "var(--text-primary)",
        marginBottom: 20, letterSpacing: "-0.3px",
      }}>
        {guildName ? `Config for ${guildName}` : "Config"}
      </h1>

      {/* Save button row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button
          onClick={handleSave}
          disabled={!isDirty || !!validationError || saveState === "saving"}
          style={{
            padding: "8px 24px", borderRadius: 5, fontSize: 14, fontWeight: 600,
            background: saveBg,
            border: "none", color: "#fff",
            cursor: (isDirty && !validationError) ? "pointer" : "not-allowed",
            opacity: (!isDirty || validationError) ? 0.55 : 1,
            fontFamily: "inherit",
            transition: "background 0.2s, opacity 0.2s",
            minWidth: 80,
          }}
        >
          {saveLabel}
        </button>

        {isDirty && !validationError && (
          <button
            onClick={() => { setValue(original); setSaveState("idle"); setValidationError(""); setErrorMsg(""); }}
            style={{
              padding: "8px 16px", borderRadius: 5, fontSize: 14, fontWeight: 500,
              background: "none", border: "1px solid var(--border)",
              color: "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Reset
          </button>
        )}

        {validationError && (
          <span style={{ fontSize: 12, color: "#ed4245", maxWidth: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            ⚠ {validationError}
          </span>
        )}
        {saveState === "error" && errorMsg && (
          <span style={{ fontSize: 12, color: "#ed4245" }}>⚠ {errorMsg}</span>
        )}

        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
          Ctrl+S to save · {lines.length} lines
          {isDirty && <span style={{ color: "var(--accent)", marginLeft: 8 }}>● unsaved</span>}
        </span>
      </div>

      {/* Editor */}
      {loading ? (
        <div style={{
          height: 520, borderRadius: 6, border: "1px solid var(--border)",
          background: "var(--yaml-bg)", display: "flex", alignItems: "center",
          justifyContent: "center", color: "var(--text-muted)", fontSize: 13,
        }}>
          Loading configuration…
        </div>
      ) : (
        <div className="yaml-editor-wrap" style={{ height: "calc(100vh - 240px)", minHeight: 400 }}>
          {/* Gutter */}
          <div
            ref={gutterRef}
            className="yaml-gutter"
            style={{ overflowY: "hidden" }}
          >
            {lines.map((_, i) => (
              <span key={i} className="yaml-gutter-line">{i + 1}</span>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            className="yaml-textarea"
            value={value}
            onChange={e => handleChange(e.target.value)}
            onScroll={handleScroll}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>
      )}
    </div>
  );
}
