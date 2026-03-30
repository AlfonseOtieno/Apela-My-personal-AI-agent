import { useState, useEffect, useRef, FormEvent } from "react";
import Head from "next/head";
import Link from "next/link";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function msgTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function TypingBubble() {
  return (
    <div style={{ display:"flex", gap:6, padding:"10px 14px", background:"#1f2c34", borderRadius:"0 10px 10px 10px", width:"fit-content", marginLeft:8 }}>
      {[0,1,2].map(i => (
        <span key={i} style={{ width:8, height:8, borderRadius:"50%", background:"#8696a0", display:"block", animation:"bounce 1.2s ease infinite", animationDelay:`${i*0.2}s` }} />
      ))}
    </div>
  );
}

function InstallBanner({ onInstall, onDismiss }: { onInstall:()=>void; onDismiss:()=>void }) {
  return (
    <div className="banner-in" style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"#0d2018", borderBottom:"1px solid #1a3828", flexShrink:0 }}>
      <img src="/icons/icon-192x192.png" alt="Apela" style={{ width:36, height:36, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
      <div style={{ flex:1 }}>
        <p style={{ fontSize:13, fontWeight:600, color:"#e9edef", lineHeight:1.3 }}>Install Apela</p>
        <p style={{ fontSize:11, color:"#8696a0", lineHeight:1.3 }}>Add to your home screen for quick access</p>
      </div>
      <button onClick={onInstall} style={{ padding:"7px 14px", borderRadius:20, background:"#00a884", border:"none", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", flexShrink:0, fontFamily:"inherit" }}>
        Install
      </button>
      <button onClick={onDismiss} style={{ background:"none", border:"none", color:"#8696a0", fontSize:20, cursor:"pointer", padding:"0 4px", lineHeight:1, flexShrink:0 }}>
        ×
      </button>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [booted, setBooted]     = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner]       = useState(false);
  const [isInstalled, setIsInstalled]     = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // PWA install detection
  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) { setIsInstalled(true); return; }

    if (localStorage.getItem("apela-install-dismissed")) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari fallback
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isIOS && isSafari) setTimeout(() => setShowBanner(true), 3000);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (installPrompt) {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") { setIsInstalled(true); }
      setShowBanner(false);
      setInstallPrompt(null);
    } else {
      // iOS manual instructions
      setMessages(prev => [...prev, {
        id: `ios-${Date.now()}`, role: "assistant",
        content: "To install Apela on iOS:\n\n1. Tap the Share button (□↑) at the bottom of Safari\n2. Tap \"Add to Home Screen\"\n3. Tap \"Add\"",
        time: nowTime(),
      }]);
      setShowBanner(false);
    }
  }

  function handleDismiss() {
    setShowBanner(false);
    localStorage.setItem("apela-install-dismissed", "1");
  }

  // Load messages
  useEffect(() => {
    fetch("/api/messages")
      .then(r => r.json())
      .then((data: { id:string; role:string; content:string; created_at:string }[]) => {
        if (!Array.isArray(data)) return;
        if (data.length === 0) {
          setMessages([{ id:"greeting", role:"assistant", content:"Hello, I'm Apela — your personal digital secretary.\n\nI track your habits, log your activities, and report your patterns. What can I do for you?", time:nowTime() }]);
        } else {
          setMessages(data.map(m => ({ id:m.id, role:m.role as "user"|"assistant", content:m.content, time:msgTime(m.created_at) })));
        }
        setBooted(true);
      })
      .catch(() => {
        setMessages([{ id:"greeting", role:"assistant", content:"Hello, I'm Apela — your personal digital secretary.\n\nI track your habits, log your activities, and report your patterns. What can I do for you?", time:nowTime() }]);
        setBooted(true);
      });
  }, []);

  useEffect(() => {
    if (booted) bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages, loading, booted]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setMessages(prev => [...prev, { id:`u-${Date.now()}`, role:"user", content:text.trim(), time:nowTime() }]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "44px";
    setLoading(true);
    try {
      const res  = await fetch("/api/chat", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ message:text.trim() }) });
      const data = await res.json() as { reply:string };
      setMessages(prev => [...prev, { id:`a-${Date.now()}`, role:"assistant", content:data.reply, time:nowTime() }]);
    } catch {
      setMessages(prev => [...prev, { id:`err-${Date.now()}`, role:"assistant", content:"Connection error. Please try again.", time:nowTime() }]);
    }
    setLoading(false);
  }

  return (
    <>
      <Head><title>Apela</title></Head>
      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:none} }
        .msg-in { animation: fadeIn 0.18s ease both; }
        .banner-in { animation: slideDown 0.25s ease both; }
      `}</style>

      <div style={{ display:"flex", flexDirection:"column", height:"100dvh", background:"#0b141a", maxWidth:480, margin:"0 auto" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px", background:"#1f2c34", borderBottom:"1px solid #2a3942", flexShrink:0, zIndex:10 }}>
          <img src="/icons/icon-192x192.png" alt="Apela" style={{ width:40, height:40, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
          <div style={{ flex:1 }}>
            <p style={{ fontWeight:600, fontSize:15, color:"#e9edef" }}>Apela</p>
            <p style={{ fontSize:12, color:"#8696a0" }}>Personal digital secretary</p>
          </div>
          <Link href="/dashboard" style={{ fontSize:12, color:"#8696a0", padding:"5px 10px", borderRadius:6, border:"1px solid #2a3942" }}>
            Dashboard
          </Link>
        </div>

        {/* Install Banner */}
        {showBanner && !isInstalled && (
          <InstallBanner onInstall={handleInstall} onDismiss={handleDismiss} />
        )}

        {/* Messages */}
        <div style={{ flex:1, overflowY:"auto", padding:"12px 8px", display:"flex", flexDirection:"column", gap:2, backgroundImage:`url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23182229' fill-opacity='0.6'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C%2Fg%3E%3C%2Fsvg%3E")` }}>
          {messages.map((msg, i) => {
            const isUser = msg.role === "user";
            return (
              <div key={msg.id} className="msg-in" style={{ display:"flex", justifyContent:isUser?"flex-end":"flex-start", marginTop:i>0&&messages[i-1].role===msg.role?1:6, paddingLeft:isUser?48:0, paddingRight:isUser?0:48 }}>
                <div style={{ background:isUser?"#005c4b":"#1f2c34", borderRadius:isUser?"10px 10px 0 10px":"0 10px 10px 10px", padding:"7px 12px 6px", maxWidth:"100%" }}>
                  <p style={{ fontSize:14, color:"#e9edef", lineHeight:1.55, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{msg.content}</p>
                  <p style={{ fontSize:11, color:"#8696a0", textAlign:"right", marginTop:3, fontFamily:"'JetBrains Mono',monospace" }}>
                    {msg.time}{isUser && <span style={{ marginLeft:4, color:"#53bdeb" }}>✓✓</span>}
                  </p>
                </div>
              </div>
            );
          })}
          {loading && <div style={{ paddingLeft:8, marginTop:4 }} className="msg-in"><TypingBubble /></div>}
          <div ref={bottomRef} style={{ height:4 }} />
        </div>

        {/* Input */}
        <div style={{ display:"flex", alignItems:"flex-end", gap:8, padding:"8px 12px", background:"#1f2c34", borderTop:"1px solid #2a3942", flexShrink:0 }}>
          <textarea
            ref={inputRef} value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height="44px"; e.target.style.height=Math.min(e.target.scrollHeight,120)+"px"; }}
            onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send(input);} }}
            placeholder="Message" rows={1} disabled={loading}
            style={{ flex:1, background:"#2a3942", border:"none", borderRadius:22, color:"#e9edef", padding:"12px 16px", fontSize:15, outline:"none", resize:"none", lineHeight:1.4, height:44, maxHeight:120, overflowY:"hidden" }}
          />
          <button onClick={() => send(input)} disabled={!input.trim()||loading}
            style={{ width:44, height:44, borderRadius:"50%", background:input.trim()&&!loading?"#00a884":"#2a3942", border:"none", color:"#fff", fontSize:20, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s", cursor:input.trim()&&!loading?"pointer":"default" }}>
            ➤
          </button>
        </div>
      </div>
    </>
  );
}
