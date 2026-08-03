export type Channel = "sms" | "email" | "popup";
export type Tactic = "urgency" | "authority" | "fear" | "greed" | "familiarity";

export type Profile = {
  firstName: string;
  bankName: string;
  hobbies: string[];
  familyMember: string;
  relation: string;
  services: string[];
};

export type Message = {
  id: string;
  channel: Channel;
  sender: string;
  subject?: string;
  body: string;
  isScam: boolean;
  tactic: Tactic | null;
  explanation: string;
  flags: string[];
};

export type AnswerRecord = {
  id: string;
  userSaidScam: boolean;
  correct: boolean;
  tactic: Tactic | null;
};

export type RoundGenerationResult = {
  round: Message[];
  usedFallback: boolean;
};

export type ScoreBreakdown = {
  score: number;
  correct: number;
  total: number;
  byTactic: Record<Tactic, { correct: number; total: number }>;
  strongestTactic: Tactic | null;
  weakestTactic: Tactic | null;
};