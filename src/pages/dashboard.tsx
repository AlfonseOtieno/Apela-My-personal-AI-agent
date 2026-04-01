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
  unit: string;
  active: boolean;
};

type Report = {
  id: string;
  period: string;
  period_type: string;
  content: string;
  created_at: string;
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>
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
    <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
      {last7.map(d => (
        <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ width: "100%", height: 28, background: d.done ? "#00a884" : "#1a1a1a", borderRadius: 4, border: d.done ? "none" : "1px solid #222" }} />
          <span style={{ fontSize: 9, color: "#444", fontFamily: "'JetBrains Mono', monospace" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats]     = useState<HabitStat[]>([]);
  const [planned, setPlanned] = useState<PlannedHabit[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [tab, setTab]         = useState<"overview" | "habits" | "planned" | "reports">("overview");
  const [loading, setLoading] = useState(true);
  const [genLoading, setGenLoading] = useState(false);

  // Add planned habit form
  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitFreq, setNewHabitFreq] = useState("daily");
  const [newHabitUnit, setNewHabitUnit] = useState("minutes");
  const [addingHabit, setAddingHabit]   = useState(false);

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

  async function generateReport(type: "week" | "month" | "year") {
    setGenLoading(true);
    const res  = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period_type: type }),
    });
    const data = await res.json() as { content: string };
    setReports(prev => [{
      id: Date.now().toString(), period: type,
      period_type: type, content: data.content,
      created_at: new Date().toISOString()
    }, ...prev]);
    setTab("reports");
    setGenLoading(false);
  }

  async function addPlannedHabit() {
    if (!newHabitName.trim()) return;
    const res  = await fetch("/api/planned-habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newHabitName.trim(), frequency: newHabitFreq, unit: newHabitUnit }),
    });
    const data = await res.json() as PlannedHabit;
    setPlanned(prev => [...prev, data]);
    setNewHabitName("");
    setAddingHabit(false);
  }

  async function removePlannedHabit(id: string) {
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
            <button style={tabStyle("habits")}   onClick={() => setTab("habits")}>Logs</button>
            <button style={tabStyle("reports")}  onClick={() => setTab("reports")}>Reports</button>
          </div>

          {loading && <p style={{ color: "#444", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>Loading…</p>}

          {/* ── OVERVIEW ── */}
          {!loading && tab === "overview" && (
            <div>
              {stats.length === 0 ? (
                <Card>
                  <p style={{ color: "#555", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>
                    No habit data yet. Open the chat and tell Apela what you did today.
                  </p>
                  <p style={{ color: "#444", fontSize: 12, marginTop: 8, fontFamily: "'JetBrains Mono', monospace" }}>
                    Example: "I did my workout for 30 minutes, felt good"
                  </p>
                </Card>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {stats.map(s => (
                    <Card key={s.name}>
                      <h2 style={{ fontSize: 16, fontWeight: 600, textTransform: "capitalize", marginBottom: 16 }}>{s.name}</h2>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 8 }}>
                        <StatNum value={s.totalSessions} label="sessions" />
                        <StatNum value={s.totalDuration} label="minutes" />
                        <StatNum value={s.uniqueDays} label="days" />
                        <StatNum value={s.bestDay} label="best day" />
                      </div>
                      <div style={{ marginTop: 8 }}>
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
                  <p style={{ fontSize: 12, color: "#555", marginTop: 2 }}>What you intend to do regularly. Apela uses this to detect missed habits in reports.</p>
                </div>
                <button onClick={() => setAddingHabit(!addingHabit)} style={{ padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600, background: "#00a884", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  {addingHabit ? "Cancel" : "+ Add"}
                </button>
              </div>

              {addingHabit && (
                <Card style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <input
                      value={newHabitName}
                      onChange={e => setNewHabitName(e.target.value)}
                      placeholder="Habit name (e.g. boxing, coding, reading)"
                      onKeyDown={e => e.key === "Enter" && addPlannedHabit()}
                      autoFocus
                      style={{ background: "#1a1a1a", border: "1px solid #222", borderRadius: 6, color: "#e9edef", padding: "9px 13px", fontSize: 13, outline: "none", fontFamily: "inherit" }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <select value={newHabitFreq} onChange={e => setNewHabitFreq(e.target.value)} style={{ flex: 1, background: "#1a1a1a", border: "1px solid #222", borderRadius: 6, color: "#e9edef", padding: "9px 13px", fontSize: 13, outline: "none", fontFamily: "inherit" }}>
                        <option value="daily">Daily</option>
                        <option value="weekdays">Weekdays</option>
                        <option value="weekends">Weekends</option>
                        <option value="weekly">Weekly</option>
                      </select>
                      <select value={newHabitUnit} onChange={e => setNewHabitUnit(e.target.value)} style={{ flex: 1, background: "#1a1a1a", border: "1px solid #222", borderRadius: 6, color: "#e9edef", padding: "9px 13px", fontSize: 13, outline: "none", fontFamily: "inherit" }}>
                        <option value="minutes">Minutes</option>
                        <option value="pages">Pages</option>
                        <option value="km">Kilometres</option>
                        <option value="reps">Reps</option>
                        <option value="sessions">Sessions</option>
                      </select>
                    </div>
                    <button onClick={addPlannedHabit} style={{ alignSelf: "flex-end", padding: "9px 20px", borderRadius: 6, fontSize: 13, fontWeight: 600, background: "#00a884", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                      Save habit
                    </button>
                  </div>
                </Card>
              )}

              {planned.length === 0 && !addingHabit ? (
                <Card>
                  <p style={{ color: "#555", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>
                    No planned habits yet. Add them here or tell Apela in the chat: "I want to track boxing every day"
                  </p>
                </Card>
              ) : (
                planned.map(p => (
                  <Card key={p.id} style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, textTransform: "capitalize" }}>{p.name}</p>
                      <p style={{ fontSize: 12, color: "#555", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>{p.frequency} · {p.unit}</p>
                    </div>
                    <button onClick={() => removePlannedHabit(p.id)} style={{ background: "none", border: "1px solid #333", borderRadius: 6, color: "#666", fontSize: 12, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" }}>
                      Remove
                    </button>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* ── LOGS ── */}
          {!loading && tab === "habits" && (
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
                    <p style={{ fontSize: 14, lineHeight: 1.7, color: "#ccc", whiteSpace: "pre-wrap" }}>{r.content}</p>
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
