import { useState, useEffect, useCallback } from "react";
import { X, Eye, EyeOff, CheckCircle, AlertCircle, Loader } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface KeyValidation {
  valid: boolean;
  error?: string;
}

interface SaveResult {
  saved: boolean;
  groq: KeyValidation;
  tavily: KeyValidation;
}

const LS_GROQ = "echelon_groq_key";
const LS_TAVILY = "echelon_tavily_key";

export function hasStoredKeys(): boolean {
  try {
    return !!(localStorage.getItem(LS_GROQ) && localStorage.getItem(LS_TAVILY));
  } catch { return false; }
}

export async function syncKeysToServer(): Promise<void> {
  const groqApiKey = localStorage.getItem(LS_GROQ) ?? "";
  const tavilyApiKey = localStorage.getItem(LS_TAVILY) ?? "";
  if (!groqApiKey && !tavilyApiKey) return;
  try {
    await fetch("/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groqApiKey, tavilyApiKey }),
    });
  } catch { /* silent on startup sync */ }
}

type Status = "idle" | "saving" | "done";

export default function SettingsOverlay({ open, onClose, onSaved }: Props) {
  const [groqKey, setGroqKey]       = useState("");
  const [tavilyKey, setTavilyKey]   = useState("");
  const [showGroq, setShowGroq]     = useState(false);
  const [showTavily, setShowTavily] = useState(false);
  const [status, setStatus]         = useState<Status>("idle");
  const [result, setResult]         = useState<SaveResult | null>(null);

  // Load from localStorage when overlay opens
  useEffect(() => {
    if (!open) return;
    setGroqKey(localStorage.getItem(LS_GROQ) ?? "");
    setTavilyKey(localStorage.getItem(LS_TAVILY) ?? "");
    setStatus("idle");
    setResult(null);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleSave = useCallback(async () => {
    if (status === "saving") return;
    setStatus("saving");
    setResult(null);

    try {
      const res = await fetch("/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groqApiKey: groqKey.trim(), tavilyApiKey: tavilyKey.trim() }),
      });
      const data = (await res.json()) as SaveResult;

      if (groqKey.trim()) localStorage.setItem(LS_GROQ, groqKey.trim());
      if (tavilyKey.trim()) localStorage.setItem(LS_TAVILY, tavilyKey.trim());

      setResult(data);
      setStatus("done");
      if (data.groq.valid && data.tavily.valid) onSaved();
    } catch (err) {
      setResult({
        saved: false,
        groq: { valid: false, error: err instanceof Error ? err.message : "Network error" },
        tavily: { valid: false, error: "Could not reach server" },
      });
      setStatus("done");
    }
  }, [groqKey, tavilyKey, status, onSaved]);

  if (!open) return null;

  const inputStyle: React.CSSProperties = {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    fontFamily: "'DM Mono', monospace",
    fontSize: 13,
    padding: "11px 40px 11px 12px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    letterSpacing: "0.03em",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    letterSpacing: "0.2em",
    color: "var(--text-muted)",
    textTransform: "uppercase",
    display: "block",
    marginBottom: 6,
  };

  const descStyle: React.CSSProperties = {
    fontSize: 10,
    color: "var(--text-muted)",
    letterSpacing: "0.04em",
    marginTop: 6,
    lineHeight: 1.5,
  };

  function ValidationBadge({ v }: { v?: KeyValidation }) {
    if (!v) return null;
    if (v.valid) return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11, color: "#3ddc84" }}>
        <CheckCircle size={12} /> Valid
      </div>
    );
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 8, fontSize: 11, color: "#ff4c4c" }}>
        <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>{v.error ?? "Invalid key"}</span>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)",
          backdropFilter: "blur(4px)", zIndex: 500,
        }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 501,
        width: "min(480px, calc(100vw - 40px))",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ fontSize: 9, letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--accent)" }}>
            Settings
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, display: "flex" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Groq */}
          <div>
            <label style={labelStyle}>Groq API Key</label>
            <div style={{ position: "relative" }}>
              <input
                style={inputStyle}
                type={showGroq ? "text" : "password"}
                value={groqKey}
                onChange={e => { setGroqKey(e.target.value); setStatus("idle"); setResult(null); }}
                placeholder="gsk_..."
                spellCheck={false}
                autoComplete="off"
                onFocus={e => { e.currentTarget.style.borderColor = "var(--accent-dim)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
              />
              <button
                type="button"
                onClick={() => setShowGroq(v => !v)}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0,
                }}
              >
                {showGroq ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p style={descStyle}>Used for Echelon Synthesis — the LLM analysis layer. Get a free key from Groq Cloud.</p>
            {status === "done" && <ValidationBadge v={result?.groq} />}
          </div>

          {/* Tavily */}
          <div>
            <label style={labelStyle}>Tavily API Key</label>
            <div style={{ position: "relative" }}>
              <input
                style={inputStyle}
                type={showTavily ? "text" : "password"}
                value={tavilyKey}
                onChange={e => { setTavilyKey(e.target.value); setStatus("idle"); setResult(null); }}
                placeholder="tvly-..."
                spellCheck={false}
                autoComplete="off"
                onFocus={e => { e.currentTarget.style.borderColor = "var(--accent-dim)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
              />
              <button
                type="button"
                onClick={() => setShowTavily(v => !v)}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0,
                }}
              >
                {showTavily ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p style={descStyle}>Used for cultural signal search via Tavily API. Key format: <span style={{ color: "var(--text)" }}>tvly-...</span></p>
            {status === "done" && <ValidationBadge v={result?.tavily} />}
          </div>

          {/* Note */}
          <p style={{ ...descStyle, borderLeft: "2px solid var(--border)", paddingLeft: 10, color: "#555" }}>
            Keys are saved to your local <code style={{ color: "var(--text-muted)" }}>.env</code> file and persisted in browser storage. Never shared externally.
          </p>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 20px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {status === "saving" && (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Loader size={11} style={{ animation: "spin 1s linear infinite" }} /> Validating...
              </span>
            )}
            {status === "done" && result?.saved && result.groq.valid && result.tavily.valid && (
              <span style={{ color: "#3ddc84" }}>Saved and validated</span>
            )}
            {status === "done" && result?.saved && (!result.groq.valid || !result.tavily.valid) && (
              <span style={{ color: "#fca5a5" }}>Saved — check errors above</span>
            )}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                background: "transparent", border: "1px solid var(--border)",
                color: "var(--text-muted)", fontFamily: "'DM Mono', monospace",
                fontSize: 11, letterSpacing: "0.1em", padding: "8px 16px", cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={status === "saving" || (!groqKey.trim() && !tavilyKey.trim())}
              style={{
                background: status === "saving" || (!groqKey.trim() && !tavilyKey.trim())
                  ? "var(--border)" : "var(--accent)",
                border: "none",
                color: status === "saving" || (!groqKey.trim() && !tavilyKey.trim()) ? "var(--text-muted)" : "#000",
                fontFamily: "'DM Mono', monospace",
                fontSize: 11, fontWeight: 500,
                letterSpacing: "0.12em", textTransform: "uppercase",
                padding: "8px 20px", cursor: status === "saving" ? "wait" : "pointer",
                transition: "all 0.15s",
              }}
            >
              {status === "saving" ? "Saving..." : "Save & Test"}
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
