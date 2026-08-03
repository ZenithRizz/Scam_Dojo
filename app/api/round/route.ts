import { NextRequest, NextResponse } from "next/server";
import { sanitizeProfile, stripHtmlAndClamp } from "@/lib/validate";
import type { Profile } from "@/lib/types";

export const runtime = "edge";

function isOriginAllowed(request: NextRequest) {
  const origin = request.headers.get("origin") ?? request.headers.get("referer") ?? "";
  if (!origin) return true;
  return origin.startsWith(request.nextUrl.origin);
}

function buildSystemPrompt() {
  return [
    "You generate a practice round for Scam Dojo.",
    "Return only valid JSON with this structure: { round: [messages...] }.",
    "Create 9 messages total.",
    "4 or 5 messages should be scams and the rest legitimate.",
    "Each message must have: id, channel, sender, optional subject, body, isScam, tactic, explanation, flags.",
    "Use channels sms, email, or popup.",
    "Scam tactics are urgency, authority, fear, greed, or familiarity.",
    "Legitimate messages must use tactic null and trust-signal flags.",
    "Keep explanations warm, plain, and 1-3 sentences.",
    "Never include real phone numbers or working URLs.",
    "Do not mention medical emergencies involving named family members.",
    "Make the examples specific to the provided profile when natural.",
    "No markdown, no code fences, JSON only."
  ].join(" ");
}

function buildUserPrompt(profile: Profile) {
  return JSON.stringify(profile);
}

export async function POST(request: NextRequest) {
  if (!isOriginAllowed(request)) {
    return NextResponse.json({ error: "origin blocked" }, { status: 403 });
  }

  const raw = await request.text();
  if (raw.length > 4096) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  let parsed: { profile?: Profile } = {};
  try {
    parsed = JSON.parse(raw) as { profile?: Profile };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const apiKey = process.env.LLM_API_KEY;
  const apiUrl = process.env.LLM_API_URL ?? "https://api.openai.com/v1/chat/completions";
  const model = process.env.LLM_MODEL ?? "gpt-4o-mini";

  if (!apiKey) {
    return NextResponse.json({ error: "missing api key" }, { status: 503 });
  }

  const profile = sanitizeProfile(parsed.profile ?? { firstName: "", bankName: "", hobbies: [], familyMember: "", relation: "", services: [] });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.7,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildUserPrompt(profile) }
        ]
      })
    });

    if (!response.ok) {
      return NextResponse.json({ error: `upstream ${response.status}` }, { status: 502 });
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      output_text?: string;
    };

    const content = json.output_text ?? json.choices?.[0]?.message?.content ?? "";
    if (!content) {
      return NextResponse.json({ error: "empty response" }, { status: 502 });
    }

    return NextResponse.json({ content: stripHtmlAndClamp(content, 20000) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "upstream failure" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}