import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep]         = useState<1|2>(1);
  const [apiKey, setApiKey]     = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  async function saveAndContinue() {
    if (!apiKey.trim()) { setError("Please enter your Gemini API key to continue."); return; }
    if (!apiKey.startsWith("AIza")) { setError("That doesn't look like a valid Gemini key. It should start with 'AIza'."); return; }
    setSaving(true); setError("");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/login"); return; }

    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ gemini_key: apiKey.trim() }),
    });

    if (!res.ok) { setError("Failed to save. Please try again."); setSaving(false); return; }
    router.replace("/chat");
  }

  return (
    <>
      <Head><title>Apela — Setup</title></Head>
      <div style={{ minHeight:"100vh", background:"#0a0a0a", color:"#e9edef", fontFamily:"'Inter',sans-serif", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"28px" }}>

        <img src="/icons/icon-192x192.png" alt="Apela" style={{ width:64, height:64, borderRadius:"50%", objectFit:"cover", marginBottom:20 }} />

        {step === 1 ? (
          <div style={{ maxWidth:440, width:"100%", textAlign:"center" }}>
            <h1 style={{ fontSize:24, fontWeight:700, marginBottom:10 }}>Welcome to Apela</h1>
            <p style={{ fontSize:14, color:"#8696a0", lineHeight:1.7, marginBottom:32 }}>
              Apela is your personal habit logging secretary. Chat naturally — tell her what you did, and she remembers everything. Morning briefings, evening summaries, and honest pattern reports.
            </p>
            <div style={{ textAlign:"left", background:"#111", border:"1px solid #1a1a1a", borderRadius:10, padding:20, marginBottom:28 }}>
              {[
                "Log habits and activities by just telling her",
                "Track streaks and see your patterns over time",
                "Get a morning plan and evening summary every day",
                "Add Google Calendar events and Tasks from chat",
                "Full dashboard with calendar and detailed logs",
              ].map(f => (
                <div key={f} style={{ display:"flex", gap:10, marginBottom:10, fontSize:14 }}>
                  <span style={{ color:"#00a884", flexShrink:0 }}>✓</span>
                  <span style={{ color:"#ccc" }}>{f}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setStep(2)} style={{ width:"100%", padding:"13px", borderRadius:10, background:"#00a884", border:"none", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              Set up my account →
            </button>
          </div>

        ) : (
          <div style={{ maxWidth:440, width:"100%", textAlign:"center" }}>
            <h2 style={{ fontSize:22, fontWeight:700, marginBottom:8 }}>Add your Gemini API key</h2>
            <p style={{ fontSize:14, color:"#8696a0", lineHeight:1.7, marginBottom:24 }}>
              Apela uses Google's Gemini AI to understand your messages. Each user brings their own free API key — this keeps your account independent and prevents crashes.
            </p>

            {/* Steps */}
            <div style={{ background:"#111", border:"1px solid #1a1a1a", borderRadius:10, padding:20, marginBottom:20, textAlign:"left" }}>
              <p style={{ fontSize:13, fontWeight:600, color:"#555", marginBottom:12, textTransform:"uppercase", letterSpacing:"0.08em" }}>How to get your free key</p>
              {[
                { step:"1", text:"Go to Google AI Studio", link:"https://aistudio.google.com", linkText:"aistudio.google.com" },
                { step:"2", text:'Sign in with Google → click "Get API key"' },
                { step:"3", text:'"Create API key" → copy the key (starts with AIza...)' },
                { step:"4", text:"Paste it below" },
              ].map(s => (
                <div key={s.step} style={{ display:"flex", gap:12, marginBottom:10, fontSize:13 }}>
                  <span style={{ background:"#1a1a1a", borderRadius:"50%", width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:11, fontWeight:700, color:"#00a884" }}>{s.step}</span>
                  <span style={{ color:"#aaa", lineHeight:1.5 }}>
                    {s.text}
                    {s.link && <> — <a href={s.link} target="_blank" rel="noreferrer" style={{ color:"#00a884" }}>{s.linkText}</a></>}
                  </span>
                </div>
              ))}
            </div>

            <input
              type="text"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="AIza..."
              autoFocus
              style={{ width:"100%", background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8, color:"#e9edef", padding:"12px 14px", fontSize:14, outline:"none", fontFamily:"'JetBrains Mono',monospace", marginBottom:10, boxSizing:"border-box" }}
            />

            {error && <p style={{ fontSize:12, color:"#f04444", marginBottom:10 }}>{error}</p>}

            <button onClick={saveAndContinue} disabled={saving} style={{ width:"100%", padding:"13px", borderRadius:10, background:"#00a884", border:"none", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"inherit", opacity:saving?0.7:1 }}>
              {saving ? "Saving…" : "Start using Apela →"}
            </button>

            <button onClick={() => setStep(1)} style={{ background:"none", border:"none", color:"#444", fontSize:13, cursor:"pointer", marginTop:14, fontFamily:"inherit" }}>
              ← Back
            </button>
          </div>
        )}
      </div>
    </>
  );
}
