import type { ImageAnswerRecord, ImageCategory, ImageItem, ImageScoreBreakdown } from "./types";

export const imageCategoryLabel: Record<ImageCategory, string> = {
  real: "Real Photo",
  ai: "AI-Generated",
  deepfake: "Deepfake"
};

export const imageRound: ImageItem[] = [
  {
    id: "img-real-1",
    category: "real",
    context: "Your grandson Bobby texts this photo: \"Look who I found at the shelter!\"",
    kind: "photo",
    photoSrc: "/images/real-1.jpg",
    photoAlt: "An ordinary phone photo of a dog outdoors",
    tells: [
      "Normal, uneven lighting from the sun",
      "Small imperfections in fur, background, and framing",
      "Detail stays consistent everywhere, even up close"
    ],
    explanation: "This is a plain, unedited phone photo. That everyday, slightly imperfect quality — nothing warped, nothing too smooth — is itself the good sign."
  },
  {
    id: "img-real-2",
    category: "real",
    context: "Your neighbor shares this photo from the farmers market: \"Look at these strawberries!\"",
    kind: "photo",
    photoSrc: "/images/real-2.jpg",
    photoAlt: "An ordinary phone photo of fresh strawberries",
    tells: [
      "Natural light and shadow across the whole scene",
      "No garbled text, logos, or signage",
      "Every berry looks a little different, the way real produce does"
    ],
    explanation: "A real photo like this holds up under a close look because a camera, not a computer, generated every pixel from something actually there."
  },
  {
    id: "img-ai-1",
    category: "ai",
    context: "A \"lonely widow selling her late husband's tools\" marketplace listing uses this profile photo.",
    kind: "illustrated",
    illustration: "profile",
    tells: [
      "Skin looks unnaturally smooth or waxy",
      "Earrings, glasses, or jewelry have melted or mismatched edges",
      "Background details blur or don't quite make sense",
      "Lighting on the face looks too perfect and even"
    ],
    explanation: "AI image generators nail faces at a glance but slip on fine detail — jewelry, stray hairs, and backgrounds often come out warped, even when the overall picture looks convincing."
  },
  {
    id: "img-ai-2",
    category: "ai",
    context: "A \"limited time\" online store shows this product photo of a heated blanket.",
    kind: "illustrated",
    illustration: "listing",
    tells: [
      "Text on packaging is garbled or made of nonsense letters",
      "Shadows fall in different directions on the same object",
      "Folds in fabric repeat in an unnatural pattern",
      "Reflections don't match what's in the scene"
    ],
    explanation: "AI-made product shots fake the look of real photography but usually slip up on text, shadows, and repeating patterns — details a real camera captures correctly without even trying."
  },
  {
    id: "img-deepfake-1",
    category: "deepfake",
    context: "A video call from \"your grandson\" asks you to wire money for bail, on a call that keeps cutting out.",
    kind: "illustrated",
    illustration: "videocall",
    tells: [
      "Mouth movement lags slightly behind the words",
      "Blinking looks too rare, too regular, or missing",
      "Edges around hair, ears, or glasses blur when he turns his head",
      "Pushes you to act on the call, before you can check separately"
    ],
    explanation: "Deepfake video swaps a face onto footage in real time, so the seams show most when the person moves — turning their head, blinking, or reacting quickly."
  },
  {
    id: "img-deepfake-2",
    category: "deepfake",
    context: "A video message from \"your bank's fraud department\" shows an officer confirming your account was hacked.",
    kind: "illustrated",
    illustration: "videocall",
    tells: [
      "Lighting on the face doesn't match the lighting behind them",
      "Skin tone shifts slightly between moments in the video",
      "Speech has no natural pauses or breaths",
      "Creates urgency so you act during the call instead of hanging up to check"
    ],
    explanation: "Scammers pair a deepfake video with urgency on purpose — the goal is to keep you on the call instead of hanging up and dialing the real number yourself."
  }
];

export type FieldGuideCategory = {
  id: ImageCategory;
  label: string;
  summary: string;
  signs: string[];
};

export const fieldGuideCategories: FieldGuideCategory[] = [
  {
    id: "real",
    label: "Real Photo",
    summary: "An actual, unedited photo or video captured by a camera of something that really happened.",
    signs: ["Normal, sometimes messy lighting and backgrounds", "Small imperfections: blur, glare, stray hairs", "Detail stays consistent everywhere you zoom in"]
  },
  {
    id: "ai",
    label: "AI-Generated Image",
    summary: "A still picture a computer invented from a text description — nobody ever took this photo.",
    signs: ["Garbled text, logos, or nonsense letters", "Warped hands, ears, jewelry, or background objects", "Shadows and reflections that don't match", "Skin or surfaces look too smooth or waxy"]
  },
  {
    id: "deepfake",
    label: "Deepfake Video or Photo",
    summary: "A real person's face or voice swapped onto footage of someone else, made to move and talk on command.",
    signs: ["Mouth movement doesn't quite match the words", "Blinking or head turns look stiff or glitchy", "Lighting on the face doesn't match the surroundings", "Creates urgency so you act before you can check"]
  }
];

export const fieldGuideGeneralTips: string[] = [
  "Pause before reacting — a real emergency allows a callback",
  "Call the person back on a number you already have, not one given to you in the message",
  "Zoom in on hands, ears, jewelry, and any background text",
  "Ask a question only the real person would know the answer to"
];

export function shuffleImageRound(round: ImageItem[]): ImageItem[] {
  const copy = [...round];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function summarizeImageRound(round: ImageItem[], answers: ImageAnswerRecord[]): ImageScoreBreakdown {
  const byCategory: Record<ImageCategory, { correct: number; total: number }> = {
    real: { correct: 0, total: 0 },
    ai: { correct: 0, total: 0 },
    deepfake: { correct: 0, total: 0 }
  };

  let correct = 0;
  for (const answer of answers) {
    const item = round.find((entry) => entry.id === answer.id);
    if (!item) continue;
    byCategory[item.category].total += 1;
    if (answer.correct) {
      byCategory[item.category].correct += 1;
      correct += 1;
    }
  }

  const total = answers.length;
  const score = total ? Math.round((correct / total) * 100) : 0;

  return { score, correct, total, byCategory };
}
