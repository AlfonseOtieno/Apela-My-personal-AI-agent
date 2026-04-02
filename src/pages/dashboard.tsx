import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { format } from "date-fns";

type HabitStat = {
  name: string;
  totalSessions: number;
  totalDuration: number;
  uniqueDays: number;
  bestDay: string;
  last7: { date: string; label: string; done: boolean; duration: number }[];
};

type PlannedHabit = {
  id: string;
  name: string;
  frequency: string;
  specific_days: string[];
  unit: string;
  preferred_time: string | null;
  target: string | null;
  active: boolean;
};

type Report = {
  id: string;
  period: string;
  period_type: string;
  content: string;
  created_at: string;
};

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const DAY_VALS = ["mon","tue","wed","thu","fri","sat","sun"];

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>
      {children}
    </p>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#111", border: "1px solid #222", borderRadius: 8, padding: 16, ...style }}>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text", style }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
  style?: React.CSSProperties;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        background: "#1a1a1a", border: "1px solid #2a2a2a",
        borderRadius: 6, color: "#e9edef", padding: "9px 13px",
        fontSize: 13, outline: "none", width: "100%",
        fontFamily: "inherit", ...style
      }}
    />
  );
}

function Select({ value, onChange, children, style }: {
  value: string; onChange: (v: string) => void;
  children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: "#1a1a1a", border: "1px solid #2a2a2a",
        borderRadius: 6, color: "#e9edef", padding: "9px 13px",
        fontSize: 13, outline: "none", width: "100%",
        fontFamily: "inherit", cursor: "pointer", ...style
      }}
    >
      {children}
    </select>
  );
}

function StatNum({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <p style={{ fontSize: 26, fontWeight: 700, color: "#00a884", lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>{value}</p>
      <p style={{ fontSize: 11, color: "#555", marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>{label}</p>
    </div>
  );
}

function WeekStrip({ last7 }: { last7: HabitStat["last7"] }) {
  return (
    <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
      {last7.map(d => (
        <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ width: "100%", height: 28, background: d.done ? "#00a884" : "#1a1a1a", borderRadius: 4, border: d.done ? "none" : "1px solid #222" }} />
          <span style={{ fontSize: 9, color: "#444", fontFamily: "'JetBrains Mono', monospace" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Add Planned Habit Form ────────────────────────────────────────────────────
function AddHabitForm({ onSave, onCancel }: { onSave: (h: PlannedHabit) => void; onCancel: () => void }) {
  const [name, setName]           = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [unit, setUnit]           = useState("minutes");
  const [time, setTime]           = useState("");
  const [target, setTarget]       = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");

  function toggleDay(day: string) {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  }

  async function save() {
    if (!name.trim()) { setError("Habit name is required"); return; }
    if (frequency === "specific" && selectedDays.length === 0) {
      setError("Select at least one day"); return;
    }
    setSaving(true);
    setError("");

    const res = await fetch("/api/planned-habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:           name.trim(),
        frequency:      frequency === "specific" ? "specific" : frequency,
        specific_days:  frequency === "specific" ? selectedDays : [],
        unit,
        preferred_time: time || null,
        target:         target.trim() || null,
      }),
    });

    const data = await res.json() as PlannedHabit & { error?: string };
    if (data.error) { setError(data.error); setSaving(false); return; }

    onSave(data);
    setSaving(false);
  }

  return (
    <Card style={{ marginBottom: 16, border: "1px solid #2a3942" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Name */}
        <div>
          <Label>Habit name *</Label>
          <Input value={name} onChange={setName} placeholder="e.g. boxing, coding, morning run" />
        </div>

        {/* Frequency */}
        <div>
          <Label>How often?</Label>
          <Select value={frequency} onChange={setFrequency}>
            <option value="daily">Every day</option>
            <option value="weekdays">Weekdays only (Mon–Fri)</option>
            <option value="weekends">Weekends only (Sat–Sun)</option>
            <option value="weekly">Once a week</option>
            <option value="specific">Specific days</option>
          </Select>
        </div>

        {/* Day picker — only when specific */}
        {frequency === "specific" && (
          <div>
            <Label>Which days?</Label>
            <div style={{ display: "flex", gap: 6 }}>
              {DAYS.map((label, i) => {
                const val = DAY_VALS[i];
                const active = selectedDays.includes(val);
                return (
                  <button
                    key={val}
                    onClick={() => toggleDay(val)}
                    style={{
                      flex: 1, padding: "8px 0",
                      borderRadius: 6, fontSize: 12, fontWeight: 600,
                      background: active ? "#00a884" : "#1a1a1a",
                      color: active ? "#fff" : "#555",
                      border: active ? "none" : "1px solid #2a2a2a",
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Time (optional) */}
        <div>
          <Label>Preferred time (optional)</Label>
          <Input value={time} onChange={setTime} placeholder="e.g. 05:30" type="time" />
        </div>

        {/* Target */}
        <div>
          <Label>Target (optional)</Label>
          <Input value={target} onChange={setTarget} placeholder="e.g. 30 minutes, 5km, 20 reps, 1 chapter" />
        </div>

        {/* Unit */}
        <div>
          <Label>Logging unit</Label>
          <Select value={unit} onChange={setUnit}>
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="pages">Pages</option>
            <option value="km">Kilometres</option>
            <option value="miles">Miles</option>
            <option value="reps">Reps</option>
            <option value="sessions">Sessions</option>
            <option value="chapters">Chapters</option>
          </Select>
        </div>

        {error && (
          <p style={{ fontSize: 12, color: "#f04444", fontFamily: "'JetBrains Mono', monospace" }}>{error}</p>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "9px 18px", borderRadius: 6, fontSize: 13, background: "none", color: "#555", border: "1px solid #222", cursor: "pointer", fontFamily: "inherit" }}>
            Cancel
          </button>
          <button onClick={save} disabled={saving} style={{ padding: "9px 20px", borderRadius: 6, fontSize: 13, fontWeight: 600, background: "#00a884", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Save habit"}
          </button>
        </div>
      </div>
    </Card>
  );
}

// ── Planned Habit Card ────────────────────────────────────────────────────────
function PlannedCard({ habit, onRemove }: { habit: PlannedHabit; onRemove: () => void }) {
  const freqLabel: Record<string, string> = {
    daily: "Every day",
    weekdays: "Mon–Fri",
    weekends: "Sat–Sun",
    weekly: "Once a week",
    specific: habit.specific_days?.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(", ") || "Specific days",
  };

  return (
    <Card style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 700, textTransform: "capitalize", marginBottom: 6 }}>{habit.name}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#00a884", fontFamily: "'JetBrains Mono', monospace", background: "rgba(0,168,132,0.1)", padding: "2px 8px", borderRadius: 4 }}>
              {freqLabel[habit.frequency] || habit.frequency}
            </span>
            {habit.preferred_time && (
              <span style={{ fontSize: 11, color: "#888", fontFamily: "'JetBrains Mono', monospace", background: "#1a1a1a", padding: "2px 8px", borderRadius: 4 }}>
                🕐 {habit.preferred_time}
              </span>
            )}
            {habit.target && (
              <span style={{ fontSize: 11, color: "#888", fontFamily: "'JetBrains Mono', monospace", background: "#1a1a1a", padding: "2px 8px", borderRadius: 4 }}>
                🎯 {habit.target}
              </span>
            )}
            <span style={{ fontSize: 11, color: "#555", fontFamily: "'JetBrains Mono', monospace" }}>
              {habit.unit}
            </span>
          </div>
        </div>
        <button
          onClick={onRemove}
          style={{ background: "none", border: "1px solid #2a2a2a", borderRadius: 6, color: "#555", fontSize: 12, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0, marginLeft: 12 }}
        >
          Remove
        </button>
      </div>
    </Card>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats]         = useState<HabitStat[]>([]);
  const [planned, setPlanned]     = useState<PlannedHabit[]>([]);
  const [reports, setReports]     = useState<Report[]>([]);
  const [tab, setTab]             = useState<"overview"|"planned"|"logs"|"reports">("overview");
  const [loading, setLoading]     = useState(true);
  const [genLoading, setGenLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/stats").then(r => r.json()),
      fetch("/api/planned-habits").then(r => r.json()),
      fetch("/api/reports").then(r => r.json()),
    ]).then(([s, p, r]) => {
      setStats(Array.isArray(s) ? s : []);
      setPlanned(Array.isArray(p) ? p : []);
      setReports(Array.isArray(r) ? r : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function generateReport(type: "week"|"month"|"year") {
    setGenLoading(true);
    const res  = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period_type: type }),
    });
    const data = await res.json() as { content: string };
    setReports(prev => [{ id: Date.now().toString(), period: type, period_type: type, content: data.content, created_at: new Date().toISOString() }, ...prev]);
    setTab("reports");
    setGenLoading(false);
  }

  async function removePlanned(id: string) {
    if (!confirm("Remove this planned habit?")) return;
    await fetch(`/api/planned-habits?id=${id}`, { method: "DELETE" });
    setPlanned(prev => prev.filter(p => p.id !== id));
  }

  async function clearChat() {
    if (!confirm("Clear all chat messages? This cannot be undone.")) return;
    await fetch("/api/clear-messages", { method: "DELETE" });
    alert("Chat history cleared.");
  }

  const tabStyle = (t: string): React.CSSProperties => ({
    padding: "8px 18px", borderRadius: 6, fontSize: 13, fontWeight: 600,
    color: tab === t ? "#e9edef" : "#555",
    background: tab === t ? "#1f2c34" : "transparent",
    border: tab === t ? "1px solid #2a3942" : "1px solid transparent",
    cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit",
  });

  return (
    <>
      <Head><title>Apela — Dashboard</title></Head>
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e9edef", fontFamily: "'Inter', sans-serif" }}>

        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderBottom: "1px solid #1a1a1a", background: "#0a0a0a", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/icons/icon-192x192.png" alt="Apela" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
            <div>
              <p style={{ fontWeight: 600, fontSize: 14 }}>Apela</p>
              <p style={{ fontSize: 11, color: "#555", fontFamily: "'JetBrains Mono', monospace" }}>dashboard</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={clearChat} style={{ fontSize: 12, color: "#555", padding: "7px 14px", borderRadius: 6, border: "1px solid #222", background: "none", cursor: "pointer", fontFamily: "inherit" }}>
              Clear chat
            </button>
            <Link href="/chat" style={{ fontSize: 13, color: "#00a884", padding: "7px 16px", borderRadius: 6, border: "1px solid #00a884", fontWeight: 600 }}>
              → Open Chat
            </Link>
          </div>
        </div>

        <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 20px" }}>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
            <button style={tabStyle("overview")} onClick={() => setTab("overview")}>Overview</button>
            <button style={tabStyle("planned")}  onClick={() => setTab("planned")}>Planned Habits</button>
            <button style={tabStyle("logs")}     onClick={() => setTab("logs")}>Logs</button>
            <button style={tabStyle("reports")}  onClick={() => setTab("reports")}>Reports</button>
          </div>

          {loading && <p style={{ color: "#444", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>Loading…</p>}

          {/* ── OVERVIEW ── */}
          {!loading && tab === "overview" && (
            <div>
              {stats.length === 0 ? (
                <Card>
                  <p style={{ color: "#555", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>No habit data yet. Open the chat and tell Apela what you did today.</p>
                  <p style={{ color: "#444", fontSize: 12, marginTop: 8, fontFamily: "'JetBrains Mono', monospace" }}>Example: "I did my workout for 30 minutes, felt good"</p>
                </Card>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {stats.map(s => (
                    <Card key={s.name}>
                      <h2 style={{ fontSize: 16, fontWeight: 600, textTransform: "capitalize", marginBottom: 16 }}>{s.name}</h2>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                        <StatNum value={s.totalSessions} label="sessions" />
                        <StatNum value={s.totalDuration} label="minutes" />
                        <StatNum value={s.uniqueDays} label="days" />
                        <StatNum value={s.bestDay} label="best day" />
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <Label>Last 7 days</Label>
                        <WeekStrip last7={s.last7} />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 24 }}>
                <Label>Generate pattern report</Label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["week","month","year"] as const).map(p => (
                    <button key={p} onClick={() => generateReport(p)} disabled={genLoading} style={{ padding: "9px 20px", borderRadius: 6, fontSize: 13, fontWeight: 600, background: "#1f2c34", color: "#e9edef", border: "1px solid #2a3942", cursor: "pointer", opacity: genLoading ? 0.5 : 1, fontFamily: "inherit" }}>
                      {genLoading ? "…" : `This ${p}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PLANNED HABITS ── */}
          {!loading && tab === "planned" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600 }}>Planned Habits</p>
                  <p style={{ fontSize: 12, color: "#555", marginTop: 3, lineHeight: 1.5 }}>
                    What you intend to do regularly. Apela uses this to detect missed habits in weekly reports.
                  </p>
                </div>
                {!showAddForm && (
                  <button onClick={() => setShowAddForm(true)} style={{ padding: "9px 18px", borderRadius: 6, fontSize: 13, fontWeight: 600, background: "#00a884", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", flexShrink: 0, marginLeft: 16 }}>
                    + Add habit
                  </button>
                )}
              </div>

              {showAddForm && (
                <AddHabitForm
                  onSave={h => { setPlanned(prev => [...prev, h]); setShowAddForm(false); }}
                  onCancel={() => setShowAddForm(false)}
                />
              )}

              {planned.length === 0 && !showAddForm ? (
                <Card>
                  <p style={{ color: "#555", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>
                    No planned habits yet. Add them here or tell Apela in the chat: "I want to track boxing every day"
                  </p>
                </Card>
              ) : (
                planned.map(p => (
                  <PlannedCard key={p.id} habit={p} onRemove={() => removePlanned(p.id)} />
                ))
              )}
            </div>
          )}

          {/* ── LOGS ── */}
          {!loading && tab === "logs" && (
            <div>
              {stats.length === 0 ? (
                <Card><p style={{ color: "#555", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>No habits tracked yet.</p></Card>
              ) : (
                stats.map(s => (
                  <Card key={s.name} style={{ marginBottom: 12 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, textTransform: "capitalize", marginBottom: 12 }}>{s.name}</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div><Label>Total sessions</Label><p style={{ fontSize: 22, fontWeight: 700, color: "#00a884", fontFamily: "'JetBrains Mono', monospace" }}>{s.totalSessions}</p></div>
                      <div><Label>Total time (min)</Label><p style={{ fontSize: 22, fontWeight: 700, color: "#00a884", fontFamily: "'JetBrains Mono', monospace" }}>{s.totalDuration}</p></div>
                      <div><Label>Active days</Label><p style={{ fontSize: 22, fontWeight: 700, color: "#00a884", fontFamily: "'JetBrains Mono', monospace" }}>{s.uniqueDays}</p></div>
                      <div><Label>Best day of week</Label><p style={{ fontSize: 22, fontWeight: 700, color: "#00a884", fontFamily: "'JetBrains Mono', monospace" }}>{s.bestDay}</p></div>
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <Label>Last 7 days</Label>
                      <WeekStrip last7={s.last7} />
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* ── REPORTS ── */}
          {!loading && tab === "reports" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <Label>Generate new report</Label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["week","month","year"] as const).map(p => (
                    <button key={p} onClick={() => generateReport(p)} disabled={genLoading} style={{ padding: "9px 20px", borderRadius: 6, fontSize: 13, fontWeight: 600, background: "#00a884", color: "#fff", border: "none", cursor: "pointer", opacity: genLoading ? 0.5 : 1, fontFamily: "inherit" }}>
                      {genLoading ? "Generating…" : `This ${p}`}
                    </button>
                  ))}
                </div>
              </div>
              {reports.length === 0 ? (
                <Card><p style={{ color: "#555", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>No reports yet. Generate one above.</p></Card>
              ) : (
                reports.map(r => (
                  <Card key={r.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#00a884", background: "rgba(0,168,132,0.1)", padding: "3px 8px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                        {r.period_type} · {r.period}
                      </span>
                      <span style={{ fontSize: 11, color: "#444", fontFamily: "'JetBrains Mono', monospace" }}>
                        {format(new Date(r.created_at), "MMM d, yyyy")}
                      </span>
                    </div>
                    <p style={{ fontSize: 14, lineHeight: 1.8, color: "#ccc", whiteSpace: "pre-wrap" }}>{r.content}</p>
                  </Card>
                ))
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
