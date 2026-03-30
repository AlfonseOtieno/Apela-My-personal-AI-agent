import { useState, useEffect, useRef, FormEvent } from "react";
import Head from "next/head";
import Link from "next/link";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
};

// Format timestamp like WhatsApp
function msgTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Typing indicator — three bouncing dots
function TypingBubble() {
  return (
    <div style={{ display: "flex", gap: 6, padding: "10px 14px", background: "#1f2c34", borderRadius: "0 10px 10px 10px", width: "fit-content", marginLeft: 8 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 8, height: 8, borderRadius: "50%",
          background: "#8696a0",
          display: "block",
          animation: "bounce 1.2s ease infinite",
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages]   = useState<Msg[]>([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [booted, setBooted]       = useState(false);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLTextAreaElement>(null);

  // Load history on mount
  useEffect(() => {
    fetch("/api/messages")
      .then(r => r.json())
      .then((data: { id: string; role: string; content: string; created_at: string }[]) => {
        if (!Array.isArray(data)) return;
        if (data.length === 0) {
          // First ever open — show greeting
          setMessages([{
            id: "greeting",
            role: "assistant",
            content: "Hello, I'm Apela — your personal digital secretary.\n\nI track your habits, log your activities, and report your patterns. What can I do for you?",
            time: nowTime(),
          }]);
        } else {
          setMessages(data.map(m => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            time: msgTime(m.created_at),
          })));
        }
        setBooted(true);
      })
      .catch(() => {
        setMessages([{
          id: "greeting",
          role: "assistant",
          content: "Hello, I'm Apela — your personal digital secretary.\n\nI track your habits, log your activities, and report your patterns. What can I do for you?",
          time: nowTime(),
        }]);
        setBooted(true);
      });
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    if (booted) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, booted]);

  async function send(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: text.trim(), time: nowTime() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "44px";
    }
    setLoading(true);

    try {
      const res  = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim() }),
      });
      const data = await res.json() as { reply: string };
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        time: nowTime(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "Connection error. Please try again.",
        time: nowTime(),
      }]);
    }

    setLoading(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <>
      <Head><title>Apela</title></Head>
      <style>{`
        @keyframes bounce {
          0%,60%,100% { transform: translateY(0); }
          30%          { transform: translateY(-5px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: none; }
        }
        .msg-in { animation: fadeIn 0.18s ease both; }
      `}</style>

      <div style={{
        display: "flex", flexDirection: "column", height: "100dvh",
        background: "#0b141a",        /* WhatsApp dark background */
        maxWidth: 480, margin: "0 auto",
        position: "relative",
      }}>

        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 16px",
          background: "#1f2c34",
          borderBottom: "1px solid #2a3942",
          flexShrink: 0,
          zIndex: 10,
        }}>
          {/* Avatar */}
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "#00a884",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 18, color: "#fff", flexShrink: 0,
          }}>A</div>

          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 600, fontSize: 15, color: "#e9edef" }}>Apela</p>
            <p style={{ fontSize: 12, color: "#8696a0" }}>Personal digital secretary</p>
          </div>

          {/* Link to dashboard — only in browser, hidden in PWA */}
          <Link href="/dashboard" style={{
            fontSize: 12, color: "#8696a0",
            padding: "5px 10px",
            borderRadius: 6,
            border: "1px solid #2a3942",
          }}>
            Dashboard
          </Link>
        </div>

        {/* ── Messages ── */}
        <div style={{
          flex: 1, overflowY: "auto",
          padding: "12px 8px",
          display: "flex", flexDirection: "column", gap: 2,
          /* WhatsApp background pattern */
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23182229' fill-opacity='0.6'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}>
          {messages.map((msg, i) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className="msg-in"
                style={{
                  display: "flex",
                  justifyContent: isUser ? "flex-end" : "flex-start",
                  marginTop: i > 0 && messages[i - 1].role === msg.role ? 1 : 6,
                  paddingLeft: isUser ? 48 : 0,
                  paddingRight: isUser ? 0 : 48,
                }}
              >
                <div style={{
                  background: isUser ? "#005c4b" : "#1f2c34",
                  borderRadius: isUser
                    ? "10px 10px 0 10px"
                    : "0 10px 10px 10px",
                  padding: "7px 12px 6px",
                  maxWidth: "100%",
                  position: "relative",
                }}>
                  <p style={{
                    fontSize: 14,
                    color: "#e9edef",
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}>
                    {msg.content}
                  </p>
                  <p style={{
                    fontSize: 11,
                    color: "#8696a0",
                    textAlign: "right",
                    marginTop: 3,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {msg.time}
                    {isUser && (
                      <span style={{ marginLeft: 4, color: "#53bdeb" }}>✓✓</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {loading && (
            <div style={{ paddingLeft: 8, marginTop: 4 }} className="msg-in">
              <TypingBubble />
            </div>
          )}

          <div ref={bottomRef} style={{ height: 4 }} />
        </div>

        {/* ── Input bar ── */}
        <div style={{
          display: "flex", alignItems: "flex-end", gap: 8,
          padding: "8px 12px",
          background: "#1f2c34",
          borderTop: "1px solid #2a3942",
          flexShrink: 0,
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = "44px";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder="Message"
            rows={1}
            disabled={loading}
            style={{
              flex: 1,
              background: "#2a3942",
              border: "none",
              borderRadius: 22,
              color: "#e9edef",
              padding: "12px 16px",
              fontSize: 15,
              outline: "none",
              resize: "none",
              lineHeight: 1.4,
              height: 44,
              maxHeight: 120,
              overflowY: "hidden",
            }}
          />

          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            style={{
              width: 44, height: 44,
              borderRadius: "50%",
              background: input.trim() && !loading ? "#00a884" : "#2a3942",
              border: "none",
              color: "#fff",
              fontSize: 20,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              transition: "background 0.15s",
              cursor: input.trim() && !loading ? "pointer" : "default",
            }}
          >
            ➤
          </button>
        </div>
      </div>
    </>
  );
}
