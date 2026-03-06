"use client";
import { useState, useCallback, type ChangeEvent } from "react";

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
  const [googleTranslation, setGoogleTranslation] = useState("");
  const [azureTranslation, setAzureTranslation] = useState("");
  const [selectedSource, setSelectedSource] = useState<"best" | "google" | "azure">("best");
  const [translationId, setTranslationId] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"text" | "file">("text");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileTranslation, setFileTranslation] = useState("");
  const [fileOriginalText, setFileOriginalText] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [fileCopied, setFileCopied] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [fileSelectedSource, setFileSelectedSource] = useState<"best" | "google" | "azure">("best");
  const [fileGoogleTranslation, setFileGoogleTranslation] = useState("");
  const [fileAzureTranslation, setFileAzureTranslation] = useState("");
  const [limitReached, setLimitReached] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

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

    if (data.limitReached) {
      setLimitReached(true);
      throw new Error(data.error);
    }

    if (data.error) throw new Error(data.error);
      setOutputText(data.translation);
      setGoogleTranslation(data.googleTranslation || "");
      setAzureTranslation(data.azureTranslation || "");
      setTranslationId(data.translationId || "");
      setRemaining(data.remaining);
      setSelectedSource("best");
    } catch (e: any) {
      setError(e.message || "Translation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [inputText, direction]);

  const swapLanguages = () => {
    setDirection((d) => (d === "en-ti" ? "ti-en" : "en-ti"));
    // Only swap text content on the text tab
    if (activeTab === "text") {
      setInputText(outputText);
      setOutputText(inputText);
      setCharCount(outputText.length);
      setGoogleTranslation("");
      setAzureTranslation("");
    }
    // On file tab, just flip direction — user will re-upload
    if (activeTab === "file") {
      setFileTranslation("");
      setFileError("");
    }
  };

  const getDisplayedTranslation = () => {
    if (selectedSource === "google") return googleTranslation;
    if (selectedSource === "azure") return azureTranslation;
    return outputText;
  };

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    setCharCount(e.target.value.length);
  };

  const getDisplayedFileTranslation = () => {
    if (fileSelectedSource === "google") return fileGoogleTranslation;
    if (fileSelectedSource === "azure") return fileAzureTranslation;
    return fileTranslation;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getDisplayedTranslation());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const translateFile = async () => {
    if (!uploadedFile) return;
    setFileLoading(true);
    setFileError("");
    setFileTranslation("");
    setFileGoogleTranslation("");
    setFileAzureTranslation("");

    const from = direction === "en-ti" ? "en" : "ti";
    const to = direction === "en-ti" ? "ti" : "en";

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("from", from);
      formData.append("to", to);

      const res = await fetch("/api/translate-file", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.limitReached) {
        setLimitReached(true);
        throw new Error(data.error);
      }
      if (data.error) throw new Error(data.error);
      const cleaned = data.translation
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      setFileTranslation(cleaned);
      setFileGoogleTranslation(data.googleTranslation || "");
      setFileAzureTranslation(data.azureTranslation || "");
      setFileOriginalText(data.originalText);
      setPageCount(data.pageCount);
      setFileSelectedSource("best");

    } catch (e: any) {
      setFileError(e.message || "File translation failed. Please try again.");
    } finally {
      setFileLoading(false);
    }
  };

  const downloadTranslation = () => {
    const blob = new Blob([fileTranslation], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${uploadedFile?.name.replace(".pdf", "")}_translated.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyFileTranslation = () => {
    navigator.clipboard.writeText(getDisplayedFileTranslation());
    setFileCopied(true);
    setTimeout(() => setFileCopied(false), 2000);
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
            Haylwa
          </h1>
          <p style={{ color: "#8a7a6a", marginTop: 16, fontSize: 16, fontStyle: "italic" }}>
            Language without barriers
          </p>
        </header>

        {/* Tab switcher */}
        <div style={{ display: "flex", gap: 8, marginBottom: 32, justifyContent: "center" }}>
          {(["text", "file"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                padding: "10px 32px", borderRadius: 50, fontSize: 14, fontWeight: 600,
                cursor: "pointer", transition: "all 0.2s", fontFamily: "inherit",
                background: activeTab === tab ? "linear-gradient(135deg, #c48e48, #8b5a2b)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${activeTab === tab ? "transparent" : "rgba(255,255,255,0.1)"}`,
                color: activeTab === tab ? "#f0ebe0" : "#8a7a6a",
              }}
            >
              {tab === "text" ? "✍️ Text" : "📁 File"}
            </button>
          ))}
        </div>

        {/* Daily phrases strip — text tab only */}
        {activeTab === "text" && (
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
        )}

        {/* Language toggle — shared across both tabs */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 24 }}>
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

        {/* ── TEXT TAB ── */}
        {activeTab === "text" && (
          <>
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
                    width: "100%",
                    minHeight: 440,
                    maxHeight: 800,  
                    padding: 20,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "#f0ebe0",
                    fontSize: 16,
                    lineHeight: 1.7,
                    resize: "both", 
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    overflowY: "auto",
                    scrollbarWidth: "thin",
                    scrollbarColor: "#c48e48 transparent",
                  }}
                />
                <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#8a7a6a" }}>{charCount} characters</span>
                  <button onClick={() => { setInputText(""); setOutputText(""); setCharCount(0); setGoogleTranslation(""); setAzureTranslation(""); setLimitReached(false); setRemaining(null); }}
                    style={{ fontSize: 12, color: "#8a7a6a", background: "none", border: "none", cursor: "pointer" }}>
                    Clear
                  </button>
                </div>
              </div>

              {/* Output panel */}
              <div className="output-panel" style={{
                background: "rgba(196,142,72,0.04)", border: "1px solid rgba(196,142,72,0.15)",
                borderRadius: 16, overflow: "hidden", position: "relative"
              }}>
                <div style={{
                  padding: "14px 20px", borderBottom: "1px solid rgba(196,142,72,0.1)",
                  fontSize: 12, color: "#c48e48", letterSpacing: "0.15em", textTransform: "uppercase",
                  display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                  <span>{direction === "en-ti" ? "ትግርኛ" : "English"} · Translation</span>
                  {outputText && (
                    <select
                      value={selectedSource}
                      onChange={e => setSelectedSource(e.target.value as "best" | "google" | "azure")}
                      style={{
                        background: "rgba(196,142,72,0.1)",
                        border: "1px solid rgba(196,142,72,0.3)",
                        borderRadius: 6, color: "#c48e48", fontSize: 11,
                        padding: "4px 8px", cursor: "pointer", outline: "none",
                        letterSpacing: "0.05em",
                      }}
                    >
                      <option value="best">🥇 Haylwa Enhanced</option>
                      <option value="google">🥈 Standard</option>
                      <option value="azure">🥉 Classic</option>
                    </select>
                  )}
                </div>

                <div style={{
                  padding: 20,
                  minHeight: 440,
                  maxHeight: 800,  // ← match input
                  fontSize: 16,
                  lineHeight: 1.7,
                  color: getDisplayedTranslation() ? "#f0ebe0" : "#4a3a2a",
                  overflowY: "auto",
                  scrollbarWidth: "thin",
                  scrollbarColor: "#c48e48 transparent",
                  whiteSpace: "pre-wrap",
                }}>
                  {loading ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#c48e48" }}>
                      <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>◌</span>
                      Translating...
                    </div>
                  ) : error ? (
                    <span style={{ color: "#e07070" }}>{error}</span>
                  ) : getDisplayedTranslation() || "Translation will appear here..."}
                </div>

                {outputText && (
                  <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(196,142,72,0.1)", display: "flex", gap: 12 }}>
                    <button onClick={copyToClipboard} style={{
                      fontSize: 12,
                      color: copied ? "#4ade80" : "#c48e48",
                      background: copied ? "rgba(74,222,128,0.1)" : "none",
                      border: `1px solid ${copied ? "rgba(74,222,128,0.5)" : "rgba(196,142,72,0.3)"}`,
                      borderRadius: 6, padding: "4px 12px", cursor: "pointer",
                      transition: "all 0.3s", fontWeight: copied ? 600 : 400,
                    }}>
                      {copied ? "✓ Copied!" : "Copy"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Rate limit warning */}
{remaining !== null && remaining <= 3 && !limitReached && (
  <div style={{
    textAlign: "center", marginTop: 16,
    padding: "10px 20px", borderRadius: 8,
    background: "rgba(196,142,72,0.1)",
    border: "1px solid rgba(196,142,72,0.3)",
    color: "#c48e48", fontSize: 13,
  }}>
    ⚠️ {remaining} free translations remaining today.{" "}
    <span style={{ textDecoration: "underline", cursor: "pointer" }}>
      Upgrade for unlimited access
    </span>
  </div>
)}

{/* Limit reached */}
{limitReached && (
  <div style={{
    textAlign: "center", marginTop: 16,
    padding: "16px 20px", borderRadius: 8,
    background: "rgba(224,112,112,0.1)",
    border: "1px solid rgba(224,112,112,0.3)",
    color: "#e07070", fontSize: 14,
  }}>
    🚫 Daily limit reached. Upgrade to continue translating.{" "}
    <button style={{
      marginLeft: 8, padding: "4px 12px", borderRadius: 6,
      background: "linear-gradient(135deg, #c48e48, #8b5a2b)",
      border: "none", color: "#f0ebe0", fontSize: 13,
      cursor: "pointer", fontFamily: "inherit",
    }}>
      View Plans →
    </button>
  </div>
)}

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

            <div style={{
              padding: "12px 20px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{
                  fontSize: 12, color:
                    charCount > 10000 ? "#e07070" :
                      charCount > 5000 ? "#f0a050" : "#8a7a6a"
                }}>
                  {charCount} characters
                  {charCount > 10000 && " — Text is too long. Please use the file upload option ...."}
                  {charCount > 5000 && charCount <= 10000 && " — Long text, consider File Upload"}
                </span>
              </div>
              <button onClick={() => { setInputText(""); setOutputText(""); setCharCount(0); setGoogleTranslation(""); setAzureTranslation(""); }}
                style={{ fontSize: 12, color: "#8a7a6a", background: "none", border: "none", cursor: "pointer" }}>
                Clear
              </button>
            </div>
          </>
        )}

        {/* ── FILE TAB ── */}
        {activeTab === "file" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Upload area */}
            <div
              onClick={() => document.getElementById("fileInput")?.click()}
              style={{
                border: `2px dashed ${uploadedFile ? "rgba(196,142,72,0.6)" : "rgba(255,255,255,0.15)"}`,
                borderRadius: 16, padding: "48px 24px", textAlign: "center",
                cursor: "pointer", transition: "all 0.3s",
                background: uploadedFile ? "rgba(196,142,72,0.06)" : "rgba(255,255,255,0.02)",
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(196,142,72,0.5)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = uploadedFile ? "rgba(196,142,72,0.6)" : "rgba(255,255,255,0.15)")}
            >
              <input
                id="fileInput"
                type="file"
                accept=".pdf"
                style={{ display: "none" }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) { setUploadedFile(file); setFileTranslation(""); setFileError(""); }
                }}
              />
              <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
              {uploadedFile ? (
                <>
                  <div style={{ color: "#c48e48", fontWeight: 600, marginBottom: 4 }}>{uploadedFile.name}</div>
                  <div style={{ color: "#8a7a6a", fontSize: 13 }}>
                    {(uploadedFile.size / 1024).toFixed(1)} KB · Click to change file
                  </div>
                </>
              ) : (
                <>
                  <div style={{ color: "#f0ebe0", marginBottom: 8, fontWeight: 500 }}>Drop your PDF here or click to browse</div>
                  <div style={{ color: "#8a7a6a", fontSize: 13 }}>Supports PDF files up to 10MB</div>
                </>
              )}
            </div>

            {/* Translate file button */}
            <div style={{ textAlign: "center" }}>
              <button onClick={translateFile} disabled={fileLoading || !uploadedFile}
                style={{
                  padding: "16px 56px", borderRadius: 50,
                  background: fileLoading || !uploadedFile ? "rgba(196,142,72,0.2)" : "linear-gradient(135deg, #c48e48, #8b5a2b)",
                  border: "none", color: "#f0ebe0", fontSize: 16, fontWeight: 600,
                  letterSpacing: "0.08em", cursor: fileLoading || !uploadedFile ? "not-allowed" : "pointer",
                  transition: "all 0.3s", fontFamily: "inherit"
                }}
                onMouseEnter={e => { if (!fileLoading && uploadedFile) e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {fileLoading ? "Translating..." : "Translate PDF →"}
              </button>
            </div>

            {/* File error */}
            {fileError && (
              <div style={{ color: "#e07070", textAlign: "center", fontSize: 14 }}>{fileError}</div>
            )}

            {/* File translation output */}
            {getDisplayedFileTranslation() && (
              <div style={{
                background: "rgba(196,142,72,0.04)", border: "1px solid rgba(196,142,72,0.15)",
                borderRadius: 16, overflow: "hidden"
              }}>
                <div style={{
                  padding: "14px 20px", borderBottom: "1px solid rgba(196,142,72,0.1)",
                  fontSize: 12, color: "#c48e48", letterSpacing: "0.15em", textTransform: "uppercase",
                  display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                  <span>Translation · {pageCount} {pageCount === 1 ? "page" : "pages"}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <select
                      value={fileSelectedSource}
                      onChange={e => setFileSelectedSource(e.target.value as "best" | "google" | "azure")}
                      style={{
                        background: "rgba(196,142,72,0.1)",
                        border: "1px solid rgba(196,142,72,0.3)",
                        borderRadius: 6, color: "#c48e48", fontSize: 11,
                        padding: "4px 8px", cursor: "pointer", outline: "none",
                      }}
                    >
                      <option value="best">🥇 Haylwa Enhanced</option>
                      <option value="google">🥈 Standard</option>
                      <option value="azure">🥉 Classic</option>
                    </select>
                    <span style={{ color: "#8a7a6a", fontSize: 11 }}>{uploadedFile?.name}</span>
                  </div>
                </div>

                <div style={{
                  padding: 20, maxHeight: 400, overflowY: "scroll",
                  fontSize: 15, lineHeight: 1.8, color: "#f0ebe0", whiteSpace: "pre-wrap",
                  scrollbarWidth: "thin", scrollbarColor: "#c48e48 transparent",
                }}>
                  {getDisplayedFileTranslation()}
                </div>

                <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(196,142,72,0.1)", display: "flex", gap: 12 }}>
                  <button onClick={copyFileTranslation} style={{
                    fontSize: 12,
                    color: fileCopied ? "#4ade80" : "#c48e48",
                    background: fileCopied ? "rgba(74,222,128,0.1)" : "none",
                    border: `1px solid ${fileCopied ? "rgba(74,222,128,0.5)" : "rgba(196,142,72,0.3)"}`,
                    borderRadius: 6, padding: "4px 12px", cursor: "pointer",
                    transition: "all 0.3s", fontWeight: fileCopied ? 600 : 400,
                  }}>
                    {fileCopied ? "✓ Copied!" : "Copy"}
                  </button>
                  <button onClick={downloadTranslation} style={{
                    fontSize: 12, color: "#c48e48", background: "none",
                    border: "1px solid rgba(196,142,72,0.3)", borderRadius: 6,
                    padding: "4px 12px", cursor: "pointer", transition: "all 0.3s",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(196,142,72,0.1)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    Download .txt
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 80, color: "#4a3a2a", fontSize: 13 }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>🇪🇷 🇪🇹</div>
          Built with love for the Tigrinya community
        </div>

      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        textarea::-webkit-scrollbar { width: 4px; }
        textarea::-webkit-scrollbar-thumb { background: #c48e48; border-radius: 4px; }
        textarea::-webkit-scrollbar-track { background: transparent; }
        .output-panel::-webkit-scrollbar { width: 4px; }
        .output-panel::-webkit-scrollbar-thumb { background: #c48e48; border-radius: 4px; }
        .output-panel::-webkit-scrollbar-track { background: transparent; }
        @media (max-width: 640px) {
          div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
          .translation-panel { min-height: 200px !important; max-height: 400px !important; }
          
        }
      `}</style>
    </main>
  );
}
