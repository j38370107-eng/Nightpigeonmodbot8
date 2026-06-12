import { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { CheckCircle, AlertCircle, Zap, Loader, LogIn } from "lucide-react";

async function fetchMe() {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

async function fetchForm(guildId: string, formId: string) {
  const res = await fetch(`/api/apply/${guildId}/${formId}`);
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Failed"); }
  return res.json();
}

async function submitForm(guildId: string, formId: string, body: any) {
  const res = await fetch(`/api/apply/${guildId}/${formId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Failed"); }
  return res.json();
}

export default function Apply() {
  const { guildId, formId } = useParams<{ guildId: string; formId: string }>();
  const location = useLocation();

  const [me, setMe] = useState<{ id: string; tag: string } | null | "loading">("loading");
  const [form, setForm] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetchMe().then(setMe).catch(() => setMe(null));
  }, []);

  useEffect(() => {
    if (!guildId || !formId) return;
    fetchForm(guildId, formId)
      .then(setForm)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [guildId, formId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guildId || !formId || !me || me === "loading") return;
    setSubmitError(null);

    for (const q of form.questions) {
      if (q.required && !answers[q.id]?.trim()) {
        setSubmitError(`"${q.label}" is required.`);
        return;
      }
      if ((q.minChars ?? 0) > 0 && (answers[q.id]?.trim().length ?? 0) < q.minChars) {
        setSubmitError(`"${q.label}" requires at least ${q.minChars} characters.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await submitForm(guildId, formId, {
        userId: (me as any).id,
        userTag: (me as any).tag,
        answers,
      });
      setSubmitted(true);
    } catch (e: any) {
      setSubmitError(e.message ?? "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px",
    background: "#1e2030", border: "1px solid #2e3148",
    borderRadius: 8, color: "#e2e8f0", fontSize: 14, outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: "#94a3b8",
    display: "block", marginBottom: 6,
  };

  const loginUrl = `/api/auth/login?returnTo=${encodeURIComponent(location.pathname)}`;

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
      <div style={{ width: "100%", maxWidth: 580 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(240,165,0,0.1)", border: "2px solid #f0a500", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Zap size={20} color="#f0a500" />
          </div>
          <div style={{ fontSize: 11, color: "#f0a500", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, fontWeight: 700 }}>Application Form</div>
          {form && (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#e2e8f0", margin: "0 0 10px" }}>{form.title}</h1>
              {form.description && (
                <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.7, margin: "0 auto", maxWidth: 480 }}>{form.description}</p>
              )}
            </>
          )}
        </div>

        {/* Auth loading */}
        {me === "loading" && (
          <div style={{ textAlign: "center", color: "#64748b", padding: 48 }}>
            <Loader size={28} style={{ animation: "spin 1s linear infinite", marginBottom: 12 }} />
            <div>Checking login…</div>
          </div>
        )}

        {/* Not logged in */}
        {me === null && (
          <div style={{ background: "#161824", border: "1px solid #2e3148", borderRadius: 14, padding: "36px 32px", textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(88,101,242,0.12)", border: "2px solid rgba(88,101,242,0.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
              <LogIn size={22} color="#5865f2" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#e2e8f0", marginBottom: 8 }}>Login required</h2>
            <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 24, lineHeight: 1.6 }}>
              You need to log in with Discord to submit this application. This lets staff know who you are.
            </p>
            <a
              href={loginUrl}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "11px 24px", background: "#5865f2", color: "#fff",
                borderRadius: 8, fontSize: 14, fontWeight: 700,
                textDecoration: "none", transition: "opacity 0.15s",
              }}
              onMouseOver={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseOut={e => (e.currentTarget.style.opacity = "1")}
            >
              <LogIn size={16} /> Login with Discord
            </a>
          </div>
        )}

        {/* Form loading */}
        {me && me !== "loading" && loading && (
          <div style={{ textAlign: "center", color: "#64748b", padding: 48 }}>
            <Loader size={28} style={{ animation: "spin 1s linear infinite", marginBottom: 12 }} />
            <div>Loading form…</div>
          </div>
        )}

        {/* Form error */}
        {me && me !== "loading" && error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: 24, textAlign: "center", color: "#f87171" }}>
            <AlertCircle size={32} style={{ marginBottom: 10, opacity: 0.8 }} />
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Unable to load form</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>{error}</div>
          </div>
        )}

        {/* Submitted */}
        {submitted && (
          <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 12, padding: 36, textAlign: "center", color: "#4ade80" }}>
            <CheckCircle size={40} style={{ marginBottom: 12, opacity: 0.9 }} />
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "#e2e8f0" }}>Submitted!</div>
            <div style={{ fontSize: 14, color: "#94a3b8" }}>Your application has been received. Staff will review it shortly.</div>
          </div>
        )}

        {/* The actual form */}
        {me && me !== "loading" && form && !submitted && (
          <div style={{ background: "#161824", border: "1px solid #2e3148", borderRadius: 14, padding: "28px 32px" }}>
            {/* Logged-in user pill */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(88,101,242,0.08)", border: "1px solid rgba(88,101,242,0.2)", borderRadius: 8, padding: "8px 12px", marginBottom: 24 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#5865f2", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Applying as </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{(me as any).tag}</span>
              <a href={loginUrl} style={{ marginLeft: "auto", fontSize: 12, color: "#64748b", textDecoration: "underline" }}>Switch account</a>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {form.questions.map((q: any) => {
                  const charCount = answers[q.id]?.trim().length ?? 0;
                  const minChars = q.minChars ?? 0;
                  const minMet = minChars === 0 || charCount >= minChars;
                  return (
                  <div key={q.id}>
                    <label style={labelStyle}>
                      {q.label}
                      {q.required && <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>}
                    </label>
                    {q.description && (
                      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, lineHeight: 1.5 }}>{q.description}</div>
                    )}
                    {q.type === "long" ? (
                      <textarea
                        value={answers[q.id] ?? ""}
                        onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                        rows={4}
                        required={q.required}
                        maxLength={2000}
                        style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                        onFocus={e => (e.target.style.borderColor = "#f0a500")}
                        onBlur={e => (e.target.style.borderColor = "#2e3148")}
                      />
                    ) : q.type === "choice" && q.choices?.length > 0 ? (
                      <select
                        value={answers[q.id] ?? ""}
                        onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                        required={q.required}
                        style={{ ...inputStyle, cursor: "pointer" }}
                      >
                        <option value="">— Select an option —</option>
                        {q.choices.map((c: string, i: number) => <option key={i} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <input
                        value={answers[q.id] ?? ""}
                        onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                        required={q.required}
                        maxLength={250}
                        style={inputStyle}
                        onFocus={e => (e.target.style.borderColor = "#f0a500")}
                        onBlur={e => (e.target.style.borderColor = "#2e3148")}
                      />
                    )}
                    {minChars > 0 && (
                      <div style={{ fontSize: 11, marginTop: 5, color: minMet ? "#4ade80" : "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontWeight: 600 }}>{charCount}</span>
                        <span>/ {minChars} min. characters</span>
                        {minMet && <span style={{ color: "#4ade80" }}>✓</span>}
                      </div>
                    )}
                  </div>
                  );
                })}

                {submitError && (
                  <div style={{ fontSize: 13, color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px" }}>
                    {submitError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "11px 24px", background: submitting ? "#2e3148" : "#f0a500",
                    color: submitting ? "#64748b" : "#0f1117",
                    border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700,
                    cursor: submitting ? "not-allowed" : "pointer", transition: "all 0.15s",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  {submitting ? <><Loader size={14} /> Submitting…</> : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
