import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode]       = useState<"login"|"signup">("login");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    // If already logged in, redirect
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/chat");
    });
  }, [router]);

  async function handleEmailAuth() {
    if (!email.trim() || !password.trim()) { setError("Email and password required"); return; }
    setLoading(true); setError(""); setMessage("");

    if (mode === "signup") {
      const { error: err } = await supabase.auth.signUp({ email, password });
      if (err) { setError(err.message); setLoading(false); return; }
      setMessage("Account created. Check your email to confirm, then log in.");
      setMode("login");
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) { setError(err.message); setLoading(false); return; }
      router.replace("/chat");
    }
    setLoading(false);
  }

  async function handleGoogle() {
    setLoading(true); setError("");
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/chat` },
    });
    if (err) { setError(err.message); setLoading(false); }
  }

  return (
    <>
      <Head><title>Apela — Sign In</title></Head>
      <div style={{ minHeight:"100vh", background:"#0a0a0a", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"24px", fontFamily:"'Inter',sans-serif" }}>

        {/* Logo */}
        <div style={{ marginBottom:32, textAlign:"center" }}>
          <img src="/icons/icon-192x192.png" alt="Apela" style={{ width:64, height:64, borderRadius:"50%", objectFit:"cover", marginBottom:12 }} />
          <h1 style={{ fontSize:24, fontWeight:700, color:"#e9edef", margin:0 }}>Apela</h1>
          <p style={{ fontSize:13, color:"#555", marginTop:4 }}>Your personal digital secretary</p>
        </div>

        {/* Card */}
        <div style={{ width:"100%", maxWidth:380, background:"#111", border:"1px solid #222", borderRadius:12, padding:28 }}>
          <h2 style={{ fontSize:17, fontWeight:600, color:"#e9edef", marginBottom:20, textAlign:"center" }}>
            {mode === "login" ? "Sign in to Apela" : "Create your account"}
          </h2>

          {/* Google */}
          <button onClick={handleGoogle} disabled={loading} style={{ width:"100%", padding:"11px 16px", borderRadius:8, background:"#fff", border:"none", display:"flex", alignItems:"center", justifyContent:"center", gap:10, fontSize:14, fontWeight:600, color:"#1a1a1a", cursor:"pointer", marginBottom:16, opacity:loading?0.7:1, fontFamily:"inherit" }}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <div style={{ flex:1, height:1, background:"#222" }} />
            <span style={{ fontSize:12, color:"#444" }}>or</span>
            <div style={{ flex:1, height:1, background:"#222" }} />
          </div>

          {/* Email */}
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8, color:"#e9edef", padding:"11px 14px", fontSize:14, outline:"none", fontFamily:"inherit" }}
            />
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              onKeyDown={e => e.key === "Enter" && handleEmailAuth()}
              style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8, color:"#e9edef", padding:"11px 14px", fontSize:14, outline:"none", fontFamily:"inherit" }}
            />

            {error && <p style={{ fontSize:12, color:"#f04444", margin:0 }}>{error}</p>}
            {message && <p style={{ fontSize:12, color:"#00a884", margin:0 }}>{message}</p>}

            <button onClick={handleEmailAuth} disabled={loading} style={{ padding:"11px", borderRadius:8, background:"#00a884", border:"none", color:"#fff", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit", opacity:loading?0.7:1, marginTop:4 }}>
              {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </div>

          {/* Toggle */}
          <p style={{ fontSize:13, color:"#555", textAlign:"center", marginTop:20, marginBottom:0 }}>
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => { setMode(mode==="login"?"signup":"login"); setError(""); setMessage(""); }} style={{ background:"none", border:"none", color:"#00a884", fontSize:13, cursor:"pointer", fontFamily:"inherit", padding:0 }}>
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>

        <p style={{ fontSize:11, color:"#333", marginTop:24, textAlign:"center", maxWidth:300 }}>
          By signing up, each user provides their own Gemini API key in settings to power their personal assistant.
        </p>
      </div>
    </>
  );
}
