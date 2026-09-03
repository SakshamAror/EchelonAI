import { useEffect, useState } from "react";

export type Tier = "core" | "advanced";

const KEY = "echelon_stats_tier";
const EVENT = "echelon-stats-tier-change";

export function loadTier(): Tier {
  return localStorage.getItem(KEY) === "advanced" ? "advanced" : "core";
}

export function saveTier(t: Tier) {
  localStorage.setItem(KEY, t);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: t }));
}

// Reactive read of the stats tier — updates live when StatsBar's gear toggle changes it.
export function useStatsTier(): Tier {
  const [tier, setTier] = useState<Tier>(loadTier);
  useEffect(() => {
    const onChange = (e: Event) => setTier((e as CustomEvent<Tier>).detail);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return tier;
}
