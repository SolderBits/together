import { SENTENCES, VERDICT_TEMPLATES } from "@/lib/games/content/court";
import { hashString, mulberry32 } from "@/lib/utils";
import type { CriterionScore, JudgeRequest, JudgedPlayer, Verdict } from "./types";

const EVIDENCE_MARKERS = [
  "because", "since", "for example", "e.g", "studies", "research", "data",
  "statistic", "percent", "%", "evidence", "proof", "last time", "remember when",
  "in fact", "actually", "specifically",
];

const CREATIVE_MARKERS = [
  "imagine", "picture this", "like a", "as if", "metaphor", "consider",
  "suppose", "what if", "frankly", "ironically",
];

function sentences(text: string) {
  return text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
}

function countMarkers(text: string, markers: string[]) {
  const lower = text.toLowerCase();
  return markers.reduce((n, m) => n + (lower.includes(m) ? 1 : 0), 0);
}

function scale(value: number, ceiling: number, max = 10) {
  return Math.max(1, Math.min(max, Math.round((value / ceiling) * max)));
}

/**
 * A transparent, deterministic scorer used whenever no AI key is configured.
 * It rewards structure, concrete detail and variety — the same things the
 * hosted judge is asked to look for — so the game stays playable offline.
 */
export function judgeOffline(request: JudgeRequest): Verdict {
  const players: JudgedPlayer[] = request.submissions.map((submission) => {
    const text = `${submission.argument} ${submission.evidence ?? ""}`.trim();
    const words = text.split(/\s+/).filter(Boolean);
    const unique = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z']/g, ""))).size;
    const lines = sentences(text);
    const avgLen = lines.length ? words.length / lines.length : 0;

    const markerHits = countMarkers(text, EVIDENCE_MARKERS);
    const hasFigures = /\d/.test(text);
    const argument = scale(Math.min(words.length, 160) * 0.6 + lines.length * 6, 160);
    const evidence = scale(markerHits * 18 + (hasFigures ? 22 : 0), 100);
    const creativity = scale(
      unique * 1.4 + countMarkers(text, CREATIVE_MARKERS) * 14,
      140,
    );
    const persuasiveness = scale(
      (avgLen > 6 && avgLen < 26 ? 40 : 18) + Math.min(words.length, 120) * 0.35 + lines.length * 4,
      110,
    );

    const criteria: CriterionScore[] = [
      {
        id: "argument",
        label: "Argument quality",
        score: argument,
        note: `${lines.length} distinct point${lines.length === 1 ? "" : "s"} made.`,
      },
      {
        id: "evidence",
        label: "Evidence",
        score: evidence,
        note: hasFigures
          ? "Backed a claim with a figure."
          : markerHits >= 2
            ? "Reasons and examples, but nothing you could check."
            : markerHits === 1
              ? "One supporting reason offered."
              : "Mostly assertion — no reasons given.",
      },
      {
        id: "creativity",
        label: "Creativity",
        score: creativity,
        note: `${unique} different words across the case.`,
      },
      {
        id: "persuasiveness",
        label: "Persuasiveness",
        score: persuasiveness,
        note:
          avgLen > 26
            ? "Sentences run long; the point gets buried."
            : avgLen < 6
              ? "Very clipped — reads more like notes than a case."
              : "Well-paced and easy to follow.",
      },
    ];

    return {
      playerId: submission.playerId,
      name: submission.name,
      side: submission.side,
      criteria,
      total: criteria.reduce((sum, c) => sum + c.score, 0),
    };
  });

  const best = Math.max(...players.map((p) => p.total), 0);
  const leaders = players.filter((p) => p.total === best);
  const winner = leaders.length === 1 ? leaders[0] : null;

  const rand = mulberry32(hashString(request.topic + players.map((p) => p.total).join("-")));
  const sentence = SENTENCES[Math.floor(rand() * SENTENCES.length)];

  if (request.kind === "court") {
    const template = VERDICT_TEMPLATES[Math.floor(rand() * VERDICT_TEMPLATES.length)];
    const reason = winner
      ? `${winner.name} laid out the clearer case, particularly on ${
          winner.criteria.slice().sort((a, b) => b.score - a.score)[0].label.toLowerCase()
        }.`
      : "Both sides were equally convincing, which is its own kind of failure.";
    return {
      winnerId: winner?.playerId ?? null,
      headline: winner ? `Judgment for ${winner.name}` : "Hung jury",
      reasoning: template
        .replace("{winner}", winner?.name ?? "nobody")
        .replace("{reason}", reason)
        .replace("{sentence}", sentence),
      sentence: winner ? sentence : undefined,
      players,
      source: "offline",
    };
  }

  return {
    winnerId: winner?.playerId ?? null,
    headline: winner ? `${winner.name} wins the debate` : "Too close to call",
    reasoning: winner
      ? `${winner.name} scored ${winner.total} to ${
          players.find((p) => p.playerId !== winner.playerId)?.total ?? 0
        }. The gap came from ${winner.criteria
          .slice()
          .sort((a, b) => b.score - a.score)[0]
          .label.toLowerCase()}.`
      : "Identical scores across all four criteria. Run it back with better arguments.",
    players,
    source: "offline",
  };
}
