"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  RoomNotFoundError,
  RoomSession,
  everyoneReady,
  onlinePlayers,
  roomRoster,
} from "@/lib/rooms/api";
import { getIdentity } from "@/lib/rooms/identity";
import type { PlayerIdentity, RoomEvent, RoomPlayer, RoomState, RoomStatePatch } from "@/lib/rooms/types";

export type RoomConnectionStatus = "idle" | "connecting" | "connected" | "error" | "not-found";

interface RoomContextValue {
  session: RoomSession | null;
  state: RoomState | null;
  status: RoomConnectionStatus;
  error: string | null;
  identity: PlayerIdentity;
  me: RoomPlayer | null;
  partner: RoomPlayer | null;
  /** Online right now — use for presence UI. */
  players: RoomPlayer[];
  /** Everyone the room knows about — use for scores and results. */
  roster: RoomPlayer[];
  isHost: boolean;
  isSolo: boolean;
  bothReady: boolean;
  backend: "local" | "supabase" | null;
  update: (patch: RoomStatePatch | ((current: RoomState) => RoomStatePatch)) => Promise<void>;
  setReady: (ready: boolean) => Promise<void>;
  start: () => Promise<void>;
  finish: () => Promise<void>;
  reset: (data?: Record<string, unknown>) => Promise<void>;
  broadcast: (type: string, payload: unknown) => Promise<void>;
  onEvent: (handler: (event: RoomEvent) => void) => () => void;
  leave: (destroy?: boolean) => Promise<void>;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({
  code,
  experienceId,
  asHost,
  children,
}: {
  code: string;
  experienceId: string;
  asHost: boolean;
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<RoomSession | null>(null);
  const [state, setState] = useState<RoomState | null>(null);
  const [status, setStatus] = useState<RoomConnectionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<PlayerIdentity>(() => getIdentity());
  const [, forceTick] = useState(0);
  const sessionRef = useRef<RoomSession | null>(null);

  useEffect(() => {
    const onIdentity = (e: Event) => setIdentity((e as CustomEvent<PlayerIdentity>).detail);
    window.addEventListener("together:identity", onIdentity);
    return () => window.removeEventListener("together:identity", onIdentity);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    setStatus("connecting");
    RoomSession.open({ code, experienceId, identity: getIdentity(), asHost })
      .then((next) => {
        if (cancelled) {
          void next.leave();
          return;
        }
        sessionRef.current = next;
        setSession(next);
        unsubscribe = next.subscribe((s) => setState({ ...s }));
        setStatus("connected");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof RoomNotFoundError) {
          setStatus("not-found");
          setError(`We couldn't find room ${code}.`);
        } else {
          setStatus("error");
          setError(err instanceof Error ? err.message : "Something went wrong connecting.");
        }
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
      void sessionRef.current?.leave();
      sessionRef.current = null;
    };
    // Reconnecting on identity change would drop the room; identity is read fresh.
  }, [code, experienceId, asHost]);

  // Presence is time-based, so re-render periodically to expire stale players.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 3000);
    return () => clearInterval(t);
  }, []);

  const players = useMemo(() => onlinePlayers(state), [state]);
  const roster = useMemo(() => roomRoster(state), [state]);
  const me = players.find((p) => p.id === identity.id) ?? state?.players?.[identity.id] ?? null;
  const partner = players.find((p) => p.id !== identity.id) ?? null;

  const value: RoomContextValue = {
    session,
    state,
    status,
    error,
    identity,
    me: me ?? null,
    partner,
    players,
    roster,
    isHost: state ? state.hostId === identity.id : asHost,
    isSolo: players.length <= 1,
    bothReady: everyoneReady(state),
    backend: session ? session.transportKind : null,
    update: useCallback(
      async (patch) => {
        await sessionRef.current?.updateState(patch);
      },
      [],
    ),
    setReady: useCallback(async (ready: boolean) => {
      await sessionRef.current?.setReady(ready);
    }, []),
    start: useCallback(async () => {
      await sessionRef.current?.start();
    }, []),
    finish: useCallback(async () => {
      await sessionRef.current?.finish();
    }, []),
    reset: useCallback(async (data: Record<string, unknown> = {}) => {
      await sessionRef.current?.reset(data);
    }, []),
    broadcast: useCallback(async (type: string, payload: unknown) => {
      await sessionRef.current?.broadcast(type, payload);
    }, []),
    onEvent: useCallback((handler: (event: RoomEvent) => void) => {
      return sessionRef.current?.onEvent(handler) ?? (() => {});
    }, []),
    leave: useCallback(async (destroy = false) => {
      await sessionRef.current?.leave({ destroy, departing: true });
      sessionRef.current = null;
    }, []),
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoom must be used inside a <RoomProvider>");
  return ctx;
}

/** Subscribes to broadcast events of one type for the lifetime of a component. */
export function useRoomEvent<T = unknown>(
  type: string,
  handler: (payload: T, event: RoomEvent) => void,
) {
  const { onEvent } = useRoom();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    return onEvent((event) => {
      if (event.type === type) ref.current(event.payload as T, event);
    });
  }, [onEvent, type]);
}

/**
 * Reads a slice of the shared `data` bag with a fallback, plus a setter that
 * merges back into the room document.
 */
export function useSharedState<T>(key: string, fallback: T) {
  const { state, update } = useRoom();
  const value = ((state?.data as Record<string, unknown> | undefined)?.[key] as T) ?? fallback;
  const setValue = useCallback(
    (next: T | ((current: T) => T)) => {
      return update((current) => {
        const currentValue =
          ((current.data as Record<string, unknown>)[key] as T) ?? fallback;
        const resolved =
          typeof next === "function" ? (next as (c: T) => T)(currentValue) : next;
        return { data: { [key]: resolved } as Partial<Record<string, unknown>> };
      });
    },
    [key, update, fallback],
  );
  return [value, setValue] as const;
}
