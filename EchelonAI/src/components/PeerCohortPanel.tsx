import type { AnalysisResult, PeerCompany } from "@/types";

interface Props {
  result: AnalysisResult;
}

function ScoreBar({ score, dim = false }: { score: number; dim?: boolean }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = dim
    ? "var(--text-dim)"
    : pct >= 65
      ? "var(--green)"
      : pct >= 45
        ? "var(--accent)"
        : "var(--red)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 56, height: 2, background: "var(--border)", flexShrink: 0, position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: color }} />
      </div>
      <span style={{ fontSize: 10, color: dim ? "var(--text-dim)" : "var(--text-muted)", minWidth: 22, textAlign: "right" }}>
        {Math.round(pct)}
      </span>
    </div>
  );
}

function ReturnCell({ value, dim = false }: { value: number | null; dim?: boolean }) {
  if (value === null) {
    return <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "'DM Mono', monospace" }}>N/A</span>;
  }
  const color = dim ? "var(--text-dim)" : value > 0 ? "var(--green)" : value < 0 ? "var(--red)" : "var(--text-muted)";
  return (
    <span style={{ fontSize: 12, color, fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>
      {value > 0 ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

function PeerRow({
  ticker,
  companyName,
  quarterlyReturn,
  financialScore,
  culturalScore,
  isMain,
}: PeerCompany & { isMain: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 130px 130px 80px",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        background: isMain ? "rgba(245,166,35,0.05)" : "transparent",
        borderLeft: isMain ? "2px solid var(--accent)" : "2px solid transparent",
        marginBottom: 2,
      }}
    >
      {/* Company */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {isMain && (
          <span style={{ fontSize: 9, color: "var(--accent)", letterSpacing: "0.1em" }}>▶</span>
        )}
        <div>
          <span style={{ fontSize: 11, color: isMain ? "var(--accent)" : "var(--text)", fontFamily: "'DM Mono', monospace", fontWeight: isMain ? 500 : 400 }}>
            {ticker}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 6 }}>
            {companyName}
          </span>
        </div>
      </div>

      {/* Financial score */}
      <ScoreBar score={financialScore} dim={!isMain} />

      {/* Cultural score */}
      <ScoreBar score={culturalScore} dim={!isMain} />

      {/* Return */}
      <div style={{ textAlign: "right" }}>
        <ReturnCell value={quarterlyReturn} dim={!isMain} />
      </div>
    </div>
  );
}

export default function PeerCohortPanel({ result }: Props) {
  const { peerCohort, ticker, companyName, financialScore, culturalScore } = result;
  if (!peerCohort || peerCohort.peers.length === 0) return null;

  const quarterlyReturn = typeof result.forumChart?.deltaPrice === "number" ? result.forumChart.deltaPrice : null;
  const periodLabel = `Q${result.timeframe.quarter} ${result.timeframe.year}`;

  return (
    <div className="panel-box fade-up fade-up-2">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div className="panel-label" style={{ marginBottom: 0 }}>Peer Cohort</div>
        <span style={{ fontSize: 9, letterSpacing: "0.15em", color: "var(--text-dim)", textTransform: "uppercase" }}>
          {periodLabel}
        </span>
      </div>

      {/* Column headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 130px 130px 80px",
          gap: 12,
          padding: "0 14px",
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 9, letterSpacing: "0.15em", color: "var(--text-dim)", textTransform: "uppercase" }}>Company</span>
        <span style={{ fontSize: 9, letterSpacing: "0.15em", color: "var(--text-dim)", textTransform: "uppercase" }}>Financial</span>
        <span style={{ fontSize: 9, letterSpacing: "0.15em", color: "var(--text-dim)", textTransform: "uppercase" }}>Cultural</span>
        <span style={{ fontSize: 9, letterSpacing: "0.15em", color: "var(--text-dim)", textTransform: "uppercase", textAlign: "right" }}>Q Return</span>
      </div>

      {/* Main company row */}
      <PeerRow
        ticker={ticker}
        companyName={companyName}
        quarterlyReturn={quarterlyReturn}
        financialScore={financialScore}
        culturalScore={result.culturalScore}
        culturalSentiment={culturalScore >= 60 ? "pos" : culturalScore < 45 ? "neg" : "neutral"}
        isMain={true}
      />

      {/* Peer rows */}
      {peerCohort.peers.map((peer) => (
        <PeerRow key={peer.ticker} {...peer} isMain={false} />
      ))}

      {/* Narrative */}
      {peerCohort.narrative && (
        <div
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
          }}
        >
          <p style={{ fontSize: 9, letterSpacing: "0.18em", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 10 }}>
            Peer Comparison
          </p>
          <p style={{ fontSize: 12, lineHeight: 1.7, color: "var(--text-muted)", margin: 0 }}>
            {peerCohort.narrative}
          </p>
        </div>
      )}
    </div>
  );
}
