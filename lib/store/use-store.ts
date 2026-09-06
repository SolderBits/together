"use client";

import { useCallback, useEffect, useState } from "react";
import { onStoreChange } from "./index";

/**
 * Reads from the local store and re-reads whenever anything writes to it.
 * Returns `null` on the first server render so hydration always matches.
 */
export function useStore<T>(selector: () => T) {
  const [value, setValue] = useState<T | null>(null);
  const read = useCallback(() => setValue(selector()), [selector]);

  useEffect(() => {
    read();
    return onStoreChange(read);
  }, [read]);

  return [value, read] as const;
}

/** Convenience for collections: gives `[]` rather than `null` before hydration. */
export function useStoreList<T>(selector: () => T[]) {
  const [value, refresh] = useStore(selector);
  return [value ?? [], refresh, value !== null] as const;
}
