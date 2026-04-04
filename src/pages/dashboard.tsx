import { useState, useEffect, useCallback } from "react";
import GoogleTab from "@/components/GoogleTab";
import Head from "next/head";
import Link from "next/link";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isSameMonth, isToday } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────
type HabitStat = {
  name: string; totalSessions: number; totalDuration: number;
  uniqueDays: number; bestDay: string;
  last7: { date: string; label: string; done: boolean; duration: number }[];
};
type PlannedHabit = {
  id: string; name: string; frequency: string; specific_days: string[];
  unit: string; start_time: string | null; end_time: string | null;
  target: string | null; active: boolean;
};
type HabitLog = {
  id: string; habit_name: string; duration: number | null;
  feeling: string | null; note: string | null; date: string; logged_at: string;
};
type Report = {
  id: string; period: string; period_type: string; content: string; created_at: string;
};

const DAYS_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const DAY_VALS   = ["mon","tue","wed","thu","fri","sat","sun"];

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize:11, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#666", marginBottom:7, fontFamily:"'JetBrains Mono',monospace" }}>{children}</p>;
}
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background:"#111", border:"1px solid #222", borderRadius:8, padding:16, ...style }}>{children}</div>;
}
function Inp({ value, onChange, placeholder, type="text", style }: { value:string; onChange:(v:string)=>void; placeholder?:string; type?:string; style?: React.CSSProperties }) {
  return <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:6, color:"#e9edef", padding:"9px 13px", fontSize:13, outline:"none", width:"100%", fontFamily:"inherit", ...style }} />;
}
function Sel({ value, onChange, children }: { value:string; onChange:(v:string)=>void; children:React.ReactNode }) {
  return <select value={value} onChange={e=>onChange(e.target.value)} style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:6, color:"#e9edef", padding:"9px 13px", fontSize:13, outline:"none", width:"100%", fontFamily:"inherit", cursor:"pointer" }}>{children}</select>;
}
function Btn({ onClick, children, variant="ghost", disabled=false, style }: { onClick:()=>void; children:React.ReactNode; variant?:"primary"|"ghost"|"danger"; disabled?:boolean; style?:React.CSSProperties }) {
  const bg = variant==="primary"?"#00a884":variant==="danger"?"#f04444":"none";
  const color = variant==="ghost"?"#555":"#fff";
  const border = variant==="ghost"?"1px solid #222":"none";
  return <button onClick={onClick} disabled={disabled} style={{ padding:"8px 16px", borderRadius:6, fontSize:13, fontWeight:600, background:bg, color, border, cursor:disabled?"default":"pointer", fontFamily:"inherit", opacity:disabled?0.5:1, ...style }}>{children}</button>;
}

// ── Week strip ─────────────────────────────────────────────────────────────────
function WeekStrip({ last7 }: { last7: HabitStat["last7"] }) {
  return (
    <div style={{ display:"flex", gap:4, marginTop:10 }}>
      {last7.map(d => (
        <div key={d.date} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
          <div style={{ width:"100%", height:28, background:d.done?"#00a884":"#1a1a1a", borderRadius:4, border:d.done?"none":"1px solid #222" }} />
          <span style={{ fontSize:9, color:"#444", fontFamily:"'JetBrains Mono',monospace" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Calendar ──────────────────────────────────────────────────────────────────
function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [planned, setPlanned] = useState<PlannedHabit[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayLogs, setDayLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMonth = useCallback(async () => {
    setLoading(true);
    const from = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const to   = format(endOfMonth(currentMonth),   "yyyy-MM-dd");
    const [logsRes, plannedRes] = await Promise.all([
      fetch(`/api/logs?from=${from}&to=${to}`).then(r => r.json()),
      fetch("/api/planned-habits").then(r => r.json()),
    ]);
    setLogs(Array.isArray(logsRes) ? logsRes : []);
    setPlanned(Array.isArray(plannedRes) ? plannedRes : []);
    setLoading(false);
  }, [currentMonth]);

  useEffect(() => { loadMonth(); }, [loadMonth]);

  function selectDay(dateStr: string) {
    setSelectedDay(dateStr);
    setDayLogs(logs.filter(l => l.date === dateStr));
  }

  async function deleteLog(id: string) {
    if (!confirm("Delete this log entry?")) return;
    await fetch(`/api/logs?id=${id}`, { method: "DELETE" });
    const updated = dayLogs.filter(l => l.id !== id);
    setDayLogs(updated);
    setLogs(prev => prev.filter(l => l.id !== id));
  }

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const logsByDate: Record<string, HabitLog[]> = {};
  logs.forEach(l => { logsByDate[l.date] = logsByDate[l.date] || []; logsByDate[l.date].push(l); });

  const prevMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    if (next <= new Date()) setCurrentMonth(next);
  };

  // Get planned habits for a given day
  function getPlannedForDay(dateStr: string): PlannedHabit[] {
    const d = parseISO(dateStr);
    const dayShort = format(d, "EEE").toLowerCase();
    return planned.filter(h => {
      if (h.frequency === "daily") return true;
      if (h.frequency === "weekdays") return ["mon","tue","wed","thu","fri"].includes(dayShort);
      if (h.frequency === "weekends") return ["sat","sun"].includes(dayShort);
      if (h.frequency === "specific") return Array.isArray(h.specific_days) && h.specific_days.includes(dayShort);
      return false;
    });
  }

  return (
    <div>
      {/* Month navigation */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <button onClick={prevMonth} style={{ background:"none", border:"1px solid #222", borderRadius:6, color:"#888", padding:"6px 14px", cursor:"pointer", fontFamily:"inherit", fontSize:13 }}>← Prev</button>
        <p style={{ fontWeight:700, fontSize:15 }}>{format(currentMonth,"MMMM yyyy")}</p>
        <button onClick={nextMonth} style={{ background:"none", border:"1px solid #222", borderRadius:6, color:"#888", padding:"6px 14px", cursor:"pointer", fontFamily:"inherit", fontSize:13 }}>Next →</button>
      </div>

      {/* Day labels */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, marginBottom:3 }}>
        {["M","T","W","T","F","S","S"].map((d,i) => (
          <div key={i} style={{ textAlign:"center", fontSize:10, color:"#555", fontFamily:"'JetBrains Mono',monospace", padding:"4px 0" }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? <p style={{ color:"#444", fontSize:13, fontFamily:"'JetBrains Mono',monospace" }}>Loading…</p> : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
          {/* Offset for first day — Monday start */}
          {Array.from({ length: (new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() + 6) % 7 }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {days.map(day => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayLs   = logsByDate[dateStr] || [];
            const hasLog  = dayLs.length > 0;
            const plannedToday = getPlannedForDay(dateStr);
            const isSelected = selectedDay === dateStr;
            const isFuture = day > new Date();

            return (
              <button
                key={dateStr}
                onClick={() => !isFuture && selectDay(dateStr)}
                style={{
                  aspectRatio:"1", borderRadius:6, border: isSelected ? "2px solid #00a884" : "1px solid #1a1a1a",
                  background: hasLog ? "rgba(0,168,132,0.15)" : isToday(day) ? "#1f2c34" : "#111",
                  color: isFuture ? "#333" : hasLog ? "#00a884" : "#888",
                  fontSize:12, fontWeight: isToday(day)?700:400,
                  cursor: isFuture ? "default" : "pointer",
                  display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2,
                  position:"relative",
                }}
              >
                {format(day, "d")}
                {plannedToday.length > 0 && !isFuture && (
                  <div style={{ display:"flex", gap:2 }}>
                    {plannedToday.slice(0,3).map(p => {
                      const logged = dayLs.some(l => l.habit_name.toLowerCase().includes(p.name) || p.name.includes(l.habit_name.toLowerCase()));
                      return <div key={p.id} style={{ width:4, height:4, borderRadius:"50%", background: logged ? "#00a884" : "#444" }} />;
                    })}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Day detail panel */}
      {selectedDay && (
        <div style={{ marginTop:20, border:"1px solid #2a3942", borderRadius:8, padding:16 }}>
          <p style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>
            {format(parseISO(selectedDay), "EEEE, MMMM d, yyyy")}
          </p>

          {/* Planned */}
          {getPlannedForDay(selectedDay).length > 0 && (
            <div style={{ marginBottom:14 }}>
              <Label>Planned</Label>
              {getPlannedForDay(selectedDay).map(p => {
                const logged = dayLogs.some(l => l.habit_name.toLowerCase().includes(p.name));
                return (
                  <div key={p.id} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5, fontSize:13, color: logged?"#00a884":"#555" }}>
                    <span>{logged ? "✓" : "✗"}</span>
                    <span style={{ textTransform:"capitalize" }}>{p.name}</span>
                    {p.target && <span style={{ fontSize:11, color:"#444" }}>— target: {p.target}</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Logged */}
          {dayLogs.length > 0 ? (
            <div>
              <Label>Logged</Label>
              {dayLogs.map(l => (
                <div key={l.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #1a1a1a" }}>
                  <div>
                    <p style={{ fontSize:14, fontWeight:600, textTransform:"capitalize" }}>{l.habit_name}</p>
                    <p style={{ fontSize:12, color:"#555", fontFamily:"'JetBrains Mono',monospace", marginTop:2 }}>
                      {l.duration ? `${l.duration} min` : ""}
                      {l.feeling ? ` · ${l.feeling}` : ""}
                      {l.note ? ` · "${l.note}"` : ""}
                    </p>
                  </div>
                  <button onClick={() => deleteLog(l.id)} style={{ background:"none", border:"1px solid #2a2a2a", borderRadius:5, color:"#f04444", fontSize:11, padding:"5px 10px", cursor:"pointer", fontFamily:"inherit" }}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize:13, color:"#444", fontFamily:"'JetBrains Mono',monospace" }}>Nothing logged on this day.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Planned Habit Form (shared for Add and Edit) ───────────────────────────────
function PlannedHabitForm({
  initial, onSave, onCancel,
}: {
  initial?: Partial<PlannedHabit>;
  onSave: (h: PlannedHabit) => void;
  onCancel: () => void;
}) {
  const [name, setName]           = useState(initial?.name || "");
  const [frequency, setFrequency] = useState(initial?.frequency || "daily");
  const [days, setDays]           = useState<string[]>(initial?.specific_days || []);
  const [unit, setUnit]           = useState(initial?.unit || "minutes");
  const [startTime, setStartTime] = useState(initial?.start_time || "");
  const [endTime, setEndTime]     = useState(initial?.end_time || "");
  const [target, setTarget]       = useState(initial?.target || "");
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");

  const isEdit = !!initial?.id;

  function toggleDay(d: string) {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }

  async function save() {
    if (!name.trim() && !isEdit) { setErr("Habit name is required"); return; }
    if (frequency === "specific" && days.length === 0) { setErr("Select at least one day"); return; }
    setSaving(true); setErr("");

    const body = {
      ...(isEdit ? { id: initial!.id } : { name: name.trim() }),
      frequency, specific_days: frequency === "specific" ? days : [],
      unit, start_time: startTime || null, end_time: endTime || null,
      target: target.trim() || null,
    };

    const method = isEdit ? "PATCH" : "POST";
    const res  = await fetch("/api/planned-habits", {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json() as PlannedHabit & { error?: string };
    if (data.error) { setErr(data.error); setSaving(false); return; }

    onSave(data);
    setSaving(false);
  }

  return (
    <Card style={{ marginBottom:16, border:"1px solid #2a3942" }}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {!isEdit && (
          <div><Label>Habit name *</Label><Inp value={name} onChange={setName} placeholder="e.g. boxing, coding, morning run" /></div>
        )}
        <div>
          <Label>How often?</Label>
          <Sel value={frequency} onChange={setFrequency}>
            <option value="daily">Every day</option>
            <option value="weekdays">Weekdays (Mon–Fri)</option>
            <option value="weekends">Weekends (Sat–Sun)</option>
            <option value="weekly">Once a week</option>
            <option value="specific">Specific days</option>
          </Sel>
        </div>
        {frequency === "specific" && (
          <div>
            <Label>Which days?</Label>
            <div style={{ display:"flex", gap:5 }}>
              {DAYS_SHORT.map((label, i) => {
                const val = DAY_VALS[i];
                const active = days.includes(val);
                return (
                  <button key={val} onClick={() => toggleDay(val)} style={{ flex:1, padding:"8px 0", borderRadius:6, fontSize:12, fontWeight:600, background:active?"#00a884":"#1a1a1a", color:active?"#fff":"#555", border:active?"none":"1px solid #2a2a2a", cursor:"pointer", fontFamily:"inherit" }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div><Label>Start time (optional)</Label><Inp type="time" value={startTime} onChange={setStartTime} /></div>
          <div><Label>End time (optional)</Label><Inp type="time" value={endTime} onChange={setEndTime} /></div>
        </div>
        <div><Label>Target (optional)</Label><Inp value={target} onChange={setTarget} placeholder="e.g. 30 minutes, 5km, 20 reps" /></div>
        <div>
          <Label>Logging unit</Label>
          <Sel value={unit} onChange={setUnit}>
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="pages">Pages</option>
            <option value="km">Kilometres</option>
            <option value="miles">Miles</option>
            <option value="reps">Reps</option>
            <option value="sessions">Sessions</option>
            <option value="chapters">Chapters</option>
          </Sel>
        </div>
        {err && <p style={{ fontSize:12, color:"#f04444", fontFamily:"'JetBrains Mono',monospace" }}>{err}</p>}
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <Btn onClick={onCancel}>Cancel</Btn>
          <Btn onClick={save} variant="primary" disabled={saving}>{saving ? "Saving…" : isEdit ? "Save changes" : "Add habit"}</Btn>
        </div>
      </div>
    </Card>
  );
}

// ── Planned Habit Card ─────────────────────────────────────────────────────────
function PlannedCard({ habit, onEdit, onRemove }: { habit: PlannedHabit; onEdit: ()=>void; onRemove: ()=>void }) {
  const freqMap: Record<string, string> = {
    daily:"Every day", weekdays:"Mon–Fri", weekends:"Sat–Sun",
    weekly:"Once a week",
    specific: habit.specific_days?.map(d => d.charAt(0).toUpperCase()+d.slice(1)).join(", ") || "Specific days",
  };
  return (
    <Card style={{ marginBottom:8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:15, fontWeight:700, textTransform:"capitalize", marginBottom:6 }}>{habit.name}</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
            <span style={{ fontSize:11, color:"#00a884", fontFamily:"'JetBrains Mono',monospace", background:"rgba(0,168,132,0.1)", padding:"2px 8px", borderRadius:4 }}>
              {freqMap[habit.frequency] || habit.frequency}
            </span>
            {(habit.start_time || habit.end_time) && (
              <span style={{ fontSize:11, color:"#888", fontFamily:"'JetBrains Mono',monospace", background:"#1a1a1a", padding:"2px 8px", borderRadius:4 }}>
                🕐 {habit.start_time || "?"}{habit.end_time ? ` – ${habit.end_time}` : ""}
              </span>
            )}
            {habit.target && (
              <span style={{ fontSize:11, color:"#888", fontFamily:"'JetBrains Mono',monospace", background:"#1a1a1a", padding:"2px 8px", borderRadius:4 }}>
                🎯 {habit.target}
              </span>
            )}
            <span style={{ fontSize:11, color:"#444", fontFamily:"'JetBrains Mono',monospace" }}>{habit.unit}</span>
          </div>
        </div>
        <div style={{ display:"flex", gap:6, marginLeft:12, flexShrink:0 }}>
          <button onClick={onEdit} style={{ background:"none", border:"1px solid #2a2a2a", borderRadius:6, color:"#888", fontSize:12, padding:"5px 11px", cursor:"pointer", fontFamily:"inherit" }}>Edit</button>
          <button onClick={onRemove} style={{ background:"none", border:"1px solid #2a2a2a", borderRadius:6, color:"#f04444", fontSize:12, padding:"5px 11px", cursor:"pointer", fontFamily:"inherit" }}>Remove</button>
        </div>
      </div>
    </Card>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats]       = useState<HabitStat[]>([]);
  const [planned, setPlanned]   = useState<PlannedHabit[]>([]);
  const [reports, setReports]   = useState<Report[]>([]);
  const [tab, setTab]           = useState<"overview"|"planned"|"calendar"|"logs"|"reports"|"google">("overview");
  const [loading, setLoading]   = useState(true);
  const [genLoading, setGenLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState<PlannedHabit | null>(null);

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
    const res  = await fetch("/api/reports", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ period_type:type }) });
    const data = await res.json() as { content:string };
    setReports(prev => [{ id:Date.now().toString(), period:type, period_type:type, content:data.content, created_at:new Date().toISOString() }, ...prev]);
    setTab("reports");
    setGenLoading(false);
  }

  async function removePlanned(id: string) {
    if (!confirm("Remove this planned habit?")) return;
    await fetch(`/api/planned-habits?id=${id}`, { method:"DELETE" });
    setPlanned(prev => prev.filter(p => p.id !== id));
  }

  async function clearChat() {
    if (!confirm("Clear all chat messages? Cannot be undone.")) return;
    await fetch("/api/clear-messages", { method:"DELETE" });
    alert("Chat history cleared.");
  }

  const tabBtn = (t: string, label: string) => (
    <button onClick={() => setTab(t as typeof tab)} style={{ padding:"8px 16px", borderRadius:6, fontSize:13, fontWeight:600, color:tab===t?"#e9edef":"#555", background:tab===t?"#1f2c34":"transparent", border:tab===t?"1px solid #2a3942":"1px solid transparent", cursor:"pointer", fontFamily:"inherit", transition:"all .15s" }}>
      {label}
    </button>
  );

  return (
    <>
      <Head><title>Apela — Dashboard</title></Head>
      <div style={{ minHeight:"100vh", background:"#0a0a0a", color:"#e9edef", fontFamily:"'Inter',sans-serif" }}>

        {/* Top bar */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 24px", borderBottom:"1px solid #1a1a1a", background:"#0a0a0a", position:"sticky", top:0, zIndex:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <img src="/icons/icon-192x192.png" alt="Apela" style={{ width:32, height:32, borderRadius:"50%", objectFit:"cover" }} />
            <div>
              <p style={{ fontWeight:600, fontSize:14 }}>Apela</p>
              <p style={{ fontSize:11, color:"#555", fontFamily:"'JetBrains Mono',monospace" }}>dashboard</p>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={clearChat} style={{ fontSize:12, color:"#555", padding:"7px 14px", borderRadius:6, border:"1px solid #222", background:"none", cursor:"pointer", fontFamily:"inherit" }}>Clear chat</button>
            <Link href="/chat" style={{ fontSize:13, color:"#00a884", padding:"7px 16px", borderRadius:6, border:"1px solid #00a884", fontWeight:600 }}>→ Open Chat</Link>
          </div>
        </div>

        <div style={{ maxWidth:800, margin:"0 auto", padding:"24px 20px" }}>

          {/* Tabs */}
          <div style={{ display:"flex", gap:6, marginBottom:24, flexWrap:"wrap" }}>
            {tabBtn("overview","Overview")}
            {tabBtn("planned","Planned")}
            {tabBtn("calendar","Calendar")}
            {tabBtn("logs","Logs")}
            {tabBtn("reports","Reports")}
            {tabBtn("google","Google")}
          </div>

          {loading && <p style={{ color:"#444", fontFamily:"'JetBrains Mono',monospace", fontSize:13 }}>Loading…</p>}

          {/* ── OVERVIEW ── */}
          {!loading && tab==="overview" && (
            <div>
              {stats.length===0 ? (
                <Card><p style={{ color:"#555", fontSize:13, fontFamily:"'JetBrains Mono',monospace" }}>No habit data yet. Open the chat and tell Apela what you did today.</p></Card>
              ) : stats.map(s => (
                <Card key={s.name} style={{ marginBottom:16 }}>
                  <h2 style={{ fontSize:16, fontWeight:600, textTransform:"capitalize", marginBottom:14 }}>{s.name}</h2>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                    {[["sessions",s.totalSessions],["minutes",s.totalDuration],["days",s.uniqueDays],["best day",s.bestDay]].map(([label,val]) => (
                      <div key={label as string} style={{ textAlign:"center" }}>
                        <p style={{ fontSize:24, fontWeight:700, color:"#00a884", fontFamily:"'JetBrains Mono',monospace", lineHeight:1 }}>{val}</p>
                        <p style={{ fontSize:11, color:"#555", marginTop:4, fontFamily:"'JetBrains Mono',monospace" }}>{label}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop:12 }}><Label>Last 7 days</Label><WeekStrip last7={s.last7} /></div>
                </Card>
              ))}
              <div style={{ marginTop:20 }}>
                <Label>Generate pattern report</Label>
                <div style={{ display:"flex", gap:8 }}>
                  {(["week","month","year"] as const).map(p => (
                    <Btn key={p} onClick={() => generateReport(p)} disabled={genLoading}>{genLoading?"…":`This ${p}`}</Btn>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PLANNED HABITS ── */}
          {!loading && tab==="planned" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div>
                  <p style={{ fontSize:15, fontWeight:600 }}>Planned Habits</p>
                  <p style={{ fontSize:12, color:"#555", marginTop:3 }}>Apela uses these to build your morning brief and evening summary.</p>
                </div>
                {!showAddForm && !editingHabit && (
                  <Btn onClick={() => setShowAddForm(true)} variant="primary" style={{ flexShrink:0, marginLeft:16 }}>+ Add habit</Btn>
                )}
              </div>

              {showAddForm && (
                <PlannedHabitForm
                  onSave={h => { setPlanned(prev => [...prev, h]); setShowAddForm(false); }}
                  onCancel={() => setShowAddForm(false)}
                />
              )}

              {editingHabit && (
                <PlannedHabitForm
                  initial={editingHabit}
                  onSave={updated => {
                    setPlanned(prev => prev.map(p => p.id===updated.id ? updated : p));
                    setEditingHabit(null);
                  }}
                  onCancel={() => setEditingHabit(null)}
                />
              )}

              {planned.length===0 && !showAddForm && !editingHabit ? (
                <Card><p style={{ color:"#555", fontSize:13, fontFamily:"'JetBrains Mono',monospace" }}>No planned habits yet. Add them here or tell Apela in the chat.</p></Card>
              ) : (
                planned.map(p => (
                  <PlannedCard key={p.id} habit={p} onEdit={() => { setEditingHabit(p); setShowAddForm(false); }} onRemove={() => removePlanned(p.id)} />
                ))
              )}
            </div>
          )}

          {/* ── CALENDAR ── */}
          {!loading && tab==="calendar" && <CalendarView />}

          {/* ── LOGS ── */}
          {!loading && tab==="logs" && (
            <div>
              {stats.length===0 ? (
                <Card><p style={{ color:"#555", fontSize:13, fontFamily:"'JetBrains Mono',monospace" }}>No habits tracked yet.</p></Card>
              ) : stats.map(s => (
                <Card key={s.name} style={{ marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                    <h3 style={{ fontSize:15, fontWeight:600, textTransform:"capitalize" }}>{s.name}</h3>
                    <button onClick={async () => {
                      if (!confirm(`Delete ALL ${s.name} logs? This cannot be undone.`)) return;
                      await fetch(`/api/logs?habit=${encodeURIComponent(s.name)}`, { method:"DELETE" });
                      window.location.reload();
                    }} style={{ background:"none", border:"1px solid #2a2a2a", borderRadius:5, color:"#f04444", fontSize:11, padding:"5px 10px", cursor:"pointer", fontFamily:"inherit" }}>
                      Delete all
                    </button>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    {[["Total sessions",s.totalSessions],["Total time (min)",s.totalDuration],["Active days",s.uniqueDays],["Best day",s.bestDay]].map(([label,val]) => (
                      <div key={label as string}><Label>{label as string}</Label><p style={{ fontSize:20, fontWeight:700, color:"#00a884", fontFamily:"'JetBrains Mono',monospace" }}>{val}</p></div>
                    ))}
                  </div>
                  <div style={{ marginTop:14 }}><Label>Last 7 days</Label><WeekStrip last7={s.last7} /></div>
                </Card>
              ))}
            </div>
          )}

          {/* ── GOOGLE ── */}
          {!loading && tab==="google" && <GoogleTab />}

          {/* ── REPORTS ── */}
          {!loading && tab==="reports" && (
            <div>
              <div style={{ marginBottom:20 }}>
                <Label>Generate new report</Label>
                <div style={{ display:"flex", gap:8 }}>
                  {(["week","month","year"] as const).map(p => (
                    <Btn key={p} onClick={() => generateReport(p)} variant="primary" disabled={genLoading}>{genLoading?"Generating…":`This ${p}`}</Btn>
                  ))}
                </div>
              </div>
              {reports.length===0 ? (
                <Card><p style={{ color:"#555", fontSize:13, fontFamily:"'JetBrains Mono',monospace" }}>No reports yet.</p></Card>
              ) : reports.map(r => (
                <Card key={r.id} style={{ marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:"#00a884", background:"rgba(0,168,132,0.1)", padding:"3px 8px", borderRadius:4, fontFamily:"'JetBrains Mono',monospace", textTransform:"uppercase", letterSpacing:"0.06em" }}>{r.period_type} · {r.period}</span>
                    <span style={{ fontSize:11, color:"#444", fontFamily:"'JetBrains Mono',monospace" }}>{format(new Date(r.created_at),"MMM d, yyyy")}</span>
                  </div>
                  <p style={{ fontSize:14, lineHeight:1.8, color:"#ccc", whiteSpace:"pre-wrap" }}>{r.content}</p>
                </Card>
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
