import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser]         = useState<{ id: string; email: string } | null>(null);
  const [geminiKey, setGeminiKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      setUser({ id: data.session.user.id, email: data.session.user.email || "" });

      // Load settings
      const { data: settings } = await supabase
        .from("user_settings")
        .select("gemini_key, display_name")
        .eq("user_id", data.session.user.id)
        .single();

      if (settings) {
        setGeminiKey(settings.gemini_key || "");
        setDisplayName(settings.display_name || "");
      }
      setLoading(false);
    });
  }, [router]);

  async function save() {
    if (!user) return;
    setSaving(true); setSaved(false);

    await supabase.from("user_settings").upsert({
      user_id:      user.id,
      gemini_key:   geminiKey.trim() || null,
      display_name: displayName.trim() || null,
      updated_at:   new Date().toISOString(),
    }, { onConflict: "user_id" });

    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const inp = (value: string, onChange: (v: string) => void, placeholder: string, type = "text") => (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8, color:"#e9edef", padding:"11px 14px", fontSize:14, outline:"none", width:"100%", fontFamily:"inherit" }}
    />
  );

  return (
    <>
      <Head><title>Apela — Settings</title></Head>
      <div style={{ minHeight:"100vh", background:"#0a0a0a", color:"#e9edef", fontFamily:"'Inter',sans-serif" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 24px", borderBottom:"1px solid #1a1a1a" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <img src="/icons/icon-192x192.png" alt="Apela" style={{ width:32, height:32, borderRadius:"50%", objectFit:"cover" }} />
            <p style={{ fontWeight:600, fontSize:14 }}>Settings</p>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <Link href="/chat" style={{ fontSize:13, color:"#00a884", padding:"7px 16px", borderRadius:6, border:"1px solid #00a884", fontWeight:600 }}>← Chat</Link>
          </div>
        </div>

        <div style={{ maxWidth:480, margin:"0 auto", padding:"32px 20px" }}>
          {loading ? <p style={{ color:"#444", fontFamily:"'JetBrains Mono',monospace" }}>Loading…</p> : (
            <div style={{ display:"flex", flexDirection:"column", gap:24 }}>

              {/* Account */}
              <div style={{ background:"#111", border:"1px solid #222", borderRadius:10, padding:20 }}>
                <p style={{ fontSize:12, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#666", marginBottom:12, fontFamily:"'JetBrains Mono',monospace" }}>Account</p>
                <p style={{ fontSize:14, color:"#888", marginBottom:4 }}>Signed in as</p>
                <p style={{ fontSize:15, fontWeight:600 }}>{user?.email}</p>
              </div>

              {/* Display name */}
              <div style={{ background:"#111", border:"1px solid #222", borderRadius:10, padding:20 }}>
                <p style={{ fontSize:12, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#666", marginBottom:12, fontFamily:"'JetBrains Mono',monospace" }}>Display name</p>
                {inp(displayName, setDisplayName, "Your name (used by Apela)")}
              </div>

              {/* Gemini API Key */}
              <div style={{ background:"#111", border:"1px solid #222", borderRadius:10, padding:20 }}>
                <p style={{ fontSize:12, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#666", marginBottom:8, fontFamily:"'JetBrains Mono',monospace" }}>Gemini API Key</p>
                <p style={{ fontSize:12, color:"#555", marginBottom:12, lineHeight:1.6 }}>
                  Get your free key at{" "}
                  <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" style={{ color:"#00a884" }}>aistudio.google.com</a>
                  {" "}→ Get API key. This powers your personal Apela assistant.
                </p>
                {inp(geminiKey, setGeminiKey, "AIza...", "password")}
                {geminiKey && (
                  <p style={{ fontSize:11, color:"#00a884", marginTop:8, fontFamily:"'JetBrains Mono',monospace" }}>✓ API key set</p>
                )}
                {!geminiKey && (
                  <p style={{ fontSize:11, color:"#f5a623", marginTop:8, fontFamily:"'JetBrains Mono',monospace" }}>⚠ No key set — Apela won't respond until you add one</p>
                )}
              </div>

              {/* Save */}
              <button onClick={save} disabled={saving} style={{ padding:"12px", borderRadius:8, background:"#00a884", border:"none", color:"#fff", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit", opacity:saving?0.7:1 }}>
                {saving ? "Saving…" : saved ? "✓ Saved!" : "Save settings"}
              </button>

              {/* Sign out */}
              <button onClick={signOut} style={{ padding:"12px", borderRadius:8, background:"none", border:"1px solid #333", color:"#555", fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
                Sign out
              </button>

            </div>
          )}
        </div>
      </div>
    </>
  );
}
