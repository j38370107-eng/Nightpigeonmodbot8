import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import yaml from "js-yaml";
import CodeMirror from "@uiw/react-codemirror";
import { yaml as yamlLang } from "@codemirror/lang-yaml";
import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { Extension } from "@codemirror/state";

type SaveState = "idle" | "saving" | "saved" | "error";

const nightPigeonTheme = EditorView.theme({
  "&": {
    background: "#161c27",
    color: "#dce7f5",
    height: "100%",
    fontSize: "13px",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
  },
  ".cm-content": {
    padding: "14px 16px",
    lineHeight: "1.65",
    caretColor: "#57f287",
  },
  ".cm-gutters": {
    background: "#1c2333",
    color: "#3a4a63",
    border: "none",
    borderRight: "1px solid #2a3349",
    minWidth: "48px",
    padding: "14px 10px 14px 0",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
    fontSize: "13px",
    lineHeight: "1.65",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 6px 0 0",
    lineHeight: "1.65",
    minWidth: "32px",
    textAlign: "right",
  },
  ".cm-activeLine": { background: "rgba(87,242,135,0.04)" },
  ".cm-activeLineGutter": { background: "rgba(87,242,135,0.07)", color: "#7a9abf" },
  ".cm-cursor": { borderLeftColor: "#57f287" },
  ".cm-selectionBackground, ::selection": { background: "rgba(87,242,135,0.18) !important" },
  ".cm-focused .cm-selectionBackground": { background: "rgba(87,242,135,0.18)" },
  ".cm-line": { padding: "0" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { overflow: "auto", lineHeight: "1.65" },
  ".cm-foldGutter": { display: "none" },
}, { dark: true });

const nightPigeonHighlight = HighlightStyle.define([
  { tag: tags.comment,           color: "#5c6f8a", fontStyle: "italic" },
  { tag: tags.keyword,           color: "#c678dd" },
  { tag: tags.string,            color: "#98c379" },
  { tag: tags.number,            color: "#d19a66" },
  { tag: tags.bool,              color: "#d19a66" },
  { tag: tags.null,              color: "#d19a66" },
  { tag: tags.atom,              color: "#d19a66" },
  { tag: tags.propertyName,      color: "#e06c75" },
  { tag: tags.punctuation,       color: "#7a8ba8" },
  { tag: tags.operator,          color: "#56b6c2" },
  { tag: tags.typeName,          color: "#e5c07b" },
  { tag: tags.variableName,      color: "#dce7f5" },
  { tag: tags.definition(tags.propertyName), color: "#e06c75", fontWeight: "600" },
]);

const extensions: Extension[] = [
  yamlLang(),
  nightPigeonTheme,
  syntaxHighlighting(nightPigeonHighlight),
  EditorView.lineWrapping,
];

export default function YamlConfig() {
  const { guildId } = useParams<{ guildId: string }>();
  const [guildName, setGuildName] = useState("");
  const [original, setOriginal] = useState("");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [validationError, setValidationError] = useState("");

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
      <h1 style={{
        fontSize: 28, fontWeight: 700, color: "var(--text-primary)",
        marginBottom: 20, letterSpacing: "-0.3px",
      }}>
        {guildName ? `Config for ${guildName}` : "Config"}
      </h1>

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

      {loading ? (
        <div style={{
          height: 520, borderRadius: 6, border: "1px solid var(--border)",
          background: "var(--yaml-bg)", display: "flex", alignItems: "center",
          justifyContent: "center", color: "var(--text-muted)", fontSize: 13,
        }}>
          Loading configuration…
        </div>
      ) : (
        <div style={{
          height: "calc(100vh - 240px)", minHeight: 400,
          borderRadius: 6, border: "1px solid var(--border)",
          overflow: "hidden",
        }}>
          <CodeMirror
            value={value}
            onChange={handleChange}
            extensions={extensions}
            basicSetup={{
              lineNumbers: true,
              foldGutter: false,
              highlightActiveLineGutter: true,
              highlightActiveLine: true,
              autocompletion: false,
              searchKeymap: false,
              bracketMatching: true,
              indentOnInput: true,
              tabSize: 2,
            }}
            style={{ height: "100%" }}
          />
        </div>
      )}
    </div>
  );
}
