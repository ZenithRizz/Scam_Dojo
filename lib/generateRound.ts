import { seededRound } from "./seedRound";
import { sanitizeProfile, stripCodeFences, validateAndShapeRound } from "./validate";
import type { Profile, RoundGenerationResult } from "./types";

const TIMEOUT_MS = 15_000;

export async function generateRound(profile: Profile, options?: { demoMode?: boolean }): Promise<RoundGenerationResult> {
  if (options?.demoMode) {
    return { round: seededRound, usedFallback: false };
  }

  const sanitizedProfile = sanitizeProfile(profile);
  const payload = JSON.stringify({ profile: sanitizedProfile });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
      const response = await fetch("/api/round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        signal: controller.signal
      });
      window.clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Round generation failed with ${response.status}`);
      }

      const json = (await response.json()) as { round?: unknown; content?: unknown };
      const raw = typeof json.content === "string" ? json.content : json.round;
      const parsed = typeof raw === "string" ? JSON.parse(stripCodeFences(raw)) : raw;
      const round = validateAndShapeRound(parsed);

      if (round.length >= 8) {
        return { round, usedFallback: false };
      }
    } catch {
      if (attempt === 1) {
        return { round: seededRound, usedFallback: true };
      }
    }
  }

  return { round: seededRound, usedFallback: true };
}