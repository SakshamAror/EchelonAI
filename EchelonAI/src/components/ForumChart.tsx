// READ instructions.txt before editing this file.
// Quarterly stock-price chart (Yahoo Finance) for the selected quarter.
// Event points link price moves to news articles via hover tooltip + click drawer.

import { useState } from "react";
import type { ForumChartData, ChartEventPoint, ChartArticleRef } from "@/types";

interface Props { data: ForumChartData; error?: string }

function fmtUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toFixed(2)}`;
}

function fmtPct(value: number, showSign = true): string {
  const sign = showSign && value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

const SENTIMENT_HEX: Record<string, string> = {
  pos: "#3ddc84",
  neg: "#ff4c4c",
  neutral: "#f5a623",
};

function dominantSentiment(articles: ChartArticleRef[]): "pos" | "neg" | "neutral" {
  if (!articles.length) return "neutral";
  const counts = { pos: 0, neg: 0, neutral: 0 };
  for (const a of articles) counts[a.sentiment] = (counts[a.sentiment] ?? 0) + 1;
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]) as "pos" | "neg" | "neutral";
}

function ArticleCard({ article }: { article: ChartArticleRef }) {
  const color = SENTIMENT_HEX[article.sentiment] ?? SENTIMENT_HEX.neutral;
  const inner = (
    <div style={{
      borderLeft: `3px solid ${color}`,
      paddingLeft: 10,
      paddingTop: 6,
      paddingBottom: 6,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", lineHeight: 1.45 }}>
        {article.title || "Article"}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
        {article.source}{article.date ? ` · ${article.date}` : ""}
      </div>
    </div>
  );
  if (article.url && article.url !== "#") {
    return (
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "block", textDecoration: "none" }}
      >
        {inner}
      </a>
    );
  }
  return <div>{inner}</div>;
}

export default function ForumChart({ data, error }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [clickedIdx, setClickedIdx] = useState<number | null>(null);

  if (error) {
    return (
      <div className="panel-box">
        <div className="panel-label">Stock Price / Quarter</div>
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

  const {
    points, labels, peakIndex, peakLabel,
    deltaPrice, startPrice, endPrice, highPrice, lowPrice,
    benchmarkPoints, benchmarkDelta, eventPoints,
  } = data;

  const W = 600;
  const H = 160;
  const n = points.length;
  const denom = Math.max(n - 1, 1);

  const isUp = deltaPrice >= 0;
  const stockColor = isUp ? "var(--green)" : "var(--red)";
  const stockColorHex = isUp ? "#3ddc84" : "#ff4c4c";
  const gradStopColor = isUp ? "#3ddc84" : "#ff4c4c";

  const pts = points.map((v, i) => ({
    x: (i / denom) * W,
    y: H - (v / 100) * H,
  }));

  const polyline = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const fillPath =
    `M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")}` +
    ` L${W},${H} L0,${H} Z`;

  const hasBenchmark = Array.isArray(benchmarkPoints) && benchmarkPoints.length >= 2;
  const bDenom = hasBenchmark ? Math.max((benchmarkPoints!.length - 1), 1) : 1;
  const bPolyline = hasBenchmark
    ? benchmarkPoints!.map((v, i) => `${((i / bDenom) * W).toFixed(1)},${(H - (v / 100) * H).toFixed(1)}`).join(" ")
    : "";

  const clampedPeakIndex = Math.max(0, Math.min(pts.length - 1, peakIndex));
  const peak = pts[clampedPeakIndex] ?? { x: 0, y: H };
  const peakPct = `${((peak.x / W) * 100).toFixed(2)}%`;
  const peakTopPct = `${((peak.y / H) * 100).toFixed(2)}%`;

  const hasBDelta = typeof benchmarkDelta === "number" && Number.isFinite(benchmarkDelta);
  const spread = hasBDelta ? deltaPrice - benchmarkDelta! : null;
  let verdict = "";
  let verdictColor = "var(--text-muted)";
  if (spread !== null) {
    if (spread > 2) { verdict = "OUTPERFORMING S&P 500"; verdictColor = "var(--green)"; }
    else if (spread < -2) { verdict = "UNDERPERFORMING S&P 500"; verdictColor = "var(--red)"; }
    else { verdict = "IN LINE WITH S&P 500"; verdictColor = "var(--accent)"; }
  }

  const deltaColor = isUp ? "var(--green)" : "var(--red)";

  // Build event point map
  const eventMap = new Map<number, ChartEventPoint>();
  if (Array.isArray(eventPoints)) {
    for (const ep of eventPoints) eventMap.set(ep.index, ep);
  }

  // Active tooltip data
  const hoveredEp = hoverIdx !== null ? eventMap.get(hoverIdx) : undefined;
  const clickedEp = clickedIdx !== null ? eventMap.get(clickedIdx) : undefined;
  const clickedArticles = clickedEp?.articles ?? [];

  const hoverPt = hoverIdx !== null ? pts[hoverIdx] : null;
  const hoverXPct = hoverPt ? `${((hoverPt.x / W) * 100).toFixed(2)}%` : "0%";
  const hoverYPct = hoverPt ? `${((hoverPt.y / H) * 100).toFixed(2)}%` : "0%";

  function handlePointClick(i: number) {
    const ep = eventMap.get(i);
    if (!ep || ep.articles.length === 0) return;
    setClickedIdx(prev => prev === i ? null : i);
  }

  const hasAnyEvents = eventMap.size > 0;

  return (
    <div className="panel-box">
      <div className="panel-label">Stock Price / Quarter</div>

      {/* ── Price change + vs-benchmark header ─────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        borderLeft: `4px solid ${deltaColor}`,
        paddingLeft: 16,
        marginBottom: 20,
        gap: 12,
      }}>
        <div>
          <p style={{ fontSize: 9, letterSpacing: "0.25em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>
            Quarterly Price Change
          </p>
          <p className="font-bebas" style={{ fontSize: 56, lineHeight: 1, color: deltaColor, letterSpacing: "0px" }}>
            {fmtPct(deltaPrice)}
          </p>
          {spread !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: verdictColor }}>
                {verdict}
              </span>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                {spread > 0 ? "+" : ""}{spread.toFixed(1)}pp vs S&P ({fmtPct(benchmarkDelta!)})
              </span>
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.8, flexShrink: 0 }}>
          <div>High <span style={{ color: "var(--green)", marginLeft: 6 }}>{fmtUsd(highPrice)}</span></div>
          <div>Low <span style={{ color: "var(--red)", marginLeft: 6 }}>{fmtUsd(lowPrice)}</span></div>
          <div style={{ fontSize: 10, marginTop: 4 }}>
            {fmtUsd(startPrice)} <span style={{ color: "var(--text-dim)" }}>→</span> {fmtUsd(endPrice)}
          </div>
        </div>
      </div>

      {/* ── Chart ───────────────────────────────────────────────── */}
      <div style={{ position: "relative", marginBottom: 28 }}>
        <div style={{ height: 160 }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: "100%", height: "100%", overflow: "visible" }}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={gradStopColor} stopOpacity="0.24" />
                <stop offset="100%" stopColor={gradStopColor} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[40, 80, 120].map((y) => (
              <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="#222" strokeWidth="1" />
            ))}

            {/* Midline (performance baseline) */}
            <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#444" strokeWidth="0.75" strokeDasharray="4,4" />

            {/* Fill under stock line */}
            <path d={fillPath} fill="url(#priceGrad)" />

            {/* S&P 500 benchmark line */}
            {hasBenchmark && (
              <polyline
                points={bPolyline}
                fill="none"
                stroke="#f5a623"
                strokeWidth="1.2"
                strokeDasharray="5,4"
                strokeOpacity="0.65"
                strokeLinejoin="round"
              />
            )}

            {/* Stock price line */}
            <polyline
              points={polyline}
              fill="none"
              stroke={stockColorHex}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />

            {/* Peak dashed vertical + dot (only when not an event point itself) */}
            {!eventMap.get(clampedPeakIndex)?.articles?.length && (
              <>
                <line
                  x1={peak.x} y1={peak.y}
                  x2={peak.x} y2="2"
                  stroke={stockColorHex} strokeWidth="1" strokeDasharray="3,3"
                />
                <circle cx={peak.x} cy={peak.y} r="3.5" fill={stockColorHex} />
              </>
            )}

            {/* Invisible hit targets for EVERY point — always present for easy hovering */}
            {pts.map((p, i) => {
              const ep = eventMap.get(i);
              const hasArticles = ep && ep.articles.length > 0;
              return (
                <circle
                  key={`hit-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={18}
                  fill="transparent"
                  stroke="none"
                  style={{ pointerEvents: "all", cursor: hasArticles ? "pointer" : "default" }}
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                  onClick={() => handlePointClick(i)}
                />
              );
            })}

            {/* Visible markers — only for event/structural points */}
            {pts.map((p, i) => {
              const ep = eventMap.get(i);
              if (!ep) return null;
              const hasArticles = ep.articles.length > 0;
              const isStructural = ep.isPeak || ep.isValley;
              if (!hasArticles && !isStructural) return null;

              const sentiment = hasArticles ? dominantSentiment(ep.articles) : "neutral";
              const dotColor = hasArticles ? SENTIMENT_HEX[sentiment] : stockColorHex;
              const isActive = hoverIdx === i || clickedIdx === i;

              return (
                <g key={`marker-${i}`} style={{ pointerEvents: "none" }}>
                  {/* Faint dashed vertical line up to top */}
                  {hasArticles && (
                    <line
                      x1={p.x} y1={p.y}
                      x2={p.x} y2="2"
                      stroke={dotColor}
                      strokeWidth="1"
                      strokeDasharray="2,3"
                      strokeOpacity="0.5"
                    />
                  )}
                  {/* Glow ring when hovered/clicked */}
                  {isActive && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={hasArticles ? 11 : 8}
                      fill={dotColor}
                      fillOpacity="0.22"
                      stroke="none"
                    />
                  )}
                  {/* Diamond for article events, circle for structural only */}
                  {hasArticles ? (
                    <rect
                      x={p.x - 6}
                      y={p.y - 6}
                      width={12}
                      height={12}
                      rx="1.5"
                      fill={dotColor}
                      stroke="var(--bg)"
                      strokeWidth="1.5"
                      transform={`rotate(45 ${p.x} ${p.y})`}
                    />
                  ) : (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={5}
                      fill={dotColor}
                      stroke="var(--bg)"
                      strokeWidth="1.5"
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Peak label — HTML overlay (only when not overridden by an event tooltip) */}
        {hoverIdx === null && (
          <div style={{
            position: "absolute",
            left: peakPct,
            top: peakTopPct,
            transform: "translate(-50%, -140%)",
            fontSize: 10,
            color: stockColor,
            fontFamily: "'DM Mono', monospace",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}>
            {peakLabel}
          </div>
        )}

        {/* Hover tooltip */}
        {hoverIdx !== null && hoverPt && (
          <div style={{
            position: "absolute",
            left: hoverXPct,
            top: hoverYPct,
            transform: "translate(-50%, -130%)",
            background: "var(--surface, #1a1a1a)",
            border: "1px solid var(--border, #333)",
            borderRadius: 6,
            padding: "7px 10px",
            pointerEvents: "none",
            zIndex: 10,
            minWidth: 160,
            maxWidth: 240,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}>
            {/* Date */}
            <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--text-muted)", marginBottom: hoveredEp?.articles?.length ? 5 : 0 }}>
              {hoveredEp?.date ?? ""}
            </div>
            {hoveredEp?.articles?.length ? (
              <>
                <div style={{ fontSize: 10, color: SENTIMENT_HEX[dominantSentiment(hoveredEp.articles)], fontWeight: 600, marginBottom: 4 }}>
                  {hoveredEp.articles.length} article{hoveredEp.articles.length > 1 ? "s" : ""}
                  {hoveredEp.isPeak ? " · Peak" : hoveredEp.isValley ? " · Valley" : ""}
                </div>
                <div style={{ fontSize: 10, color: "var(--text)", lineHeight: 1.4 }}>
                  {hoveredEp.articles[0].title?.slice(0, 80) ?? ""}
                  {(hoveredEp.articles[0].title?.length ?? 0) > 80 ? "…" : ""}
                </div>
                <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 4 }}>
                  Click to {clickedIdx === hoverIdx ? "close" : "expand"}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                {hoveredEp?.isPeak ? "Peak" : hoveredEp?.isValley ? "Valley" : "No articles"}
              </div>
            )}
          </div>
        )}

        {/* X-axis labels */}
        <div style={{
          position: "absolute",
          bottom: -20,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "space-between",
          pointerEvents: "none",
        }}>
          {labels.slice(0, 3).map((lbl, i) => (
            <span key={`${lbl}-${i}`} style={{
              fontSize: 10,
              color: "var(--text-dim)",
              fontFamily: "'DM Mono', monospace",
            }}>
              {lbl}
            </span>
          ))}
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 20, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        {hasBenchmark && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke={stockColorHex} strokeWidth="2" /></svg>
              <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.06em" }}>Stock</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke="#f5a623" strokeWidth="1.5" strokeDasharray="4,3" /></svg>
              <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.06em" }}>S&P 500</span>
            </div>
          </>
        )}
        {hasAnyEvents && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="12" height="12">
              <rect x="1" y="1" width="10" height="10" rx="1" fill="#f5a623" transform="rotate(45 6 6)" />
            </svg>
            <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.06em" }}>News event (click)</span>
          </div>
        )}
      </div>

      {/* ── Article drawer ──────────────────────────────────────── */}
      {clickedIdx !== null && clickedArticles.length > 0 && (
        <div style={{
          marginTop: 20,
          borderTop: "1px solid var(--border, #333)",
          paddingTop: 14,
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}>
            <span style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--text-muted)", textTransform: "uppercase" }}>
              News · {clickedEp?.date}
            </span>
            <button
              onClick={() => setClickedIdx(null)}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                fontSize: 16,
                cursor: "pointer",
                lineHeight: 1,
                padding: "0 2px",
              }}
              aria-label="Close article drawer"
            >
              ×
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {clickedArticles.map((article, i) => (
              <ArticleCard key={article.url || i} article={article} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
