import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser]           = useState<{ id:string; email:string } | null>(null);
  const [geminiKey, setGeminiKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [loading, setLoading]     = useState(true);
  const [deleting, setDeleting]   = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError]         = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      setUser({ id: data.session.user.id, email: data.session.user.email || "" });

      const res = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${data.session.access_token}` }
      });
      if (res.ok) {
        const s = await res.json() as { gemini_key?: string; display_name?: string };
        setGeminiKey(s.gemini_key || "");
        setDisplayName(s.display_name || "");
      }
      setLoading(false);
    });
  }, [router]);

  async function save() {
    if (!user) return;
    setSaving(true); setSaved(false); setError("");
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
      body: JSON.stringify({ gemini_key: geminiKey.trim() || null, display_name: displayName.trim() || null }),
    });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else setError("Failed to save. Try again.");
    setSaving(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  async function deleteAccount() {
    if (!user) return;
    setDeleting(true);
    const { data: { session } } = await supabase.auth.getSession();
    await fetch("/api/delete-account", {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${session?.access_token}` },
    });
    await supabase.auth.signOut();
    router.replace("/");
  }

  const inputStyle = {
    background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8,
    color:"#e9edef", padding:"11px 14px", fontSize:14, outline:"none",
    width:"100%", fontFamily:"inherit",
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ background:"#111", border:"1px solid #1a1a1a", borderRadius:10, padding:20, marginBottom:12 }}>
      <p style={{ fontSize:11, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#555", marginBottom:14, fontFamily:"'JetBrains Mono',monospace" }}>{title}</p>
      {children}
    </div>
  );

  return (
    <>
      <Head><title>Apela — Settings</title></Head>
      <div style={{ minHeight:"100vh", background:"#0a0a0a", color:"#e9edef", fontFamily:"'Inter',sans-serif" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", borderBottom:"1px solid #1a1a1a", position:"sticky", top:0, background:"#0a0a0a", zIndex:10 }}>
          <p style={{ fontWeight:700, fontSize:15 }}>Settings</p>
          <Link href="/chat" style={{ fontSize:13, color:"#00a884", padding:"7px 14px", borderRadius:6, border:"1px solid #00a884", fontWeight:600, textDecoration:"none" }}>← Chat</Link>
        </div>

        <div style={{ maxWidth:480, margin:"0 auto", padding:"24px 16px" }}>
          {loading ? <p style={{ color:"#444", fontFamily:"'JetBrains Mono',monospace", fontSize:13 }}>Loading…</p> : (
            <>
              <Section title="Account">
                <p style={{ fontSize:13, color:"#555", marginBottom:4 }}>Signed in as</p>
                <p style={{ fontSize:15, fontWeight:600, wordBreak:"break-all" }}>{user?.email}</p>
              </Section>

              <Section title="Display name">
                <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name (shown to Apela)" style={inputStyle} />
              </Section>

              <Section title="Gemini API Key">
                <p style={{ fontSize:12, color:"#555", marginBottom:10, lineHeight:1.6 }}>
                  Get your free key at{" "}
                  <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" style={{ color:"#00a884" }}>aistudio.google.com</a>
                  {" "}→ Get API key. This is required for Apela to respond.
                </p>
                <input
                  type="password" value={geminiKey}
                  onChange={e => setGeminiKey(e.target.value)}
                  placeholder="AIza..."
                  style={{ ...inputStyle, fontFamily:"'JetBrains Mono',monospace" }}
                />
                {geminiKey
                  ? <p style={{ fontSize:11, color:"#00a884", marginTop:8, fontFamily:"'JetBrains Mono',monospace" }}>✓ API key is set</p>
                  : <p style={{ fontSize:11, color:"#f5a623", marginTop:8, fontFamily:"'JetBrains Mono',monospace" }}>⚠ No key set — Apela won't respond until you add one</p>
                }
              </Section>

              {error && <p style={{ fontSize:12, color:"#f04444", marginBottom:10 }}>{error}</p>}

              <button onClick={save} disabled={saving} style={{ width:"100%", padding:"12px", borderRadius:8, background:"#00a884", border:"none", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit", opacity:saving?0.7:1, marginBottom:10 }}>
                {saving ? "Saving…" : saved ? "✓ Saved!" : "Save changes"}
              </button>

              <button onClick={signOut} style={{ width:"100%", padding:"12px", borderRadius:8, background:"none", border:"1px solid #2a2a2a", color:"#888", fontSize:14, cursor:"pointer", fontFamily:"inherit", marginBottom:24 }}>
                Sign out
              </button>

              {/* Danger zone */}
              <div style={{ border:"1px solid #2a1515", borderRadius:10, padding:20 }}>
                <p style={{ fontSize:11, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#f04444", marginBottom:10, fontFamily:"'JetBrains Mono',monospace" }}>Danger zone</p>
                <p style={{ fontSize:13, color:"#555", marginBottom:14, lineHeight:1.6 }}>
                  Deleting your account permanently removes all your messages, habit logs, planned habits, and reports. This cannot be undone.
                </p>
                {!showDeleteConfirm ? (
                  <button onClick={() => setShowDeleteConfirm(true)} style={{ padding:"10px 18px", borderRadius:8, background:"none", border:"1px solid #f04444", color:"#f04444", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                    Delete my account
                  </button>
                ) : (
                  <div>
                    <p style={{ fontSize:13, color:"#f04444", marginBottom:12 }}>Are you sure? This deletes everything permanently.</p>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={() => setShowDeleteConfirm(false)} style={{ flex:1, padding:"10px", borderRadius:8, background:"none", border:"1px solid #2a2a2a", color:"#888", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
                      <button onClick={deleteAccount} disabled={deleting} style={{ flex:1, padding:"10px", borderRadius:8, background:"#f04444", border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", opacity:deleting?0.7:1 }}>
                        {deleting ? "Deleting…" : "Yes, delete everything"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
