"use client";

import { judgeOffline } from "./offline-judge";
import type { JudgeRequest, Verdict } from "./types";

/**
 * Calls the server-side judging route. The browser never sees an API key, and
 * a network failure degrades to the same deterministic judge the server uses.
 */
export async function requestVerdict(payload: JudgeRequest): Promise<Verdict> {
  try {
    const response = await fetch("/api/judge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Judge responded ${response.status}`);
    return (await response.json()) as Verdict;
  } catch {
    return judgeOffline(payload);
  }
}
