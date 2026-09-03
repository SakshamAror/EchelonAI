// Cultural divergence panel — shows signal type, per-lane scores, and lead/lag.
// Only renders when culturalBreakdown is available; returns null otherwise.

import type { CulturalBreakdown } from "@/types";

interface Props {
  breakdown: CulturalBreakdown | null | undefined;
  financialScore?: number;
}

const SIGNAL_CONFIG: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  early_signal: {
    label: "EARLY SIGNAL",
    color: "var(--teal, #22d3ee)",
    bg: "rgba(34,211,238,0.07)",
    desc: "Reddit was ahead of mainstream media — retail spotted this before the press.",
  },
  fade: {
    label: "FADE",
    color: "var(--red, #f87171)",
    bg: "rgba(248,113,113,0.07)",
    desc: "Mainstream media led; Reddit came in late — possible hype fading or crowded trade.",
  },
  split: {
    label: "SPLIT",
    color: "var(--accent, #e8a830)",
    bg: "rgba(232,168,48,0.07)",
    desc: "Institutions and retail disagree significantly — classic divergence before a reversal.",
  },
  aligned: {
    label: "ALIGNED",
    color: "var(--green, #4ade80)",
    bg: "rgba(74,222,128,0.07)",
    desc: "Social and mainstream signals agree — broad consensus this quarter.",
  },
  unknown: {
    label: "UNKNOWN",
    color: "var(--text-muted, #4a5668)",
    bg: "rgba(74,86,104,0.07)",
    desc: "Insufficient data to classify the signal relationship.",
  },
};

function ScoreBar({ label, value, color }: { label: string; value: number | null | undefined; color: string }) {
  const v = value ?? 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", width: 88, flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 4, background: "var(--surf-3, #162135)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${v}%`, height: 4, background: color, borderRadius: 2, transition: "width 0.9s cubic-bezier(0.16,1,0.3,1)" }} />
      </div>
      <span style={{ fontSize: 10, color: "var(--text-muted)", width: 28, textAlign: "right", flexShrink: 0 }}>
        {value != null ? v.toFixed(0) : "—"}
      </span>
    </div>
  );
}

export default function DivergencePanel({ breakdown, financialScore }: Props) {
  if (!breakdown) return null;

  const { divergence, mainstream, social, sec } = breakdown;
  const signalType = divergence?.signalType ?? "unknown";
  const cfg = SIGNAL_CONFIG[signalType] ?? SIGNAL_CONFIG.unknown;
  const leadLag = divergence?.leadLagDays;

  let leadLagText = "";
  if (leadLag != null) {
    const days = Math.abs(leadLag);
    const daysLabel = `${days.toFixed(1)} day${days !== 1 ? "s" : ""}`;
    leadLagText = leadLag > 0
      ? `Reddit was ${daysLabel} ahead of mainstream coverage.`
      : leadLag < 0
      ? `Mainstream media was ${daysLabel} ahead of Reddit activity.`
      : "Reddit and mainstream coverage arrived simultaneously.";
  }

  return (
    <div className="panel-box" style={{ borderLeft: `3px solid ${cfg.color}`, background: cfg.bg }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
        <span style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 9,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: cfg.color,
          fontWeight: 600,
        }}>
          {cfg.label}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
          {cfg.desc}
        </span>
      </div>

      {leadLagText && (
        <p style={{
          fontSize: 11,
          color: "var(--text-muted)",
          letterSpacing: "0.03em",
          marginBottom: 16,
          paddingLeft: 12,
          borderLeft: `2px solid ${cfg.color}`,
        }}>
          {leadLagText}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ScoreBar label="Mainstream"  value={mainstream?.score}   color="var(--purple, #a855f7)" />
        <ScoreBar label="Social"      value={social?.score}       color="var(--teal, #22d3ee)"   />
        <ScoreBar label="SEC Tone"    value={sec?.score}          color="var(--accent, #e8a830)" />
        {financialScore != null && (
          <ScoreBar label="Financial" value={financialScore}      color="var(--green, #4ade80)"  />
        )}
      </div>

      {social?.mentionVelocity != null && social.mentionVelocity > 0 && (
        <p style={{ marginTop: 14, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.04em" }}>
          Reddit mention velocity: <span style={{ color: "var(--teal, #22d3ee)" }}>
            {social.mentionVelocity.toFixed(1)} posts/week
          </span>
          {social.firstMentionDate && (
            <> · first mention <span style={{ color: "var(--text)" }}>{social.firstMentionDate}</span></>
          )}
        </p>
      )}
    </div>
  );
}
