import { supabaseConfigured } from "@/lib/supabase";
import { useAuth, signInWithGoogle } from "@/lib/useAuth";
import CsvPortfolio from "@/components/portfolio/CsvPortfolio";

// Shared wrapper for centered full-height message states
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      maxWidth: 1100, margin: "0 auto", padding: "80px 40px",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "60vh", gap: 14, textAlign: "center",
    }}>
      {children}
    </div>
  );
}

function Kicker({ text }: { text: string }) {
  return (
    <p style={{ fontSize: 10, letterSpacing: "0.3em", color: "var(--text-muted)", textTransform: "uppercase" }}>
      // {text}
    </p>
  );
}

export default function PortfolioPage() {
  const { session, loading } = useAuth();

  // 1. Supabase env not filled in
  if (!supabaseConfigured) {
    return (
      <Centered>
        <Kicker text="Portfolio" />
        <h2 className="font-display" style={{ fontSize: 30, fontWeight: 400, color: "var(--text-dim)" }}>
          Configuration needed
        </h2>
        <p style={{ fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.05em", maxWidth: 380 }}>
          Supabase credentials are missing. Add VITE_SUPABASE_URL and
          VITE_SUPABASE_PUBLISHABLE_KEY to your .env and restart the dev server.
        </p>
      </Centered>
    );
  }

  // 2. Resolving session
  if (loading) {
    return (
      <Centered>
        <Kicker text="Portfolio" />
        <p style={{ fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.1em" }} className="blink">
          Loading…
        </p>
      </Centered>
    );
  }

  // 3. Not signed in
  if (!session) {
    return (
      <Centered>
        <Kicker text="Portfolio" />
        <h2 className="font-display" style={{ fontSize: 34, fontWeight: 400, marginBottom: 4 }}>
          Track your <em style={{ fontStyle: "italic", color: "var(--accent)" }}>real portfolio</em>
        </h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", letterSpacing: "0.05em", maxWidth: 420, marginBottom: 8 }}>
          Connect a brokerage to see live performance, risk metrics, and allocation.
          Sign in to get started.
        </p>
        <button
          onClick={signInWithGoogle}
          style={{
            background: "var(--accent)", border: "none", color: "#000",
            fontFamily: "'DM Mono', monospace", fontSize: 11,
            fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase",
            padding: "12px 24px", cursor: "pointer",
          }}
        >
          Sign in with Google
        </button>
      </Centered>
    );
  }

  // 4. Signed in — portfolio dashboard (account/sign-out lives in app Settings now)
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 40px 40px", width: "100%" }}>
      {/* CSV portfolio: profile + equity curve + holdings + cash flows */}
      <CsvPortfolio />
    </div>
  );
}
