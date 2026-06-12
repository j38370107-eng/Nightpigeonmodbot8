import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Card, Button, Input, TextArea, Select, Toggle, PageHeader, Badge, Modal, Spinner, EmptyState, useToast } from "../../components/ui";
import { Plus, Trash2, Edit2, Eye, ClipboardList, ArrowLeft, Link, ShieldOff, ChevronUp, ChevronDown } from "lucide-react";

type ViewMode = "forms" | "submissions" | "config";

function generateId() { return Math.random().toString(36).slice(2, 9); }

const CHOICE_CAP = 10;
const FORM_CAP = 5;

export default function Applications() {
  const { guildId } = useParams<{ guildId: string }>();
  const [forms, setForms] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("forms");
  const [selectedForm, setSelectedForm] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [modal, setModal] = useState<{ open: boolean; editing?: any }>({ open: false });
  const [subModal, setSubModal] = useState<any>(null);
  const { show, ToastEl } = useToast();

  // App-wide config (cooldown, notify, blacklist)
  const [appCfg, setAppCfg] = useState<{ cooldownHours: number; notifyApplicant: boolean; blacklist: string[] }>({
    cooldownHours: 0, notifyApplicant: true, blacklist: [],
  });
  const [blInput, setBlInput] = useState("");
  const [savingCfg, setSavingCfg] = useState(false);

  const [formDraft, setFormDraft] = useState<any>({
    title: "", description: "", questions: [], responseChannelId: "", active: true,
    cooldownHours: 0, notifyApplicant: true, approveMessage: "", denyMessage: "",
  });

  const loadForms = () => {
    if (!guildId) return;
    Promise.all([
      api.guild.applications(guildId),
      api.guild.channels(guildId),
      api.guild.appConfig(guildId),
    ]).then(([f, ch, cfg]) => {
      setForms(f);
      setChannels(ch);
      setAppCfg(cfg);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadForms(); }, [guildId]);

  const openCreate = () => {
    setFormDraft({ title:"", description:"", questions:[], responseChannelId:"", active:true });
    setModal({ open:true });
  };

  const openEdit = (form: any) => {
    setFormDraft({
      ...form,
      questions: (form.questions ?? []).map((q: any) => ({ choices: [], ...q })),
      cooldownHours: form.cooldownHours ?? 0,
      notifyApplicant: form.notifyApplicant !== false,
      approveMessage: form.approveMessage ?? "",
      denyMessage: form.denyMessage ?? "",
    });
    setModal({ open:true, editing:form });
  };

  const saveForm = async () => {
    if (!guildId || !formDraft.title.trim()) return show("Title required", "error");
    if (formDraft.questions.length === 0) return show("Add at least one question", "error");
    for (const q of formDraft.questions) {
      if (q.type === "choice" && (!q.choices || q.choices.length < 2)) {
        return show(`Question "${q.label || "Untitled"}" needs at least 2 choices`, "error");
      }
    }
    try {
      if (modal.editing) {
        await api.guild.updateApplication(guildId, modal.editing.id, formDraft);
        show("Form updated!", "success");
      } else {
        await api.guild.createApplication(guildId, formDraft);
        show("Form created!", "success");
      }
      setModal({ open:false });
      loadForms();
    } catch (e: any) {
      show(e.message ?? "Failed", "error");
    }
  };

  const deleteForm = async (id: string) => {
    if (!guildId || !confirm("Delete this form and all its submissions?")) return;
    try {
      await api.guild.deleteApplication(guildId, id);
      show("Form deleted", "success");
      loadForms();
    } catch (e: any) {
      show(e.message ?? "Failed", "error");
    }
  };

  const viewSubmissions = async (form: any) => {
    if (!guildId) return;
    setSelectedForm(form);
    setView("submissions");
    const subs = await api.guild.submissions(guildId, form.id).catch(() => []);
    setSubmissions(subs);
  };

  const updateSub = async (sub: any, status: "approved" | "denied") => {
    if (!guildId) return;
    try {
      await api.guild.updateSubmission(guildId, sub.formId, sub.id, { status });
      setSubmissions(s => s.map(x => x.id === sub.id ? { ...x, status } : x));
      show(`Submission ${status}`, "success");
    } catch (e: any) {
      show(e.message ?? "Failed", "error");
    }
  };

  const addQuestion = () => {
    setFormDraft((f: any) => ({
      ...f,
      questions: [...f.questions, { id:generateId(), label:"", type:"short", required:true, choices:[], minChars:0 }]
    }));
  };

  const moveQuestion = (id: string, dir: -1 | 1) => {
    setFormDraft((f: any) => {
      const qs = [...f.questions];
      const idx = qs.findIndex((q: any) => q.id === id);
      const target = idx + dir;
      if (target < 0 || target >= qs.length) return f;
      [qs[idx], qs[target]] = [qs[target], qs[idx]];
      return { ...f, questions: qs };
    });
  };

  const updateQuestion = (id: string, field: string, value: any) => {
    setFormDraft((f: any) => ({
      ...f,
      questions: f.questions.map((q: any) => q.id === id ? { ...q, [field]: value } : q)
    }));
  };

  const removeQuestion = (id: string) => {
    setFormDraft((f: any) => ({ ...f, questions: f.questions.filter((q: any) => q.id !== id) }));
  };

  const addChoice = (qId: string) => {
    setFormDraft((f: any) => ({
      ...f,
      questions: f.questions.map((q: any) => q.id === qId
        ? { ...q, choices: [...(q.choices ?? []), ""] }
        : q
      )
    }));
  };

  const updateChoice = (qId: string, idx: number, val: string) => {
    setFormDraft((f: any) => ({
      ...f,
      questions: f.questions.map((q: any) => q.id === qId
        ? { ...q, choices: q.choices.map((c: string, i: number) => i === idx ? val : c) }
        : q
      )
    }));
  };

  const removeChoice = (qId: string, idx: number) => {
    setFormDraft((f: any) => ({
      ...f,
      questions: f.questions.map((q: any) => q.id === qId
        ? { ...q, choices: q.choices.filter((_: string, i: number) => i !== idx) }
        : q
      )
    }));
  };

  const saveAppCfg = async () => {
    if (!guildId) return;
    setSavingCfg(true);
    try {
      await api.guild.updateAppConfig(guildId, appCfg);
      show("Config saved!", "success");
    } catch (e: any) {
      show(e.message ?? "Failed", "error");
    } finally {
      setSavingCfg(false);
    }
  };

  const addBlacklist = () => {
    const uid = blInput.trim();
    if (!uid || !/^\d{17,20}$/.test(uid)) return show("Enter a valid Discord user ID (17–20 digits)", "error");
    if ((appCfg.blacklist ?? []).includes(uid)) return show("Already blacklisted", "error");
    setAppCfg(c => ({ ...c, blacklist: [...(c.blacklist ?? []), uid] }));
    setBlInput("");
  };

  const removeBlacklist = (uid: string) => {
    setAppCfg(c => ({ ...c, blacklist: (c.blacklist ?? []).filter(x => x !== uid) }));
  };

  if (loading) return <Spinner />;

  const statusColor: Record<string,any> = { pending:"warning", approved:"success", denied:"danger" };

  if (view === "submissions" && selectedForm) {
    return (
      <div style={{ padding:"32px 32px 48px" }}>
        {ToastEl}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
          <button onClick={() => setView("forms")} style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:8, padding:"7px 12px", color:"var(--text-secondary)", cursor:"pointer", display:"flex", alignItems:"center", gap:6, fontSize:13, fontFamily:"inherit" }}>
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <h1 style={{ fontSize:20, fontWeight:800, color:"var(--text-primary)" }}>{selectedForm.title} — Submissions</h1>
            <p style={{ fontSize:13, color:"var(--text-secondary)" }}>{submissions.length} submissions</p>
          </div>
        </div>

        {submissions.length === 0 ? (
          <Card><EmptyState icon={<ClipboardList size={40} />} title="No submissions yet" description="No one has submitted this form yet." /></Card>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {submissions.map(sub => (
              <Card key={sub.id} style={{ padding:"14px 18px" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                      <span style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)" }}>{sub.userTag}</span>
                      <Badge color={statusColor[sub.status] ?? "muted"}>{sub.status}</Badge>
                    </div>
                    <div style={{ fontSize:12, color:"var(--text-muted)" }}>
                      Submitted {new Date(sub.submittedAt).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <Button size="sm" variant="secondary" onClick={() => setSubModal(sub)}><Eye size={13} /> View</Button>
                    {sub.status === "pending" && (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => updateSub(sub, "approved")} style={{ color:"var(--success)" }}>Approve</Button>
                        <Button size="sm" variant="danger" onClick={() => updateSub(sub, "denied")}>Deny</Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Modal open={!!subModal} onClose={() => setSubModal(null)} title="Submission Details" width={560}>
          {subModal && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div><Badge color={statusColor[subModal.status] ?? "muted"}>{subModal.status}</Badge></div>
              <div style={{ fontSize:13, color:"var(--text-secondary)" }}>From: <strong style={{ color:"var(--text-primary)" }}>{subModal.userTag}</strong></div>
              {selectedForm.questions.map((q: any) => (
                <div key={q.id}>
                  <div style={{ fontSize:12, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>{q.label}</div>
                  <div style={{ fontSize:13, color:"var(--text-primary)", background:"var(--bg-input)", padding:"10px 14px", borderRadius:8, border:"1px solid var(--border)" }}>
                    {subModal.answers?.[q.id] ?? <em style={{ color:"var(--text-muted)" }}>No answer</em>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
    );
  }

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
    background: active ? "var(--accent-dim)" : "transparent",
    color: active ? "var(--accent)" : "var(--text-secondary)",
    border: active ? "1px solid rgba(240,165,0,0.25)" : "1px solid transparent",
    cursor: "pointer", transition: "all 0.15s",
  });

  return (
    <div style={{ padding:"32px 32px 48px" }}>
      {ToastEl}
      <PageHeader title="Application Forms" subtitle={`${forms.length}/${FORM_CAP} forms created`}>
        {view === "forms" && forms.length < FORM_CAP && <Button onClick={openCreate}><Plus size={14} /> New Form</Button>}
      </PageHeader>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:24, background:"var(--bg-secondary)", borderRadius:10, padding:4, width:"fit-content", border:"1px solid var(--border)" }}>
        {([["forms", "📋 Forms"], ["config", "⚙️ Settings & Blacklist"]] as const).map(([key, label]) => (
          <button key={key} style={TAB_STYLE(view === key)} onClick={() => setView(key as any)}>{label}</button>
        ))}
      </div>

      {/* ── FORMS VIEW ─────────────────────────────────────────────────────── */}
      {view === "forms" && (
        forms.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ClipboardList size={40} />}
              title="No forms yet"
              description="Create up to 5 custom forms for your server — ban appeals, mod applications, staff apps, and more."
              action={<Button onClick={openCreate}><Plus size={14} /> Create First Form</Button>}
            />
          </Card>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 }}>
            {forms.map(form => (
              <Card key={form.id} style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:"var(--text-primary)", marginBottom:4 }}>{form.title}</div>
                    <div style={{ fontSize:12, color:"var(--text-secondary)", lineHeight:1.5 }}>{form.description || <em>No description</em>}</div>
                  </div>
                  <Badge color={form.active ? "success" : "muted"}>{form.active ? "Active" : "Inactive"}</Badge>
                </div>
                <div style={{ fontSize:12, color:"var(--text-muted)" }}>{form.questions?.length ?? 0} questions</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <Button size="sm" variant="secondary" onClick={() => viewSubmissions(form)}><Eye size={12} /> Submissions</Button>
                  <Button size="sm" variant="secondary" onClick={() => {
                    const link = `${window.location.origin}/apply/${guildId}/${form.id}`;
                    navigator.clipboard.writeText(link).then(() => show("Link copied!", "success")).catch(() => show("Failed to copy", "error"));
                  }}><Link size={12} /> Copy Link</Button>
                  <Button size="sm" variant="secondary" onClick={() => openEdit(form)}><Edit2 size={12} /> Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => deleteForm(form.id)}><Trash2 size={12} /></Button>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* ── CONFIG VIEW (cooldown + notify + blacklist) ─────────────────────── */}
      {view === "config" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16, maxWidth:680 }}>
          <Card>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)", marginBottom:16 }}>Application Settings</div>
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:"var(--text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:8 }}>
                  Cooldown (hours)
                </label>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <input
                    type="number"
                    min={0}
                    max={720}
                    value={appCfg.cooldownHours}
                    onChange={e => setAppCfg(c => ({ ...c, cooldownHours: Math.min(720, Math.max(0, parseInt(e.target.value) || 0)) }))}
                    style={{ width:100, padding:"9px 12px", background:"var(--bg-input)", border:"1px solid var(--border)", borderRadius:8, color:"var(--text-primary)", fontSize:13, outline:"none" }}
                  />
                  <span style={{ fontSize:13, color:"var(--text-secondary)" }}>
                    {appCfg.cooldownHours === 0 ? "No cooldown" : `Users must wait ${appCfg.cooldownHours}h before reapplying`}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ marginTop:20, display:"flex", justifyContent:"flex-end" }}>
              <Button onClick={saveAppCfg} disabled={savingCfg}>{savingCfg ? "Saving…" : "Save Settings"}</Button>
            </div>
          </Card>

          <Card>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)", marginBottom:8 }}>Application Blacklist</div>
            <p style={{ fontSize:13, color:"var(--text-secondary)", marginBottom:16 }}>
              Blacklisted users cannot submit any application. Add their Discord user ID (right-click → Copy User ID).
            </p>
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              <input
                value={blInput}
                onChange={e => setBlInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addBlacklist()}
                placeholder="Discord User ID (e.g. 123456789012345678)"
                style={{ flex:1, padding:"9px 12px", background:"var(--bg-input)", border:"1px solid var(--border)", borderRadius:8, color:"var(--text-primary)", fontSize:13, outline:"none" }}
              />
              <Button onClick={addBlacklist}><Plus size={14} /> Add</Button>
            </div>
            {(appCfg.blacklist ?? []).length === 0 ? (
              <EmptyState icon={<ShieldOff size={32} />} title="No users blacklisted" description="Add user IDs above to block users from applying." />
            ) : (
              <>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>
                  {(appCfg.blacklist ?? []).length} blacklisted user{(appCfg.blacklist ?? []).length !== 1 ? "s" : ""}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {(appCfg.blacklist ?? []).map((uid: string) => (
                    <div key={uid} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", background:"var(--bg-input)", border:"1px solid var(--border)", borderRadius:8 }}>
                      <span style={{ fontSize:13, color:"var(--text-primary)", fontFamily:"monospace" }}>{uid}</span>
                      <button onClick={() => removeBlacklist(uid)} style={{ background:"none", border:"none", color:"var(--danger)", cursor:"pointer", padding:4, display:"flex", alignItems:"center" }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:14, display:"flex", justifyContent:"flex-end" }}>
                  <Button onClick={saveAppCfg}>{savingCfg ? "Saving…" : "Save Blacklist"}</Button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* Create/Edit form modal */}
      <Modal open={modal.open} onClose={() => setModal({ open:false })} title={modal.editing ? "Edit Form" : "Create Form"} width={640}>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <Input label="Form Title" value={formDraft.title} onChange={v => setFormDraft((f: any) => ({...f,title:v}))} placeholder="e.g. Ban Appeal, Mod Application" />
          <TextArea label="Description" value={formDraft.description} onChange={v => setFormDraft((f: any) => ({...f,description:v}))} placeholder="Brief description of this form" rows={2} />
          <Select label="Response Channel (optional)" value={formDraft.responseChannelId ?? ""} onChange={v => setFormDraft((f: any) => ({...f,responseChannelId:v}))}>
            <option value="">— None —</option>
            {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
          </Select>
          <Toggle label="Form is active" checked={formDraft.active} onChange={v => setFormDraft((f: any) => ({...f,active:v}))} />

          {/* Per-form cooldown */}
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:"var(--text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:8 }}>
              Per-form Cooldown (hours)
            </label>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <input
                type="number"
                min={0}
                max={720}
                value={formDraft.cooldownHours ?? 0}
                onChange={e => setFormDraft((f: any) => ({ ...f, cooldownHours: Math.min(720, Math.max(0, parseInt(e.target.value) || 0)) }))}
                style={{ width:100, padding:"9px 12px", background:"var(--bg-input)", border:"1px solid var(--border)", borderRadius:8, color:"var(--text-primary)", fontSize:13, outline:"none" }}
              />
              <span style={{ fontSize:13, color:"var(--text-secondary)" }}>
                {(formDraft.cooldownHours ?? 0) === 0
                  ? "Uses global cooldown (or none if not set)"
                  : `Users must wait ${formDraft.cooldownHours}h before reapplying — overrides global`}
              </span>
            </div>
          </div>

          {/* Questions */}
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <label style={{ fontSize:12, fontWeight:700, color:"var(--text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em" }}>Questions ({formDraft.questions.length})</label>
              <Button size="sm" onClick={addQuestion}><Plus size={12} /> Add</Button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {formDraft.questions.map((q: any, i: number) => (
                <div key={q.id} style={{ background:"var(--bg-input)", border:"1px solid var(--border)", borderRadius:8, padding:14 }}>
                  <div style={{ display:"flex", gap:8, marginBottom:8, alignItems:"center" }}>
                    {/* Move up/down */}
                    <div style={{ display:"flex", flexDirection:"column", gap:2, flexShrink:0 }}>
                      <button
                        onClick={() => moveQuestion(q.id, -1)}
                        disabled={i === 0}
                        title="Move up"
                        style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:4, color: i === 0 ? "var(--text-muted)" : "var(--text-secondary)", cursor: i === 0 ? "not-allowed" : "pointer", padding:"2px 4px", display:"flex", alignItems:"center", opacity: i === 0 ? 0.4 : 1 }}>
                        <ChevronUp size={12} />
                      </button>
                      <button
                        onClick={() => moveQuestion(q.id, 1)}
                        disabled={i === formDraft.questions.length - 1}
                        title="Move down"
                        style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:4, color: i === formDraft.questions.length - 1 ? "var(--text-muted)" : "var(--text-secondary)", cursor: i === formDraft.questions.length - 1 ? "not-allowed" : "pointer", padding:"2px 4px", display:"flex", alignItems:"center", opacity: i === formDraft.questions.length - 1 ? 0.4 : 1 }}>
                        <ChevronDown size={12} />
                      </button>
                    </div>
                    <input value={q.label} onChange={e => updateQuestion(q.id, "label", e.target.value)}
                      placeholder={`Question ${i+1}…`}
                      style={{ flex:1, padding:"7px 12px", background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:6, color:"var(--text-primary)", fontSize:13, outline:"none" }} />
                    <select value={q.type} onChange={e => updateQuestion(q.id, "type", e.target.value)}
                      style={{ padding:"7px 10px", background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:6, color:"var(--text-primary)", fontSize:12, outline:"none", cursor:"pointer" }}>
                      <option value="short">Short answer</option>
                      <option value="long">Long answer</option>
                      <option value="choice">Multiple choice</option>
                    </select>
                    <button onClick={() => removeQuestion(q.id)} style={{ background:"none", border:"none", color:"var(--danger)", cursor:"pointer", padding:4 }}><Trash2 size={14} /></button>
                  </div>
                  <input value={q.description ?? ""} onChange={e => updateQuestion(q.id, "description", e.target.value)}
                    placeholder="Description / helper text (optional) — shown below the question"
                    style={{ width:"100%", padding:"6px 12px", background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:6, color:"var(--text-secondary)", fontSize:12, outline:"none", marginBottom:8, boxSizing:"border-box" }} />
                  <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
                    <Toggle label="Required" checked={q.required} onChange={v => updateQuestion(q.id, "required", v)} />
                    {(q.type === "short" || q.type === "long") && (
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:12, color:"var(--text-secondary)", fontWeight:600, whiteSpace:"nowrap" }}>Min. chars:</span>
                        <input
                          type="number"
                          min={0}
                          max={q.type === "short" ? 100 : 500}
                          value={q.minChars ?? 0}
                          onChange={e => {
                            const cap = q.type === "short" ? 100 : 500;
                            updateQuestion(q.id, "minChars", Math.min(cap, Math.max(0, parseInt(e.target.value) || 0)));
                          }}
                          style={{ width:64, padding:"5px 8px", background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:6, color:"var(--text-primary)", fontSize:12, outline:"none" }}
                        />
                        <span style={{ fontSize:11, color:"var(--text-muted)", whiteSpace:"nowrap" }}>
                          {(q.minChars ?? 0) > 0 ? `(max ${q.type === "short" ? 100 : 500})` : "none"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Choices editor — only for "choice" type */}
                  {q.type === "choice" && (
                    <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid var(--border)" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"var(--text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                        <span>Choices ({(q.choices ?? []).length}/{CHOICE_CAP})</span>
                        {(q.choices ?? []).length < CHOICE_CAP && (
                          <button onClick={() => addChoice(q.id)} style={{ background:"none", border:"none", color:"var(--accent)", cursor:"pointer", fontSize:11, fontFamily:"inherit", display:"flex", alignItems:"center", gap:4, fontWeight:700 }}>
                            <Plus size={11} /> Add choice
                          </button>
                        )}
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                        {(q.choices ?? []).map((ch: string, idx: number) => (
                          <div key={idx} style={{ display:"flex", gap:6, alignItems:"center" }}>
                            <input
                              value={ch}
                              onChange={e => updateChoice(q.id, idx, e.target.value)}
                              placeholder={`Option ${idx + 1}…`}
                              style={{ flex:1, padding:"6px 10px", background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:6, color:"var(--text-primary)", fontSize:12, outline:"none" }}
                            />
                            <button onClick={() => removeChoice(q.id, idx)} style={{ background:"none", border:"none", color:"var(--danger)", cursor:"pointer", padding:2 }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                        {(q.choices ?? []).length === 0 && (
                          <div style={{ fontSize:12, color:"var(--text-muted)", textAlign:"center", padding:8 }}>No choices yet — click "Add choice" above.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {formDraft.questions.length === 0 && <div style={{ fontSize:13, color:"var(--text-muted)", textAlign:"center", padding:12 }}>No questions yet — click Add above.</div>}
            </div>
          </div>

          {/* DM Notifications */}
          <div style={{ borderTop:"1px solid var(--border)", paddingTop:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"var(--text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:12 }}>DM Notifications</div>
            <Toggle
              label="Notify applicant of approval / denial via DM"
              checked={formDraft.notifyApplicant !== false}
              onChange={(v: boolean) => setFormDraft((f: any) => ({ ...f, notifyApplicant: v }))}
            />
            {formDraft.notifyApplicant !== false && (
              <div style={{ marginTop:14, display:"flex", flexDirection:"column", gap:12 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:700, color:"var(--text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:6 }}>
                    Approve DM message <span style={{ fontWeight:400, color:"var(--text-muted)", textTransform:"none" }}>(optional — leave blank for default)</span>
                  </label>
                  <textarea
                    value={formDraft.approveMessage ?? ""}
                    onChange={e => setFormDraft((f: any) => ({ ...f, approveMessage: e.target.value }))}
                    placeholder={`e.g. Congratulations! You've been accepted into our team. Please check #staff-info for next steps.`}
                    rows={2}
                    maxLength={1000}
                    style={{ width:"100%", padding:"9px 12px", background:"var(--bg-input)", border:"1px solid var(--border)", borderRadius:8, color:"var(--text-primary)", fontSize:13, outline:"none", resize:"vertical", boxSizing:"border-box", fontFamily:"inherit" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:700, color:"var(--text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:6 }}>
                    Deny DM message <span style={{ fontWeight:400, color:"var(--text-muted)", textTransform:"none" }}>(optional — leave blank for default)</span>
                  </label>
                  <textarea
                    value={formDraft.denyMessage ?? ""}
                    onChange={e => setFormDraft((f: any) => ({ ...f, denyMessage: e.target.value }))}
                    placeholder={`e.g. Thank you for applying. Unfortunately you don't meet our current requirements.`}
                    rows={2}
                    maxLength={1000}
                    style={{ width:"100%", padding:"9px 12px", background:"var(--bg-input)", border:"1px solid var(--border)", borderRadius:8, color:"var(--text-primary)", fontSize:13, outline:"none", resize:"vertical", boxSizing:"border-box", fontFamily:"inherit" }}
                  />
                </div>
              </div>
            )}
          </div>

          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Button variant="secondary" onClick={() => setModal({ open:false })}>Cancel</Button>
            <Button onClick={saveForm}>{modal.editing ? "Update Form" : "Create Form"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
