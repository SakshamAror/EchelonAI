import { useState } from "react";
import { Settings } from "lucide-react";
import { createProfile } from "@/lib/portfolioApi";
import { saveAlpacaCreds, loadAlpacaCreds, syncAlpacaToProfile, type AlpacaCreds } from "@/lib/alpacaApi";

const labelStyle: React.CSSProperties = {
  fontSize: 9, letterSpacing: "0.2em", color: "var(--text-muted)", textTransform: "uppercase",
};
const inputStyle: React.CSSProperties = {
  border: "1px solid var(--border)", color: "var(--text)", background: "var(--surface-2)",
  fontFamily: "'DM Mono', monospace", fontSize: 13, padding: "10px 12px", outline: "none", width: "100%",
};
const btnStyle: React.CSSProperties = {
  background: "var(--accent)", border: "none", color: "#000", fontFamily: "'DM Mono', monospace",
  fontSize: 11, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase",
  padding: "10px 20px", cursor: "pointer",
};

// Create a new Alpaca-connected profile (used on the empty state)
export function AlpacaConnectForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [keyId, setKeyId] = useState("");
  const [secret, setSecret] = useState("");
  const [paper, setPaper] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function connect() {
    setErr(null);
    if (!name.trim()) { setErr("Name required."); return; }
    if (!keyId.trim() || !secret.trim()) { setErr("Enter your Alpaca key + secret."); return; }
    setBusy(true);
    try {
      const profile = await createProfile(name, 0, "Alpaca");
      const creds: AlpacaCreds = { keyId: keyId.trim(), secret: secret.trim(), paper };
      saveAlpacaCreds(profile.id, creds);
      await syncAlpacaToProfile(profile.id, creds);
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel-box" style={{ maxWidth: 460, margin: "0 auto" }}>
      <div className="panel-label">Connect Alpaca</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>Portfolio name</label>
          <input style={inputStyle} value={name} maxLength={40} placeholder="e.g. Alpaca Paper" onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Alpaca API Key ID</label>
          <input style={inputStyle} value={keyId} onChange={e => setKeyId(e.target.value)} autoComplete="off" />
        </div>
        <div>
          <label style={labelStyle}>Alpaca Secret Key</label>
          <input style={inputStyle} value={secret} type="password" onChange={e => setSecret(e.target.value)} autoComplete="off" />
        </div>
        <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={paper} onChange={e => setPaper(e.target.checked)} />
          Paper trading account
        </label>
        <span style={{ fontSize: 9, color: "var(--text-dim)", lineHeight: 1.6 }}>
          Use a <span style={{ color: "var(--accent)" }}>Read-only</span> key (Alpaca → API keys → Access Controls → Read only).
          EchelonAI only reads your data and never trades. Keys stay in your browser (dev mode; production moves them server-side).
        </span>
        {err && <div style={{ fontSize: 11, color: "var(--red)" }}>{err}</div>}
        <button style={{ ...btnStyle, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={connect}>
          {busy ? "Connecting…" : "Connect + Sync"}
        </button>
      </div>
    </div>
  );
}

// Re-sync panel shown inside an existing Alpaca profile
export function AlpacaSyncPanel({ profileId, onSynced }: { profileId: string; onSynced: () => void }) {
  const existing = loadAlpacaCreds(profileId);
  const [keyId, setKeyId] = useState(existing?.keyId ?? "");
  const [secret, setSecret] = useState(existing?.secret ?? "");
  const [paper, setPaper] = useState(existing?.paper ?? true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  async function sync() {
    setErr(null); setMsg(null);
    if (!keyId.trim() || !secret.trim()) { setErr("Enter your Alpaca key + secret."); return; }
    setBusy(true);
    try {
      const creds: AlpacaCreds = { keyId: keyId.trim(), secret: secret.trim(), paper };
      saveAlpacaCreds(profileId, creds);
      const r = await syncAlpacaToProfile(profileId, creds);
      setMsg(`Synced ${r.trades} trades, ${r.flows} cash flows.`);
      setEditing(false);
      onSynced();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  const showInputs = !existing || editing;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
        Pull the latest fills + deposits/withdrawals from Alpaca. Re-syncing replaces stored data.
      </p>
      {showInputs && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} placeholder="Key ID" value={keyId} onChange={e => setKeyId(e.target.value)} autoComplete="off" />
          <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} placeholder="Secret" type="password" value={secret} onChange={e => setSecret(e.target.value)} autoComplete="off" />
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={paper} onChange={e => setPaper(e.target.checked)} /> Paper
          </label>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button style={{ ...btnStyle, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={sync}>
          {busy ? "Syncing…" : "Sync from Alpaca"}
        </button>
        {existing && !editing && (
          <>
            <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{existing.paper ? "Paper" : "Live"} · key ••••{existing.keyId.slice(-4)}</span>
            <button
              onClick={() => setEditing(true)}
              title="Change keys"
              style={{
                background: "none", border: "1px solid var(--border)", cursor: "pointer",
                color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center",
                width: 26, height: 26, flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent-dim)"; e.currentTarget.style.color = "var(--accent)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              <Settings size={12} />
            </button>
          </>
        )}
        {existing && editing && (
          <button
            onClick={() => { setEditing(false); setKeyId(existing.keyId); setSecret(existing.secret); setPaper(existing.paper); setErr(null); }}
            style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-dim)", fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", padding: "6px 10px", cursor: "pointer" }}>
            Cancel
          </button>
        )}
      </div>
      {msg && <div style={{ fontSize: 11, color: "var(--green)" }}>{msg}</div>}
      {err && <div style={{ fontSize: 11, color: "var(--red)" }}>{err}</div>}
    </div>
  );
}
