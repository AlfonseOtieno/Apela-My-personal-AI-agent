import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function LandingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/chat");
      else setChecking(false);
    });
  }, [router]);

  if (checking) return null;

  return (
    <>
      <Head>
        <title>Apela — Your Personal Digital Secretary</title>
        <meta name="description" content="Apela logs your habits, tracks your progress, and gives you honest reports. A focused AI assistant that remembers everything so you don't have to." />
      </Head>
      <div style={{ minHeight:"100vh", background:"#0a0a0a", color:"#e9edef", fontFamily:"'Inter',sans-serif" }}>

        {/* Nav */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 28px", borderBottom:"1px solid #111" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <img src="/icons/icon-192x192.png" alt="Apela" style={{ width:32, height:32, borderRadius:"50%", objectFit:"cover" }} />
            <span style={{ fontWeight:700, fontSize:15 }}>Apela</span>
          </div>
          <Link href="/login" style={{ fontSize:13, fontWeight:600, color:"#00a884", padding:"8px 18px", borderRadius:8, border:"1px solid #00a884", textDecoration:"none" }}>
            Sign in
          </Link>
        </div>

        {/* Hero */}
        <div style={{ maxWidth:560, margin:"0 auto", padding:"72px 28px 48px", textAlign:"center" }}>
          <img src="/icons/icon-192x192.png" alt="Apela" style={{ width:80, height:80, borderRadius:"50%", objectFit:"cover", marginBottom:28 }} />
          <h1 style={{ fontSize:34, fontWeight:800, lineHeight:1.2, marginBottom:16, letterSpacing:"-0.02em" }}>
            Your personal digital secretary
          </h1>
          <p style={{ fontSize:16, color:"#8696a0", lineHeight:1.7, marginBottom:36 }}>
            Apela logs your habits, tracks your consistency, and gives you honest reports on your patterns. Just tell her what you did — she remembers everything.
          </p>
          <Link href="/login" style={{ display:"inline-block", padding:"13px 32px", borderRadius:10, background:"#00a884", color:"#fff", fontWeight:700, fontSize:15, textDecoration:"none" }}>
            Get started free →
          </Link>
          <p style={{ fontSize:12, color:"#444", marginTop:14 }}>
            Requires a free Gemini API key · No credit card needed
          </p>
        </div>

        {/* How it works */}
        <div style={{ maxWidth:600, margin:"0 auto", padding:"0 28px 64px" }}>
          <div style={{ borderTop:"1px solid #1a1a1a", paddingTop:48, marginBottom:40, textAlign:"center" }}>
            <p style={{ fontSize:12, fontWeight:600, letterSpacing:"0.12em", textTransform:"uppercase", color:"#555", marginBottom:12 }}>How it works</p>
            <h2 style={{ fontSize:22, fontWeight:700 }}>Chat like WhatsApp. Track like a pro.</h2>
          </div>

          {[
            { emoji:"💬", title:"Just chat", body:"Tell Apela what you did. 'Did my workout for 45 min, felt good.' She logs it, asks if anything's unclear, and remembers it." },
            { emoji:"📊", title:"See your patterns", body:"Weekly and monthly reports show your consistency, best days, missed habits, and trends — all generated from your actual logs." },
            { emoji:"📅", title:"Plan your habits", body:"Set recurring habits with schedules and targets. Apela uses them to build your morning brief and evening summary every day." },
            { emoji:"🔑", title:"Your data, your key", body:"You bring your own Gemini API key (free from Google). Your data stays in your account. Nobody else sees it." },
          ].map(f => (
            <div key={f.title} style={{ display:"flex", gap:18, marginBottom:28 }}>
              <span style={{ fontSize:26, flexShrink:0, marginTop:2 }}>{f.emoji}</span>
              <div>
                <p style={{ fontWeight:600, fontSize:15, marginBottom:5 }}>{f.title}</p>
                <p style={{ fontSize:14, color:"#8696a0", lineHeight:1.65 }}>{f.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ borderTop:"1px solid #111", padding:"48px 28px", textAlign:"center" }}>
          <h2 style={{ fontSize:22, fontWeight:700, marginBottom:12 }}>Ready to start tracking?</h2>
          <p style={{ fontSize:14, color:"#555", marginBottom:28 }}>Sign up with Google or your email. Free forever.</p>
          <Link href="/login" style={{ display:"inline-block", padding:"13px 32px", borderRadius:10, background:"#00a884", color:"#fff", fontWeight:700, fontSize:15, textDecoration:"none" }}>
            Create your account →
          </Link>
        </div>

        {/* Footer */}
        <div style={{ borderTop:"1px solid #0f0f0f", padding:"20px 28px", textAlign:"center" }}>
          <p style={{ fontSize:12, color:"#333" }}>Apela · Built by Alphonse Otieno · <a href="https://alfonseotieno.github.io/Personal-portfolio-/" target="_blank" rel="noreferrer" style={{ color:"#444", textDecoration:"none" }}>Portfolio</a></p>
        </div>
      </div>
    </>
  );
}
