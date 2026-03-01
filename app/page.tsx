"use client";
import { useState, useCallback } from "react";

const phrases = [
  { ti: "ሰላም", en: "Peace" },
  { ti: "ኣበይ ኣለኻ?", en: "Where are you?" },
  { ti: "የቐንየለይ", en: "Thank you" },
  { ti: "ከመይ ኣለኻ?", en: "How are you?" },
  { ti: "ብጣዕሚ ጽቡቕ", en: "Very good" },
];

export default function Home() {
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [direction, setDirection] = useState<"en-ti" | "ti-en">("en-ti");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [charCount, setCharCount] = useState(0);

  const translate = useCallback(async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setError("");
    setOutputText("");

    const from = direction === "en-ti" ? "en" : "ti";
    const to = direction === "en-ti" ? "ti" : "en";

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, from, to }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setOutputText(data.translation);
    } catch (e: any) {
      setError(e.message || "Translation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [inputText, direction]);

  const swapLanguages = () => {
    setDirection((d) => (d === "en-ti" ? "ti-en" : "en-ti"));
    setInputText(outputText);
    setOutputText(inputText);
    setCharCount(outputText.length);
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    setCharCount(e.target.value.length);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(outputText);
  };

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0f", fontFamily: "'Georgia', serif", color: "#f0ebe0" }}>
      {/* Background pattern */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: `radial-gradient(circle at 20% 20%, rgba(196,142,72,0.08) 0%, transparent 50%),
                          radial-gradient(circle at 80% 80%, rgba(139,90,43,0.08) 0%, transparent 50%)`,
        pointerEvents: "none"
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 960, margin: "0 auto", padding: "0 24px 60px" }}>

        {/* Header */}
        <header style={{ textAlign: "center", padding: "60px 0 48px" }}>
          <div style={{ fontSize: 13, letterSpacing: "0.3em", color: "#c48e48", textTransform: "uppercase", marginBottom: 16 }}>
            ቋንቋ ትግርኛ
          </div>
          <h1 style={{
            fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 400,
            background: "linear-gradient(135deg, #f0ebe0 0%, #c48e48 50%, #f0ebe0 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            margin: 0, lineHeight: 1.1, letterSpacing: "-0.02em"
          }}>
            Tigrinya Bridge
          </h1>
          <p style={{ color: "#8a7a6a", marginTop: 16, fontSize: 16, fontStyle: "italic" }}>
            Connecting languages, preserving culture
          </p>
        </header>

        {/* Daily phrases strip */}
        <div style={{
          display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, marginBottom: 40,
          scrollbarWidth: "none"
        }}>
          {phrases.map((p, i) => (
            <button key={i} onClick={() => { setInputText(p.ti); setCharCount(p.ti.length); setDirection("ti-en"); }}
              style={{
                flexShrink: 0, padding: "8px 16px", borderRadius: 20,
                border: "1px solid rgba(196,142,72,0.3)", background: "rgba(196,142,72,0.06)",
                color: "#c48e48", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
                transition: "all 0.2s"
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(196,142,72,0.15)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(196,142,72,0.06)")}
            >
              {p.ti} · {p.en}
            </button>
          ))}
        </div>

        {/* Language toggle bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 16, marginBottom: 24
        }}>
          <div style={{
            padding: "10px 28px", borderRadius: 8,
            background: direction === "en-ti" ? "rgba(196,142,72,0.2)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${direction === "en-ti" ? "rgba(196,142,72,0.5)" : "rgba(255,255,255,0.1)"}`,
            fontWeight: 600, fontSize: 14, letterSpacing: "0.05em"
          }}>
            {direction === "en-ti" ? "ENGLISH" : "TIGRINYA"}
          </div>

          <button onClick={swapLanguages} style={{
            width: 40, height: 40, borderRadius: "50%", border: "1px solid rgba(196,142,72,0.4)",
            background: "rgba(196,142,72,0.1)", cursor: "pointer", fontSize: 18,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.3s", color: "#c48e48"
          }}
            onMouseEnter={e => (e.currentTarget.style.transform = "rotate(180deg)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "rotate(0deg)")}
          >⇄</button>

          <div style={{
            padding: "10px 28px", borderRadius: 8,
            background: direction === "ti-en" ? "rgba(196,142,72,0.2)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${direction === "ti-en" ? "rgba(196,142,72,0.5)" : "rgba(255,255,255,0.1)"}`,
            fontWeight: 600, fontSize: 14, letterSpacing: "0.05em"
          }}>
            {direction === "en-ti" ? "TIGRINYA" : "ENGLISH"}
          </div>
        </div>

        {/* Translation panels */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Input panel */}
          <div style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16, overflow: "hidden"
          }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "#8a7a6a", letterSpacing: "0.15em", textTransform: "uppercase" }}>
              {direction === "en-ti" ? "English" : "ትግርኛ"} · Source
            </div>
            <textarea
              value={inputText}
              onChange={handleInput}
              placeholder={direction === "en-ti" ? "Type or paste your text here..." : "ትግርኛ ጽሑፍካ ኣብዚ ጸሓፍ..."}
              style={{
                width: "100%", minHeight: 240, padding: 20, background: "transparent",
                border: "none", outline: "none", color: "#f0ebe0", fontSize: 16,
                lineHeight: 1.7, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box"
              }}
            />
            <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#8a7a6a" }}>{charCount} characters</span>
              <button onClick={() => { setInputText(""); setOutputText(""); setCharCount(0); }}
                style={{ fontSize: 12, color: "#8a7a6a", background: "none", border: "none", cursor: "pointer" }}>
                Clear
              </button>
            </div>
          </div>

          {/* Output panel */}
          <div style={{
            background: "rgba(196,142,72,0.04)", border: "1px solid rgba(196,142,72,0.15)",
            borderRadius: 16, overflow: "hidden", position: "relative"
          }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(196,142,72,0.1)", fontSize: 12, color: "#c48e48", letterSpacing: "0.15em", textTransform: "uppercase" }}>
              {direction === "en-ti" ? "ትግርኛ" : "English"} · Translation
            </div>
            <div style={{ padding: 20, minHeight: 240, fontSize: 16, lineHeight: 1.7, color: outputText ? "#f0ebe0" : "#4a3a2a" }}>
              {loading ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#c48e48" }}>
                  <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>◌</span>
                  Translating...
                </div>
              ) : error ? (
                <span style={{ color: "#e07070" }}>{error}</span>
              ) : outputText || "Translation will appear here..."}
            </div>
            {outputText && (
              <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(196,142,72,0.1)", display: "flex", gap: 12 }}>
                <button onClick={copyToClipboard}
                  style={{ fontSize: 12, color: "#c48e48", background: "none", border: "1px solid rgba(196,142,72,0.3)", borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}>
                  Copy
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Translate button */}
        <div style={{ textAlign: "center", marginTop: 28 }}>
          <button onClick={translate} disabled={loading || !inputText.trim()}
            style={{
              padding: "16px 56px", borderRadius: 50,
              background: loading || !inputText.trim() ? "rgba(196,142,72,0.2)" : "linear-gradient(135deg, #c48e48, #8b5a2b)",
              border: "none", color: "#f0ebe0", fontSize: 16, fontWeight: 600,
              letterSpacing: "0.08em", cursor: loading || !inputText.trim() ? "not-allowed" : "pointer",
              transition: "all 0.3s", fontFamily: "inherit"
            }}
            onMouseEnter={e => { if (!loading && inputText.trim()) e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
          >
            {loading ? "Translating..." : "Translate →"}
          </button>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 80, color: "#4a3a2a", fontSize: 13 }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>🇪🇷 🇪🇹</div>
          Built with love for the Tigrinya community
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
        @media (max-width: 640px) {
          div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}
