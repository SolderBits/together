"use client";

export interface ArcadeScore {
  gameId: string;
  value: number;
  at: string;
}

const KEY = "together:arcade";

export function listScores(): ArcadeScore[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as ArcadeScore[];
  } catch {
    return [];
  }
}

/** `lowerIsBetter` covers reaction times, where a small number wins. */
export function bestScore(gameId: string, lowerIsBetter = false) {
  const values = listScores().filter((s) => s.gameId === gameId).map((s) => s.value);
  if (!values.length) return null;
  return lowerIsBetter ? Math.min(...values) : Math.max(...values);
}

export function recordScore(gameId: string, value: number) {
  if (typeof window === "undefined") return;
  const next = [{ gameId, value, at: new Date().toISOString() }, ...listScores()].slice(0, 60);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("together:store-change", { detail: KEY }));
  } catch {
    /* ignore */
  }
}
