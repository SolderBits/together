"use client";

import { useEffect, useRef } from "react";
import { recordCompletion } from "./index";

/**
 * Records one completion per finished session.
 *
 * Guarded by a ref keyed on `sessionKey` so it survives React re-renders and
 * StrictMode's double effect invocation, while still counting again when the
 * pair start a fresh round.
 */
export function useRecordCompletion(experienceId: string, completed: boolean, sessionKey: string) {
  const recorded = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!completed) return;
    const key = `${experienceId}:${sessionKey}`;
    if (recorded.current.has(key)) return;
    recorded.current.add(key);
    recordCompletion(experienceId);
  }, [experienceId, completed, sessionKey]);
}
