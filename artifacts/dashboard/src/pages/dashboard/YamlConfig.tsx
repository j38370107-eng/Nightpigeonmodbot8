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
type CopyState = "idle" | "copied";

const nightPigeonTheme = EditorView.theme({
  "&": {
    background: "#161c27",
    color: "#dce7f5",
    height: "100%",
    fontSize: "13px",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
  },
  ".cm-content": { padding: "14px 16px", lineHeight: "1.65", caretColor: "#57f287" },
  ".cm-gutters": {
    background: "#1c2333", color: "#3a4a63", border: "none",
    borderRight: "1px solid #2a3349", minWidth: "48px",
    padding: "14px 10px 14px 0",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
    fontSize: "13px", lineHeight: "1.65",
  },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 6px 0 0", lineHeight: "1.65", minWidth: "32px", textAlign: "right" },
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
  const [copyState, setCopyState] = useState<CopyState>("idle");

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

  const handleSave = useCallback(async () => {
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
  }, [guildId, validationError, saveState, value]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      // fallback: select all text (mobile)
      const ta = document.querySelector<HTMLTextAreaElement>(".cm-content");
      if (ta) {
        const range = document.createRange();
        range.selectNodeContents(ta);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) handleChange(text);
    } catch {
      // If clipboard read is blocked, focus the editor so the user can paste manually
      document.querySelector<HTMLElement>(".cm-content")?.focus();
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
  }, [handleSave]);

  const lines = value.split("\n").length;
  const isDirty = value !== original;

  const saveLabel =
    saveState === "saving" ? "Saving…" :
    saveState === "saved"  ? "✓ Saved" :
    saveState === "error"  ? "Error" :
    "Save";

  const saveBg =
    saveState === "saved"  ? "#388040" :
    saveState === "error"  ? "#8b2020" :
    validationError        ? "#3a4a3a" :
    "#4a9e5c";

  return (
    <div className="yaml-page">
      <div className="yaml-page-header">
        <h1 className="yaml-page-title">
          {guildName ? `${guildName} — Config` : "Config"}
        </h1>
      </div>

      {/* Toolbar */}
      <div className="yaml-toolbar">
        <div className="yaml-toolbar-left">
          <button
            onClick={handleSave}
            disabled={!isDirty || !!validationError || saveState === "saving"}
            className="yaml-btn yaml-btn-save"
            style={{ background: saveBg, opacity: (!isDirty || !!validationError) ? 0.5 : 1 }}
          >
            {saveLabel}
          </button>

          {isDirty && !validationError && (
            <button
              onClick={() => { setValue(original); setSaveState("idle"); setValidationError(""); setErrorMsg(""); }}
              className="yaml-btn yaml-btn-ghost"
            >
              Reset
            </button>
          )}

          <button onClick={handleCopy} className="yaml-btn yaml-btn-ghost" title="Copy config to clipboard">
            {copyState === "copied" ? "✓ Copied" : "Copy"}
          </button>

          <button onClick={handlePaste} className="yaml-btn yaml-btn-ghost" title="Paste config from clipboard">
            Paste
          </button>
        </div>

        <div className="yaml-toolbar-right">
          {validationError && (
            <span className="yaml-error-msg">⚠ {validationError}</span>
          )}
          {saveState === "error" && errorMsg && (
            <span className="yaml-error-msg">⚠ {errorMsg}</span>
          )}
          <span className="yaml-meta">
            <span className="yaml-meta-hint">Ctrl+S to save</span>
            <span> · {lines} lines</span>
            {isDirty && <span className="yaml-dirty-dot"> ● unsaved</span>}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="yaml-loading">Loading configuration…</div>
      ) : (
        <div className="yaml-cm-wrap yaml-editor-container">
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
