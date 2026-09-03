// READ instructions.txt before editing this file.
// NEW component — Cultural Signals timeline panel.
// Receives CulturalSignal[] from AnalysisResult.culturalSignals.

import { useState } from "react";
import type { CulturalBreakdown, CulturalSignal, RedditPost } from "@/types";

type Tab = "mainstream" | "analyst" | "social" | "sec";

interface Props {
  signals: CulturalSignal[];
  error?: string;
  /** When true, show every signal row (used when jumping from Key Signals). */
  expandForDeepLink?: boolean;
  /** Full cultural breakdown for tabbed view. */
  breakdown?: CulturalBreakdown | null;
}

const SENTIMENT_STYLES: Record<string, { dot: string; border: string; titleColor: string; bodyColor: string }> = {
  pos: {
    dot:        "var(--green)",
    border:     "var(--signal-pos-border)",
    titleColor: "var(--signal-pos-title)",
    bodyColor:  "var(--signal-pos-body)",
  },
  neg: {
    dot:        "var(--red)",
    border:     "var(--signal-neg-border)",
    titleColor: "var(--signal-neg-title)",
    bodyColor:  "var(--signal-neg-body)",
  },
  neutral: {
    dot:        "var(--signal-neu-dot)",
    border:     "var(--signal-neu-border)",
    titleColor: "var(--signal-neu-title)",
    bodyColor:  "var(--text-muted)",
  },
};

const SENTIMENT_ORDER: Record<string, number> = { pos: 0, neg: 1, neutral: 2 };

/** Strip markdown image tags, links, headings, and collapse whitespace. */
function cleanMarkdown(text: string): string {
  return text
    .replace(/!\[.*?\]\(.*?\)/g, "")                // ![alt](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")        // [text](url) → text
    .replace(/^#{1,6}\s*/gm, "")                    // ## headings
    .replace(/\*\*(.*?)\*\*/g, "$1")                // **bold**
    .replace(/\*(.*?)\*/g, "$1")                    // *italic*
    .replace(/`([^`]+)`/g, "$1")                    // `code`
    .replace(/https?:\/\/\S+/g, "")                 // bare URLs
    .replace(/\s+/g, " ")
    .trim();
}

/** Split "Title sentence. Rest of content..." into { title, body }. */
function splitText(raw: string): { title: string; body: string } {
  const clean = cleanMarkdown(raw);
  // Split at first period followed by space/end
  const match = clean.match(/^(.+?[.!?])\s+(.+)$/s);
  if (match) {
    return {
      title: match[1].trim(),
      body:  match[2].trim().slice(0, 220) + (match[2].trim().length > 220 ? "…" : ""),
    };
  }
  return { title: clean.slice(0, 120), body: "" };
}

const TONE_CONFIG = {
  cautious:  { color: "var(--red, #f87171)",   label: "CAUTIOUS" },
  confident: { color: "var(--green, #4ade80)", label: "CONFIDENT" },
  neutral:   { color: "var(--accent, #e8a830)", label: "NEUTRAL" },
};

function RedditPostRow({ post }: { post: RedditPost }) {
  const sentDot = post.sentiment === "pos" ? "var(--green)" : post.sentiment === "neg" ? "var(--red)" : "var(--text-muted)";
  return (
    <div style={{
      display: "flex", gap: 10, alignItems: "flex-start",
      padding: "9px 12px", background: "var(--signal-item-bg, rgba(255,255,255,0.02))",
      borderLeft: "3px solid rgba(34,211,238,0.25)",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: sentDot, flexShrink: 0, marginTop: 5 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <a href={post.url || "#"} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", lineHeight: 1.45, textDecoration: "none" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--teal, #22d3ee)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text)")}
        >
          {post.title}
        </a>
        <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.04em" }}>
          <span style={{ color: "var(--teal, #22d3ee)", fontFamily: "'DM Mono', monospace" }}>r/{post.subreddit}</span>
          <span>↑ {post.score.toLocaleString()}</span>
          <span>{post.numComments.toLocaleString()} comments</span>
          <span>{post.date}</span>
        </div>
      </div>
    </div>
  );
}

export default function CulturalSignals({ signals, error, expandForDeepLink = false, breakdown }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("mainstream");

  const hasTabs = !!breakdown;

  if (error) {
    return (
      <div className="panel-box">
        <div className="panel-label">Cultural Signals</div>
        <div style={{
          padding: 14,
          border: "1px solid var(--red)",
          background: "rgba(255,76,76,0.06)",
          color: "var(--red)",
          fontSize: 12,
          lineHeight: 1.6,
        }}>
          {error}
        </div>
      </div>
    );
  }

  // Mainstream signals (sorted by sentiment, indexed for deep-link)
  const mainstreamSigs = hasTabs
    ? (breakdown!.mainstream.articles ?? [])
    : signals.filter(s => !s.source?.startsWith("r/"));
  const indexed = mainstreamSigs.map((sig, idx) => ({ sig, signalIndex1: idx + 1 }));
  const sorted = [...indexed].sort(
    (a, b) => (SENTIMENT_ORDER[a.sig.sentiment] ?? 2) - (SENTIMENT_ORDER[b.sig.sentiment] ?? 2)
  );
  const INITIAL_SHOW = 2;
  const showAll = expanded || expandForDeepLink;
  const visible = showAll ? sorted : sorted.slice(0, INITIAL_SHOW);
  const hiddenCount = sorted.length - INITIAL_SHOW;

  // Analyst articles (Seeking Alpha, Motley Fool, Zacks, etc.)
  const analystArticles: CulturalSignal[] = breakdown?.analyst?.articles ?? [];

  // Social (Reddit) posts
  const redditPosts: RedditPost[] = breakdown?.social?.posts ?? [];

  // SEC tab content
  const secHighlights: string[] = breakdown?.sec?.highlights ?? [];
  const secTone = breakdown?.sec?.tone ?? "neutral";
  const toneCfg = TONE_CONFIG[secTone] ?? TONE_CONFIG.neutral;

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: "mainstream", label: "Mainstream", count: mainstreamSigs.length },
    { id: "analyst",    label: "Analyst",    count: analystArticles.length },
    { id: "social",     label: "Social",     count: redditPosts.length },
    { id: "sec",        label: "SEC Tone",   count: secHighlights.length },
  ];

  return (
    <div className="panel-box">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div className="panel-label" style={{ marginBottom: 0 }}>Cultural Signals</div>

        {/* Tab bar — only when breakdown is present */}
        {hasTabs && (
          <div style={{ display: "flex", gap: 0 }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
                  cursor: "pointer",
                  padding: "4px 12px 6px",
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: activeTab === tab.id ? "var(--accent)" : "var(--text-muted)",
                  fontFamily: "'DM Mono', monospace",
                  transition: "color 0.15s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={e => { if (activeTab !== tab.id) e.currentTarget.style.color = "var(--text)"; }}
                onMouseLeave={e => { if (activeTab !== tab.id) e.currentTarget.style.color = "var(--text-muted)"; }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span style={{ marginLeft: 5, fontSize: 9, color: "var(--text-muted)" }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Mainstream tab ── */}
      {(!hasTabs || activeTab === "mainstream") && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visible.map(({ sig, signalIndex1 }) => {
              const style = SENTIMENT_STYLES[sig.sentiment] ?? SENTIMENT_STYLES.neutral;
              const { title, body } = splitText(sig.text);
              return (
                <div
                  id={`cultural-signal-${signalIndex1}`}
                  className="echelon-jump-target"
                  key={signalIndex1}
                  style={{ display: "flex", gap: 12, alignItems: "flex-start",
                    padding: "10px 12px", borderLeft: `3px solid ${style.border}`,
                    background: "var(--signal-item-bg)" }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%",
                    background: style.dot, flexShrink: 0, marginTop: 5 }} />
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.5,
                      color: style.titleColor, margin: 0 }}>{title}</p>
                    {body && (
                      <p style={{ fontSize: 11, lineHeight: 1.6,
                        color: style.bodyColor, margin: "4px 0 0" }}>{body}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {sorted.length > INITIAL_SHOW && (
            <button onClick={() => setExpanded(e => !e)} style={{
              marginTop: 12, background: "none", border: "none", cursor: "pointer",
              fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
              color: "var(--accent)", padding: 0 }}>
              {expanded ? "Show Less" : `Show ${hiddenCount} More`}
            </button>
          )}
        </>
      )}

      {/* ── Analyst tab (Seeking Alpha, Motley Fool, Zacks, Barron's) ── */}
      {hasTabs && activeTab === "analyst" && (
        <>
          {analystArticles.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>
              No analyst coverage found for this quarter.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {analystArticles.map((sig, i) => {
                const style = SENTIMENT_STYLES[sig.sentiment] ?? SENTIMENT_STYLES.neutral;
                const { title, body } = splitText(sig.text);
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex", gap: 12, alignItems: "flex-start",
                      padding: "10px 12px",
                      borderLeft: "3px solid rgba(167,139,250,0.5)",
                      background: "var(--signal-item-bg)",
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: "50%",
                      background: style.dot, flexShrink: 0, marginTop: 5 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {sig.url ? (
                        <a href={sig.url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.5,
                            color: style.titleColor, textDecoration: "none" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "#a78bfa")}
                          onMouseLeave={e => (e.currentTarget.style.color = style.titleColor)}
                        >
                          {title}
                        </a>
                      ) : (
                        <p style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.5,
                          color: style.titleColor, margin: 0 }}>{title}</p>
                      )}
                      {body && (
                        <p style={{ fontSize: 11, lineHeight: 1.6,
                          color: style.bodyColor, margin: "4px 0 0" }}>{body}</p>
                      )}
                      {sig.source && (
                        <span style={{ fontSize: 10, color: "#a78bfa",
                          fontFamily: "'DM Mono', monospace", display: "block", marginTop: 3 }}>
                          {sig.source}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Social (Reddit) tab ── */}
      {hasTabs && activeTab === "social" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {redditPosts.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>
              No Reddit posts found for this quarter.
            </p>
          ) : (
            redditPosts.map(post => <RedditPostRow key={post.id} post={post} />)
          )}
        </div>
      )}

      {/* ── SEC Tone tab ── */}
      {hasTabs && activeTab === "sec" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.18em",
              textTransform: "uppercase", color: toneCfg.color, fontWeight: 600 }}>
              {toneCfg.label}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Management language tone in 10-Q MD&A
            </span>
          </div>
          {secHighlights.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No SEC highlights available.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {secHighlights.map((h, i) => (
                <div key={i} style={{ fontSize: 12, lineHeight: 1.65, color: "var(--text-muted)",
                  paddingLeft: 12, borderLeft: `2px solid ${toneCfg.color}` }}>
                  {h}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
