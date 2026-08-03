import { seededRound } from "./seedRound";
import type { Message, Profile, Tactic } from "./types";

const MAX_FIELD_LENGTH = 40;

export function stripHtmlAndClamp(value: unknown, maxLength = MAX_FIELD_LENGTH) {
  if (typeof value !== "string") return "";
  return value.replace(/<[^>]*>/g, "").replace(/[\r\n]+/g, " ").trim().slice(0, maxLength);
}

export function sanitizeProfile(profile: Partial<Profile>): Profile {
  const hobbies = [profile.hobbies?.[0], profile.hobbies?.[1]]
    .map((item) => stripHtmlAndClamp(item))
    .filter(Boolean);

  const services = (profile.services ?? []).map((item) => stripHtmlAndClamp(item)).filter(Boolean);

  return {
    firstName: stripHtmlAndClamp(profile.firstName),
    bankName: stripHtmlAndClamp(profile.bankName),
    hobbies,
    familyMember: stripHtmlAndClamp(profile.familyMember),
    relation: stripHtmlAndClamp(profile.relation),
    services
  };
}

export function stripCodeFences(value: string) {
  return value.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

function isTactic(value: unknown): value is Tactic {
  return value === "urgency" || value === "authority" || value === "fear" || value === "greed" || value === "familiarity";
}

function normalizeFlags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => stripHtmlAndClamp(item, 64))
    .filter(Boolean)
    .slice(0, 3);
}

function fallbackExplanation(tactic: Tactic | null, isScam: boolean) {
  if (!isScam || !tactic) return "This looks calm and normal, which is why it is safe to keep reading it as a routine message.";
  const map: Record<Tactic, string> = {
    urgency: "This scam tries to rush you so you act before you think.",
    authority: "This scam borrows official-sounding language to make you obey.",
    fear: "This scam scares you so you respond quickly instead of carefully.",
    greed: "This scam tempts you with easy money to pull you in.",
    familiarity: "This scam pretends to be someone you know so you lower your guard."
  };
  return map[tactic];
}

function defaultFlags(tactic: Tactic | null, isScam: boolean) {
  if (!isScam) return ["calm tone", "expected context", "no private request"];
  const map: Record<Tactic, string[]> = {
    urgency: ["fast deadline", "pressure to click", "no time to think"],
    authority: ["official-sounding tone", "asks for compliance", "verification pressure"],
    fear: ["panic language", "threat of loss", "pushes a call or click"],
    greed: ["too-good-to-be-true", "fee to claim", "reward bait"],
    familiarity: ["pretends to know you", "blocks a call back", "asks for favor fast"]
  };
  return map[tactic ?? "urgency"];
}

function normalizeMessage(value: unknown): Message | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const channel = item.channel;
  if (channel !== "sms" && channel !== "email" && channel !== "popup") return null;
  const sender = stripHtmlAndClamp(item.sender, 60);
  const body = stripHtmlAndClamp(item.body, 260);
  if (!sender || !body) return null;
  const subject = stripHtmlAndClamp(item.subject, 80);
  const isScam = Boolean(item.isScam);
  const tactic = item.tactic === null ? null : isTactic(item.tactic) ? item.tactic : null;
  const explanation = stripHtmlAndClamp(item.explanation, 180) || fallbackExplanation(tactic, isScam);
  const flags = normalizeFlags(item.flags);

  if (isScam && !tactic) return null;
  if (!isScam && tactic) return null;

  return {
    id: stripHtmlAndClamp(item.id, 60) || `round-${Math.random().toString(36).slice(2, 8)}`,
    channel,
    sender,
    subject: channel === "email" && subject ? subject : undefined,
    body,
    isScam,
    tactic,
    explanation,
    flags: flags.length ? flags : defaultFlags(tactic, isScam)
  };
}

export function validateRoundPayload(value: unknown): Message[] {
  const raw = Array.isArray(value) ? value : [];
  return raw.map(normalizeMessage).filter((item): item is Message => Boolean(item));
}

function tacticCounts(round: Message[]) {
  const scams = round.filter((message) => message.isScam).length;
  const legit = round.length - scams;
  return { scams, legit };
}

export function normalizeRound(round: Message[], { padFromSeed = true, desiredLength = 9 }: { padFromSeed?: boolean; desiredLength?: number } = {}) {
  const valid = round.slice(0, desiredLength);
  const usedIds = new Set(valid.map((message) => message.id));
  let result = [...valid];

  if (padFromSeed) {
    for (const fallback of seededRound) {
      if (result.length >= desiredLength) break;
      if (!usedIds.has(fallback.id)) {
        result.push(fallback);
        usedIds.add(fallback.id);
      }
    }
  }

  const counts = tacticCounts(result);
  if (result.length < 8 || counts.scams < 3 || counts.legit < 3) {
    const merged = [...result];
    for (const fallback of seededRound) {
      if (merged.length >= desiredLength) break;
      if (!merged.some((message) => message.id === fallback.id)) {
        merged.push(fallback);
      }
    }
    result = merged.slice(0, desiredLength);
  }

  return result.slice(0, desiredLength);
}

export function validateAndShapeRound(value: unknown) {
  return normalizeRound(validateRoundPayload(value));
}

export function shuffleRound(round: Message[]) {
  const copy = [...round];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function summarizeRoundState(round: Message[], answers: { id: string; correct: boolean; tactic: Tactic | null }[]) {
  const byTactic: Record<Tactic, { correct: number; total: number }> = {
    urgency: { correct: 0, total: 0 },
    authority: { correct: 0, total: 0 },
    fear: { correct: 0, total: 0 },
    greed: { correct: 0, total: 0 },
    familiarity: { correct: 0, total: 0 }
  };

  let correct = 0;
  for (const answer of answers) {
    const message = round.find((item) => item.id === answer.id);
    if (!message || !message.tactic) continue;
    byTactic[message.tactic].total += 1;
    if (answer.correct) byTactic[message.tactic].correct += 1;
    if (answer.correct) correct += 1;
  }

  const total = answers.length;
  const score = total ? Math.round((correct / total) * 100) : 0;

  let strongestTactic: Tactic | null = null;
  let weakestTactic: Tactic | null = null;
  let bestRate = -1;
  let worstRate = 101;

  for (const [tactic, stats] of Object.entries(byTactic) as [Tactic, { correct: number; total: number }][]) {
    if (!stats.total) continue;
    const rate = Math.round((stats.correct / stats.total) * 100);
    if (rate > bestRate) {
      bestRate = rate;
      strongestTactic = tactic;
    }
    if (rate < worstRate) {
      worstRate = rate;
      weakestTactic = tactic;
    }
  }

  return { score, correct, total, byTactic, strongestTactic, weakestTactic };
}

export function scoreHeadline(score: number) {
  if (score >= 80) return "Sharp eyes. Your scam radar is getting strong.";
  if (score >= 50) return "Good work. You are already catching the obvious tricks.";
  return "Every round makes you sharper. Keep practicing the pattern.";
}

export function tacticLabel(tactic: Tactic) {
  return tactic.charAt(0).toUpperCase() + tactic.slice(1);
}

export function formatServices(list: string[]) {
  if (!list.length) return "none";
  return list.join(", ");
}

export function formatProfileSummary(profile: Profile) {
  const hobbies = profile.hobbies.length ? profile.hobbies.join(", ") : "none";
  const services = formatServices(profile.services);
  return `${profile.firstName || "Your"} uses ${profile.bankName || "a credit union"}, enjoys ${hobbies}, knows ${profile.familyMember || "family"} (${profile.relation || "relative"}), and uses ${services}.`;
}

export function toDemoDigestText(
  profile: Profile,
  score: number,
  summary: ReturnType<typeof summarizeRoundState>,
  imageSummary?: { score: number; correct: number; total: number } | null
) {
  let text = `${profile.firstName}'s Scam Defense Report\nScore: ${score}/100`;
  if (summary.total) {
    text += `\nMessages faced: ${summary.total}\nSpotted: ${summary.correct}\nStrongest tactic: ${summary.strongestTactic ?? "n/a"}\nWeakest tactic: ${summary.weakestTactic ?? "n/a"}`;
  }
  if (imageSummary && imageSummary.total) {
    text += `\nPhoto & video check: ${imageSummary.correct}/${imageSummary.total} correct`;
  }
  return text;
}