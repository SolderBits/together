"use client";

import { useEffect, useState } from "react";
import { connectionState, subscribeConnection, type ConnectionState } from "./connection-status";

/**
 * The live realtime connection state.
 *
 * Reads the observable the Railway transport publishes to. With any other
 * transport it stays `local`, which is the truth rather than a placeholder.
 */
export function useConnectionState(): ConnectionState {
  const [state, setState] = useState<ConnectionState>(() => connectionState());
  useEffect(() => subscribeConnection(setState), []);
  return state;
}
