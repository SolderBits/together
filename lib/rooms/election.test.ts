import { electHost } from "./api";
import { PRESENCE_TIMEOUT_MS, HOST_ELECTION_COOLDOWN_MS, type RoomState, type RoomPlayer } from "./types";

const NOW = 1_000_000_000;
const P = (id: string, secondsAgo: number, role: "host" | "guest" = "guest"): RoomPlayer =>
  ({ id, name: id, emoji: "x", role, ready: true, lastSeen: NOW - secondsAgo * 1000 });

function room(hostId: string, players: RoomPlayer[], hostSinceSecondsAgo = 600): RoomState {
  return {
    code: "ABC123", experienceId: "know-me", status: "active", hostId,
    hostSince: NOW - hostSinceSecondsAgo * 1000,
    seed: "s", createdAt: NOW - 900_000, startedAt: NOW - 600_000,
    players: Object.fromEntries(players.map((p) => [p.id, p])), data: {},
  };
}

let pass = 0, fail = 0;
const is = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : `  (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`}`);
};

// 1. Healthy host is never replaced.
is("live host stays", electHost(room("p_a", [P("p_a", 2, "host"), P("p_b", 1)]), NOW), null);

// 2. A blip shorter than the tolerance changes nothing.
is("30s blip: no migration", electHost(room("p_a", [P("p_a", 30, "host"), P("p_b", 1)]), NOW), null);
is("44s blip: no migration", electHost(room("p_a", [P("p_a", 44, "host"), P("p_b", 1)]), NOW), null);

// 3. Past the tolerance the successor is elected.
is("46s gone: b elected", electHost(room("p_a", [P("p_a", 46, "host"), P("p_b", 1)]), NOW), "p_b");

// 4. Deterministic: lowest id wins, whatever order the map is built in.
const three = [P("p_c", 1), P("p_b", 1), P("p_d", 1)];
is("lowest id wins", electHost(room("p_a", [P("p_a", 60, "host"), ...three]), NOW), "p_b");
is("order-independent", electHost(room("p_a", [P("p_a", 60, "host"), ...three.slice().reverse()]), NOW), "p_b");

// 5. Every client derives the same answer from the same document.
const shared = room("p_a", [P("p_a", 60, "host"), P("p_z", 1), P("p_b", 2), P("p_m", 3)]);
const answers = new Set([electHost(shared, NOW), electHost(shared, NOW), electHost(shared, NOW)]);
is("one answer across clients", [...answers], ["p_b"]);

// 6. Cooldown blocks a second handover.
is("inside cooldown: no re-election",
  electHost(room("p_b", [P("p_a", 60), P("p_b", 60, "host"), P("p_c", 1)], 5), NOW), null);
is("after cooldown: re-elects",
  electHost(room("p_b", [P("p_a", 60), P("p_b", 60, "host"), P("p_c", 1)], HOST_ELECTION_COOLDOWN_MS / 1000 + 1), NOW), "p_c");

// 7. Nobody online at all — nothing to elect.
is("empty room", electHost(room("p_a", [P("p_a", 60, "host"), P("p_b", 90)]), NOW), null);

// 8. Last player standing takes authority so they can finish.
is("sole survivor elected", electHost(room("p_a", [P("p_a", 60, "host"), P("p_b", 1)]), NOW), "p_b");

// 9. The former host does not take it back on return.
const afterMigration = room("p_b", [P("p_a", 0), P("p_b", 1, "host")], 300);
is("returning ex-host stays a guest", electHost(afterMigration, NOW), null);

// 10. A host that leaves deliberately (lastSeen zeroed) migrates at once.
const walked = room("p_a", [{ ...P("p_a", 0, "host"), lastSeen: 0 }, P("p_b", 1)]);
is("deliberate exit migrates", electHost(walked, NOW), "p_b");

// 11. Missing hostSince (rooms created before this field) must not block.
const { hostSince: _dropped, ...legacy } = room("p_a", [P("p_a", 60, "host"), P("p_b", 1)]);
void _dropped;
is("legacy room without hostSince", electHost(legacy as RoomState, NOW), "p_b");

// 12. Host id naming a player that no longer exists.
is("host absent from roster", electHost(room("p_gone", [P("p_b", 1), P("p_c", 2)]), NOW), "p_b");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
