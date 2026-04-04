import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";

type CalendarEvent = {
  id?: string; summary: string; start: string; end: string;
  description?: string; location?: string;
};
type Task = {
  id?: string; title: string; notes?: string; due?: string; status?: string;
};

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background:"#111", border:"1px solid #222", borderRadius:8, padding:16, ...style }}>{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize:11, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#666", marginBottom:8, fontFamily:"'JetBrains Mono',monospace" }}>{children}</p>;
}
function Inp({ value, onChange, placeholder, type="text" }: { value:string; onChange:(v:string)=>void; placeholder?:string; type?:string }) {
  return <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:6, color:"#e9edef", padding:"9px 13px", fontSize:13, outline:"none", width:"100%", fontFamily:"inherit" }} />;
}

export default function GoogleTab() {
  const [connected, setConnected]   = useState(false);
  const [checking, setChecking]     = useState(true);
  const [events, setEvents]         = useState<CalendarEvent[]>([]);
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError]           = useState("");

  // Add event form
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate]   = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd]     = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDesc, setEventDesc]   = useState("");
  const [savingEvent, setSavingEvent] = useState(false);

  // Add task form
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle]   = useState("");
  const [taskDue, setTaskDue]       = useState("");
  const [taskNotes, setTaskNotes]   = useState("");
  const [savingTask, setSavingTask] = useState(false);

  useEffect(() => {
    // Show error from URL if OAuth failed
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get("error");
    if (urlError) setError(decodeURIComponent(urlError));

    // Check if Google is connected
    fetch("/api/google-calendar")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setConnected(true);
          setEvents(data);
          setError("");
        } else {
          // Show the actual error message from the API
          const errMsg = (data as { error?: string }).error || "Not connected";
          if (!errMsg.includes("not connected") && !errMsg.includes("Not connected")) {
            setError(errMsg);
          }
          setConnected(false);
        }
        setChecking(false);
      })
      .catch(() => { setConnected(false); setChecking(false); });

    fetch("/api/google-tasks")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setTasks(data); })
      .catch(() => {});
  }, []);

  async function saveEvent() {
    if (!eventTitle.trim() || !eventDate || !eventStart) { setError("Title, date and start time are required"); return; }
    setSavingEvent(true); setError("");
    const startISO = `${eventDate}T${eventStart}:00`;
    const endISO   = eventEnd ? `${eventDate}T${eventEnd}:00` : `${eventDate}T${String(parseInt(eventStart.split(":")[0])+1).padStart(2,"0")}:${eventStart.split(":")[1]}:00`;

    const res = await fetch("/api/google-calendar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary: eventTitle, start: startISO, end: endISO, location: eventLocation, description: eventDesc }),
    });
    const data = await res.json() as CalendarEvent & { error?: string };
    if (data.error) { setError(data.error); setSavingEvent(false); return; }
    setEvents(prev => [data, ...prev]);
    setEventTitle(""); setEventDate(""); setEventStart(""); setEventEnd(""); setEventLocation(""); setEventDesc("");
    setShowEventForm(false); setSavingEvent(false);
  }

  async function deleteEvent(id: string) {
    if (!confirm("Delete this event from Google Calendar?")) return;
    await fetch(`/api/google-calendar?id=${id}`, { method: "DELETE" });
    setEvents(prev => prev.filter(e => e.id !== id));
  }

  async function saveTask() {
    if (!taskTitle.trim()) { setError("Task title is required"); return; }
    setSavingTask(true); setError("");
    const res = await fetch("/api/google-tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: taskTitle, due: taskDue ? `${taskDue}T00:00:00Z` : undefined, notes: taskNotes }),
    });
    const data = await res.json() as Task & { error?: string };
    if (data.error) { setError(data.error); setSavingTask(false); return; }
    setTasks(prev => [data, ...prev]);
    setTaskTitle(""); setTaskDue(""); setTaskNotes("");
    setShowTaskForm(false); setSavingTask(false);
  }

  async function completeTask(id: string) {
    await fetch(`/api/google-tasks?id=${id}`, { method: "PATCH" });
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  async function deleteTask(id: string) {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/google-tasks?id=${id}`, { method: "DELETE" });
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  function formatEventTime(iso: string) {
    try { return format(parseISO(iso), "MMM d · h:mm a"); } catch { return iso; }
  }

  if (checking) return <p style={{ color:"#444", fontFamily:"'JetBrains Mono',monospace", fontSize:13 }}>Checking Google connection…</p>;

  if (!connected) return (
    <div>
      <Card style={{ marginBottom:16 }}>
        <p style={{ fontSize:15, fontWeight:600, marginBottom:8 }}>Connect Google</p>
        <p style={{ fontSize:13, color:"#888", marginBottom:16, lineHeight:1.6 }}>
          Connect your Google account to manage Calendar events and Tasks directly from Apela.
          You can also tell Apela in the chat to add events or tasks.
        </p>
        <a
          href="/api/auth/google"
          style={{ display:"inline-block", padding:"10px 20px", borderRadius:6, background:"#4285f4", color:"#fff", fontWeight:600, fontSize:13, textDecoration:"none" }}
        >
          Connect Google Account →
        </a>
      </Card>
      <Card>
        <p style={{ fontSize:13, color:"#555", fontFamily:"'JetBrains Mono',monospace" }}>
          Once connected, you can say things like:<br/><br/>
          "Add meeting with Dr. Kamau on Monday at 2pm"<br/>
          "Add task: review boxing footage by Friday"<br/>
          "What's on my calendar today?"
        </p>
      </Card>
    </div>
  );

  return (
    <div>
      {error && <p style={{ fontSize:12, color:"#f04444", marginBottom:12, fontFamily:"'JetBrains Mono',monospace" }}>{error}</p>}

      {/* ── CALENDAR ── */}
      <div style={{ marginBottom:28 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <Label>Google Calendar — Upcoming</Label>
          <button onClick={() => { setShowEventForm(!showEventForm); setShowTaskForm(false); }} style={{ background:"#00a884", border:"none", borderRadius:6, color:"#fff", fontSize:12, fontWeight:600, padding:"7px 14px", cursor:"pointer", fontFamily:"inherit" }}>
            {showEventForm ? "Cancel" : "+ Add event"}
          </button>
        </div>

        {showEventForm && (
          <Card style={{ marginBottom:12, border:"1px solid #2a3942" }}>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <Inp value={eventTitle} onChange={setEventTitle} placeholder="Event title *" />
              <Inp type="date" value={eventDate} onChange={setEventDate} />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <div><Label>Start time *</Label><Inp type="time" value={eventStart} onChange={setEventStart} /></div>
                <div><Label>End time</Label><Inp type="time" value={eventEnd} onChange={setEventEnd} /></div>
              </div>
              <Inp value={eventLocation} onChange={setEventLocation} placeholder="Location (optional)" />
              <Inp value={eventDesc} onChange={setEventDesc} placeholder="Description (optional)" />
              <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                <button onClick={() => setShowEventForm(false)} style={{ padding:"8px 16px", borderRadius:6, fontSize:13, background:"none", color:"#555", border:"1px solid #222", cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
                <button onClick={saveEvent} disabled={savingEvent} style={{ padding:"8px 18px", borderRadius:6, fontSize:13, fontWeight:600, background:"#00a884", color:"#fff", border:"none", cursor:"pointer", fontFamily:"inherit", opacity:savingEvent?0.6:1 }}>{savingEvent?"Saving…":"Add to calendar"}</button>
              </div>
            </div>
          </Card>
        )}

        {events.length === 0 ? (
          <Card><p style={{ color:"#555", fontSize:13, fontFamily:"'JetBrains Mono',monospace" }}>No upcoming events in the next 14 days.</p></Card>
        ) : events.map((e, i) => (
          <Card key={e.id || i} style={{ marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <p style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>{e.summary}</p>
              <p style={{ fontSize:12, color:"#00a884", fontFamily:"'JetBrains Mono',monospace" }}>{formatEventTime(e.start)}</p>
              {e.location && <p style={{ fontSize:12, color:"#555", marginTop:2 }}>📍 {e.location}</p>}
            </div>
            {e.id && (
              <button onClick={() => deleteEvent(e.id!)} style={{ background:"none", border:"1px solid #2a2a2a", borderRadius:5, color:"#f04444", fontSize:11, padding:"5px 10px", cursor:"pointer", fontFamily:"inherit", flexShrink:0, marginLeft:12 }}>Delete</button>
            )}
          </Card>
        ))}
      </div>

      {/* ── TASKS ── */}
      <div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <Label>Google Tasks</Label>
          <button onClick={() => { setShowTaskForm(!showTaskForm); setShowEventForm(false); }} style={{ background:"#00a884", border:"none", borderRadius:6, color:"#fff", fontSize:12, fontWeight:600, padding:"7px 14px", cursor:"pointer", fontFamily:"inherit" }}>
            {showTaskForm ? "Cancel" : "+ Add task"}
          </button>
        </div>

        {showTaskForm && (
          <Card style={{ marginBottom:12, border:"1px solid #2a3942" }}>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <Inp value={taskTitle} onChange={setTaskTitle} placeholder="Task title *" />
              <div><Label>Due date (optional)</Label><Inp type="date" value={taskDue} onChange={setTaskDue} /></div>
              <Inp value={taskNotes} onChange={setTaskNotes} placeholder="Notes (optional)" />
              <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                <button onClick={() => setShowTaskForm(false)} style={{ padding:"8px 16px", borderRadius:6, fontSize:13, background:"none", color:"#555", border:"1px solid #222", cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
                <button onClick={saveTask} disabled={savingTask} style={{ padding:"8px 18px", borderRadius:6, fontSize:13, fontWeight:600, background:"#00a884", color:"#fff", border:"none", cursor:"pointer", fontFamily:"inherit", opacity:savingTask?0.6:1 }}>{savingTask?"Saving…":"Add task"}</button>
              </div>
            </div>
          </Card>
        )}

        {tasks.length === 0 ? (
          <Card><p style={{ color:"#555", fontSize:13, fontFamily:"'JetBrains Mono',monospace" }}>No pending tasks in Google Tasks.</p></Card>
        ) : tasks.map((t, i) => (
          <Card key={t.id || i} style={{ marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:14, fontWeight:600 }}>{t.title}</p>
              {t.due && <p style={{ fontSize:12, color:"#f5a623", fontFamily:"'JetBrains Mono',monospace", marginTop:3 }}>Due: {format(parseISO(t.due), "MMM d, yyyy")}</p>}
              {t.notes && <p style={{ fontSize:12, color:"#555", marginTop:2 }}>{t.notes}</p>}
            </div>
            <div style={{ display:"flex", gap:6, marginLeft:12, flexShrink:0 }}>
              {t.id && <button onClick={() => completeTask(t.id!)} style={{ background:"none", border:"1px solid #2a2a2a", borderRadius:5, color:"#00a884", fontSize:11, padding:"5px 10px", cursor:"pointer", fontFamily:"inherit" }}>Done</button>}
              {t.id && <button onClick={() => deleteTask(t.id!)} style={{ background:"none", border:"1px solid #2a2a2a", borderRadius:5, color:"#f04444", fontSize:11, padding:"5px 10px", cursor:"pointer", fontFamily:"inherit" }}>Delete</button>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
