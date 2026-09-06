export type JudgeKind = "debate" | "court";

export interface JudgeSubmission {
  playerId: string;
  name: string;
  /** "For" / "Against", or "Plaintiff" / "Defendant". */
  side: string;
  argument: string;
  evidence?: string;
}

export interface CriterionScore {
  id: string;
  label: string;
  score: number;
  note: string;
}

export interface JudgedPlayer {
  playerId: string;
  name: string;
  side: string;
  criteria: CriterionScore[];
  total: number;
}

export interface Verdict {
  winnerId: string | null;
  headline: string;
  reasoning: string;
  sentence?: string;
  players: JudgedPlayer[];
  /** Where the ruling came from, so the UI can be honest about it. */
  source: "ai" | "offline";
}

export interface JudgeRequest {
  kind: JudgeKind;
  topic: string;
  submissions: JudgeSubmission[];
}
