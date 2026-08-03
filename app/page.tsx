"use client";

import { useEffect, useMemo, useState } from "react";
import { generateRound } from "@/lib/generateRound";
import { seededProfile, seededRound } from "@/lib/seedRound";
import {
  fieldGuideCategories,
  fieldGuideGeneralTips,
  imageCategoryLabel,
  imageRound as imageRoundData,
  shuffleImageRound,
  summarizeImageRound
} from "@/lib/imageRound";
import {
  formatProfileSummary,
  scoreHeadline,
  shuffleRound,
  summarizeRoundState,
  tacticLabel,
  toDemoDigestText
} from "@/lib/validate";
import type {
  AnswerRecord,
  ImageAnswerRecord,
  ImageCategory,
  ImageItem,
  ImageScoreBreakdown,
  Illustration,
  Message,
  Profile,
  ScoreBreakdown,
  Tactic
} from "@/lib/types";

type Screen = "welcome" | "arena" | "setup" | "loading" | "playing" | "imageGuide" | "imageRound" | "summary" | "digest";

type TrainingLevel = {
  id: 1 | 2 | 3;
  title: string;
  label: string;
  description: string;
  messages: number;
  passScore: number;
};

const serviceOptions = ["Amazon", "Medicare", "utility company", "church/community group", "streaming", "none"];

const trainingLevels: TrainingLevel[] = [
  {
    id: 1,
    title: "Warm-Up",
    label: "Level 1",
    description: "A short round with the most obvious tricks.",
    messages: 5,
    passScore: 60
  },
  {
    id: 2,
    title: "Mixed Signals",
    label: "Level 2",
    description: "More messages, more balance, and fewer giveaways.",
    messages: 7,
    passScore: 75
  },
  {
    id: 3,
    title: "Boss Round",
    label: "Level 3",
    description: "No messages this time — just real, AI-generated, and deepfake photos and videos.",
    messages: 0,
    passScore: 85
  }
];

const emptyScore: ScoreBreakdown = {
  score: 0,
  correct: 0,
  total: 0,
  byTactic: {
    urgency: { correct: 0, total: 0 },
    authority: { correct: 0, total: 0 },
    fear: { correct: 0, total: 0 },
    greed: { correct: 0, total: 0 },
    familiarity: { correct: 0, total: 0 }
  },
  strongestTactic: null,
  weakestTactic: null
};

const loaderLines = [
  "Building your practice round… studying urgency tricks ✓",
  "Finding a few friendly messages to mix in ✓",
  "Tuning the coach notes so they stay simple ✓"
];

function emptyProfile(): Profile {
  return { firstName: "", bankName: "", hobbies: [], familyMember: "", relation: "", services: [] };
}

function clampField(value: string) {
  return value.replace(/<[^>]*>/g, "").replace(/[\r\n]+/g, " ").slice(0, 40);
}

function tacticTone(tactic: Tactic | null) {
  switch (tactic) {
    case "urgency":
      return "urgency";
    case "authority":
      return "authority";
    case "fear":
      return "fear";
    case "greed":
      return "greed";
    case "familiarity":
      return "familiarity";
    default:
      return "authority";
  }
}

function getLevel(levelId: number) {
  return trainingLevels.find((level) => level.id === levelId) ?? trainingLevels[0];
}

function shapeRoundForLevel(round: Message[], messages: number) {
  const scams = round.filter((message) => message.isScam);
  const real = round.filter((message) => !message.isScam);
  const scamTarget = Math.min(scams.length, Math.max(1, Math.round(messages * 0.6)));
  const realTarget = Math.min(real.length, Math.max(0, messages - scamTarget));

  const selected = [...scams.slice(0, scamTarget), ...real.slice(0, realTarget)];
  const usedIds = new Set(selected.map((message) => message.id));

  for (const message of round) {
    if (selected.length >= messages) break;
    if (!usedIds.has(message.id)) {
      selected.push(message);
      usedIds.add(message.id);
    }
  }

  return shuffleRound(selected.slice(0, messages));
}

function useDemoMode() {
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    setDemo(new URLSearchParams(window.location.search).has("demo"));
  }, []);
  return demo;
}

export default function Page() {
  const demoMode = useDemoMode();
  const [screen, setScreen] = useState<Screen>("welcome");
  const [profile, setProfile] = useState<Profile>(seededProfile);
  const [round, setRound] = useState<Message[]>([]);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [loadingHint, setLoadingHint] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupOrigin, setSetupOrigin] = useState<"welcome" | "arena">("welcome");
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [activeLevelId, setActiveLevelId] = useState<1 | 2 | 3>(1);
  const [highestUnlockedLevel, setHighestUnlockedLevel] = useState<1 | 2 | 3>(1);
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [imageAnswers, setImageAnswers] = useState<ImageAnswerRecord[]>([]);
  const [imageScore, setImageScore] = useState<ImageScoreBreakdown | null>(null);
  useEffect(() => {
    if (!demoMode) return;
    setProfile(seededProfile);
    setActiveLevelId(1);
    setHighestUnlockedLevel(1);
    setRound(shapeRoundForLevel(seededRound, getLevel(1).messages));
    setAnswers([]);
    setScore(null);
    setScreen("playing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  useEffect(() => {
    if (screen !== "loading") return;
    let index = 0;
    setLoadingHint(0);
    const timer = window.setInterval(() => {
      index = (index + 1) % loaderLines.length;
      setLoadingHint(index);
    }, 1800);
    return () => window.clearInterval(timer);
  }, [screen]);

  async function startLevel(levelId: 1 | 2 | 3, nextProfile: Profile, forceDemoRound = false) {
    const cleaned = {
      ...nextProfile,
      firstName: clampField(nextProfile.firstName),
      bankName: clampField(nextProfile.bankName),
      hobbies: nextProfile.hobbies.map(clampField).filter(Boolean),
      familyMember: clampField(nextProfile.familyMember),
      relation: clampField(nextProfile.relation),
      services: nextProfile.services.map(clampField).filter(Boolean)
    } satisfies Profile;

    if (!cleaned.firstName) {
      setSetupError("Please add your first name.");
      return;
    }

    setSetupError(null);
    setProfile(cleaned);
    setActiveLevelId(levelId);

    if (levelId === 3) {
      setRound([]);
      setAnswers([]);
      setScore(emptyScore);
      setImageItems(shuffleImageRound(imageRoundData));
      setImageAnswers([]);
      setImageScore(null);
      setScreen("imageGuide");
      return;
    }

    setScreen("loading");

    const level = getLevel(levelId);

    if (forceDemoRound) {
      setRound(shapeRoundForLevel(seededRound, level.messages));
      setAnswers([]);
      setScore(null);
      setScreen("playing");
      return;
    }

    const result = await generateRound(cleaned, { demoMode: demoMode });
    const shapedRound = shapeRoundForLevel(result.round, level.messages);
    setRound(shapedRound);
    setScreen("playing");
  }

  function handleDemoStart() {
    void startLevel(1, seededProfile, true);
  }

  function handleRoundComplete(nextAnswers: AnswerRecord[]) {
    const nextScore = summarizeRoundState(round, nextAnswers);
    setAnswers(nextAnswers);
    setScore(nextScore);
    const currentLevel = getLevel(activeLevelId);
    if (nextScore.score >= currentLevel.passScore && activeLevelId < 3) {
      setHighestUnlockedLevel((current) => (activeLevelId + 1 > current ? (activeLevelId + 1) as 1 | 2 | 3 : current));
    }
    setImageScore(null);
    setScreen("summary");
  }

  function handleImageRoundComplete(nextAnswers: ImageAnswerRecord[]) {
    const nextImageScore = summarizeImageRound(imageItems, nextAnswers);
    setImageAnswers(nextAnswers);
    setImageScore(nextImageScore);
    setScreen("summary");
  }

  function beginSetup(origin: "welcome" | "arena") {
    setSetupError(null);
    setSetupOrigin(origin);
    setScreen("setup");
  }

  function startSelectedLevel(levelId: 1 | 2 | 3) {
    void startLevel(levelId, profile);
  }

  const currentLevel = getLevel(activeLevelId);

  const combined = useMemo(() => {
    if (!score) return null;
    if (!imageScore) return { score: score.score, correct: score.correct, total: score.total };
    const total = score.total + imageScore.total;
    const correct = score.correct + imageScore.correct;
    return { score: total ? Math.round((correct / total) * 100) : 0, correct, total };
  }, [score, imageScore]);

  const summaryText = useMemo(() => {
    if (!score || !combined) return "";
    return `${profile.firstName}'s Scam Defense Report\nScore: ${combined.score}/100\nItems faced: ${combined.total}\nSpotted: ${combined.correct}`;
  }, [profile.firstName, score, combined]);

  async function copyDigest() {
    const text = score && combined ? toDemoDigestText(profile, combined.score, score, imageScore) : summaryText;
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
      setToast("Couldn't copy — long-press the text to select it.");
    }
  }

  async function shareDigest() {
    if (!score || !combined) return;
    const text = toDemoDigestText(profile, combined.score, score, imageScore);
    if (navigator.share) {
      await navigator.share({ title: "Scam Dojo", text });
    } else {
      await copyDigest();
    }
  }

  return (
    <main className="page">
      <div className="shell stack">
        {screen === "welcome" && (
          <WelcomeScreen
            onStart={() => beginSetup("welcome")}
            onDemo={() => {
              void handleDemoStart();
            }}
          />
        )}

        {screen === "arena" && (
          <ArenaScreen
            profile={profile}
            highestUnlockedLevel={highestUnlockedLevel}
            onBack={() => setScreen("welcome")}
            onHome={() => setScreen("welcome")}
            onCustomize={() => beginSetup("arena")}
            onStartLevel={startSelectedLevel}
          />
        )}

        {screen === "setup" && (
          <SetupScreen
            initialProfile={profile}
            error={setupError}
            onHome={() => setScreen("welcome")}
            onBack={() => setScreen(setupOrigin)}
            onStart={(nextProfile) => void startLevel(activeLevelId, nextProfile)}
            onSkip={() => void startLevel(activeLevelId, { ...seededProfile, firstName: profile.firstName || seededProfile.firstName })}
          />
        )}

        {screen === "loading" && <LoadingScreen line={loaderLines[loadingHint]} onHome={() => setScreen("welcome")} />}

        {screen === "playing" && round.length > 0 && <RoundScreen round={round} level={currentLevel} onHome={() => setScreen("welcome")} onComplete={handleRoundComplete} />}

        {screen === "imageGuide" && <ImageGuideScreen onHome={() => setScreen("welcome")} onContinue={() => setScreen("imageRound")} />}

        {screen === "imageRound" && imageItems.length > 0 && (
          <ImageRoundScreen items={imageItems} onHome={() => setScreen("welcome")} onComplete={handleImageRoundComplete} />
        )}

        {screen === "summary" && score && combined && (
          <SummaryScreen
            profile={profile}
            score={score}
            imageScore={imageScore}
            combined={combined}
            round={round}
            answers={answers}
            level={currentLevel}
            canAdvance={activeLevelId < 3 && combined.score >= currentLevel.passScore}
            nextLevel={activeLevelId < 3 ? getLevel((activeLevelId + 1) as 1 | 2 | 3) : null}
            onHome={() => setScreen("welcome")}
            onDigest={() => setScreen("digest")}
            onTrainAgain={() => void startLevel(activeLevelId, profile)}
            onBackToArena={() => setScreen("arena")}
            onNextLevel={activeLevelId < 3 ? () => void startLevel((activeLevelId + 1) as 1 | 2 | 3, profile) : undefined}
          />
        )}

        {screen === "digest" && score && combined && (
          <DigestScreen
            profile={profile}
            score={score}
            imageScore={imageScore}
            combined={combined}
            level={currentLevel}
            copyState={copyState}
            summaryText={summaryText}
            onHome={() => setScreen("welcome")}
            onCopy={copyDigest}
            onShare={shareDigest}
            onBack={() => setScreen("summary")}
            onTrainAgain={() => void startLevel(activeLevelId, profile)}
          />
        )}
      </div>

      {toast && (
        <button className="toast" onClick={() => setToast(null)} type="button">
          {toast}
        </button>
      )}
    </main>
  );
}

function WelcomeScreen({ onStart, onDemo }: { onStart: () => void; onDemo: () => void }) {
  return (
    <section className="hero gridTwo">
      <div className="stack">
        <div className="brandRow">
          <div className="logoMark">SD</div>
          <div>
            <div className="brandName">Scam Dojo</div>
            <div className="smallCaps">Practice before they call</div>
          </div>
        </div>
        <div className="panel stack">
          <p className="trustline">Free · Private · Nothing to install</p>
          <h1 className="headline">Practice spotting scams before scammers find you.</h1>
          <p className="subhead">A senior-friendly training game with realistic practice messages, instant coaching, and a family share card at the end.</p>
          <div className="buttonRow">
            <button className="primaryButton" onClick={onStart} type="button">Start Training</button>
            <button className="secondaryButton" onClick={onDemo} type="button">Open Demo Round</button>
          </div>
        </div>
      </div>
      <div className="panel stack">
        <div className="smallCaps">Why this exists</div>
        <p className="bodyText">Every filter judges the message after it arrives. Scam Dojo trains the person first so the next real scam feels familiar, not confusing.</p>
        <div className="metricCard">
          <strong>Built for older adults</strong>
          <span className="muted">Large type, huge tap targets, clear feedback, and no timer.</span>
        </div>
        <div className="metricCard">
          <strong>Family-friendly</strong>
          <span className="muted">The digest screen is designed to be screenshot and shared, not buried in a dashboard.</span>
        </div>
      </div>
    </section>
  );
}

function ArenaScreen({
  profile,
  highestUnlockedLevel,
  onBack,
  onHome,
  onCustomize,
  onStartLevel
}: {
  profile: Profile;
  highestUnlockedLevel: 1 | 2 | 3;
  onBack: () => void;
  onHome: () => void;
  onCustomize: () => void;
  onStartLevel: (levelId: 1 | 2 | 3) => void;
}) {
  return (
    <section className="panel stack">
      <div className="screenHeader">
        <div className="stack" style={{ gap: 6 }}>
          <div className="buttonRow" style={{ gridTemplateColumns: "auto auto", justifyContent: "start" }}>
            <button className="iconButton" onClick={onBack} type="button" aria-label="Back to welcome">←</button>
            <button className="textButton" onClick={onHome} type="button">Home</button>
          </div>
          <div className="smallCaps">Training Arena</div>
          <h1 className="headline" style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>Choose your level, {profile.firstName || "friend"}.</h1>
        </div>
        <div className="progressChip">{highestUnlockedLevel === 3 ? "All levels unlocked" : `Level ${highestUnlockedLevel} unlocked`}</div>
      </div>

      <p className="subhead">Each level gets a little longer and a little trickier. Start where it feels comfortable, then move up.</p>

      <div className="arenaGrid">
        {trainingLevels.map((level) => {
          const unlocked = level.id <= highestUnlockedLevel;
          return (
            <article key={level.id} className="levelCard" data-locked={!unlocked}>
              <div className="screenHeader">
                <div>
                  <div className="smallCaps">{level.label}</div>
                  <strong style={{ fontSize: "1.15rem" }}>{level.title}</strong>
                </div>
                <div className="statusChip" data-tone={unlocked ? "good" : "warn"}>{unlocked ? "Open" : "Locked"}</div>
              </div>
              <p className="bodyText">{level.description}</p>
              <div className="metricGrid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                <div className="metricCard">
                  <strong>{level.id === 3 ? 6 : level.messages}</strong>
                  <span className="muted">{level.id === 3 ? "photos & videos" : "messages"}</span>
                </div>
                <div className="metricCard"><strong>{level.passScore}+</strong><span className="muted">to clear</span></div>
              </div>
              <button className="primaryButton" onClick={() => onStartLevel(level.id)} disabled={!unlocked} type="button">
                {unlocked ? `Enter ${level.title}` : `Finish Level ${level.id - 1} first`}
              </button>
            </article>
          );
        })}
      </div>

      <div className="buttonRow">
        <button className="secondaryButton" onClick={onCustomize} type="button">Customize profile</button>
        <div className="muted">Current profile: {profile.firstName || "sample setup"}</div>
      </div>
    </section>
  );
}

function SetupScreen({
  initialProfile,
  error,
  onHome,
  onBack,
  onStart,
  onSkip
}: {
  initialProfile: Profile;
  error: string | null;
  onHome: () => void;
  onBack: () => void;
  onStart: (profile: Profile) => void;
  onSkip: () => void;
}) {
  const [profile, setProfile] = useState(initialProfile);

  function updateField(field: keyof Profile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function toggleService(value: string) {
    setProfile((current) => {
      const exists = current.services.includes(value);
      const next = exists ? current.services.filter((item) => item !== value) : [...current.services.filter((item) => item !== "none"), value];
      return { ...current, services: value === "none" ? ["none"] : next.filter((item) => item !== "none") };
    });
  }

  return (
    <section className="panel stack">
      <div className="screenHeader">
        <div className="stack" style={{ gap: 6 }}>
          <div className="buttonRow" style={{ gridTemplateColumns: "auto auto", justifyContent: "start" }}>
            <button className="iconButton" onClick={onBack} type="button" aria-label="Back to welcome">←</button>
            <button className="textButton" onClick={onHome} type="button">Home</button>
          </div>
          <div className="smallCaps">Dojo Setup</div>
          <h1 className="headline" style={{ fontSize: "clamp(1.8rem, 4vw, 2.7rem)" }}>Let&apos;s make your training feel real.</h1>
        </div>
        <div className="progressChip">Takes about a minute</div>
      </div>

      <div className="fieldGrid">
        <label className="field full">
          <span>First name *</span>
          <input value={profile.firstName} onChange={(event) => updateField("firstName", event.target.value.slice(0, 40))} placeholder="Margaret" maxLength={40} />
          {error && <span className="fieldError">{error}</span>}
        </label>
        <label className="field full">
          <span>Bank or credit union</span>
          <input value={profile.bankName} onChange={(event) => updateField("bankName", event.target.value.slice(0, 40))} placeholder="First Community Credit Union" maxLength={40} />
        </label>
        <label className="field">
          <span>One hobby</span>
          <input value={profile.hobbies[0] ?? ""} onChange={(event) => setProfile((current) => ({ ...current, hobbies: [event.target.value.slice(0, 40), current.hobbies[1] ?? ""] }))} placeholder="gardening" maxLength={40} />
        </label>
        <label className="field">
          <span>Another hobby</span>
          <input value={profile.hobbies[1] ?? ""} onChange={(event) => setProfile((current) => ({ ...current, hobbies: [current.hobbies[0] ?? "", event.target.value.slice(0, 40)] }))} placeholder="bridge" maxLength={40} />
        </label>
        <label className="field">
          <span>Family member name</span>
          <input value={profile.familyMember} onChange={(event) => updateField("familyMember", event.target.value.slice(0, 40))} placeholder="Bobby" maxLength={40} />
        </label>
        <label className="field">
          <span>Relation</span>
          <input value={profile.relation} onChange={(event) => updateField("relation", event.target.value.slice(0, 40))} placeholder="grandson" maxLength={40} />
        </label>
        <div className="field full">
          <span>Services you use</span>
          <div className="chipGroup">
            {serviceOptions.map((option) => (
              <button key={option} className="chipButton" data-selected={profile.services.includes(option)} onClick={() => toggleService(option)} type="button">
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="stack">
        <p className="muted">Stays on this device — only used to build your practice round.</p>
        <div className="buttonRow">
          <button className="primaryButton" onClick={() => onStart(profile)} type="button">Start Training</button>
          <button className="textButton" onClick={onSkip} type="button">Skip the details</button>
        </div>
      </div>
    </section>
  );
}

function LoadingScreen({ line, onHome }: { line: string; onHome: () => void }) {
  return (
    <section className="panel stack">
      <div className="buttonRow" style={{ gridTemplateColumns: "auto auto", justifyContent: "start" }}>
        <div className="smallCaps">One moment</div>
        <button className="textButton" onClick={onHome} type="button">Home</button>
      </div>
      <h1 className="headline" style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>Building your practice round…</h1>
      <div className="loaderLines">
        <div className="loaderLine"><span className="spinner" />{line}</div>
        <div className="loaderLine"><span className="spinner" />No spinner wall. You&apos;re almost in.</div>
      </div>
    </section>
  );
}

function RoundScreen({ round, level, onHome, onComplete }: { round: Message[]; level: TrainingLevel; onHome: () => void; onComplete: (answers: AnswerRecord[]) => void }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState<AnswerRecord | null>(null);
  const [locked, setLocked] = useState(false);

  const message = round[index];
  const isFinal = index === round.length - 1;

  function answer(userSaidScam: boolean) {
    if (locked || !message) return;
    setLocked(true);
    const correct = userSaidScam === message.isScam;
    const nextAnswer: AnswerRecord = { id: message.id, userSaidScam, correct, tactic: message.tactic };
    const nextAnswers = [...answers, nextAnswer];
    setAnswers(nextAnswers);
    setCurrentAnswer(nextAnswer);
  }

  function next() {
    if (isFinal) {
      onComplete(answers);
      return;
    }
    setIndex((current) => current + 1);
    setCurrentAnswer(null);
    setLocked(false);
  }

  const verdict = currentAnswer
    ? currentAnswer.correct
      ? { tone: "good" as const, icon: "✓", text: "You spotted it!" }
      : { tone: "warn" as const, icon: "○", text: "Good try — this one's sneaky" }
    : null;

  if (!message) {
    return null;
  }

  const phoneMode = level.id >= 2;

  const content = (
    <>
      <div className="screenHeader">
        <div className="buttonRow" style={{ gridTemplateColumns: "auto auto", justifyContent: "start" }}>
          <div className="progressChip">Message {index + 1} of {round.length}</div>
          <button className="textButton" onClick={onHome} type="button">Home</button>
        </div>
        <div className="scoreChip">{answers.filter((item) => item.correct).length} correct</div>
      </div>

      <div className="messageCard" data-channel={message.channel}>
        <div className="messageHeader">
          <div>
            <div className="smallCaps">Incoming message</div>
            <div className="smallCaps">{message.channel}</div>
            <strong>{message.sender}</strong>
            {message.subject && <div className="messageMeta">{message.subject}</div>}
          </div>
          <div className="statusChip" data-tone="neutral">Practice message</div>
        </div>

        {message.channel === "sms" && <div className="smsBubble bodyText">{message.body}</div>}
        {message.channel === "email" && (
          <div className="emailFrame">
            <div className="emailTop"><strong>{message.sender}</strong>{message.subject ? <div className="messageMeta">{message.subject}</div> : null}</div>
            <div className="emailBody bodyText">{message.body}</div>
          </div>
        )}
        {message.channel === "popup" && (
          <div className="popupFrame">
            <div className="popupChrome"><span className="popupDot" /><span>System message</span></div>
            <div className="popupBody bodyText">{message.body}</div>
          </div>
        )}

        {verdict && <div className="verdictBox" data-tone={verdict.tone}>{verdict.icon} {verdict.text}</div>}

        <div className="answerGrid">
          <button className="answerButton" data-choice="real" disabled={locked} onClick={() => answer(false)} type="button">✅ Real</button>
          <button className="answerButton" data-choice="scam" disabled={locked} onClick={() => answer(true)} type="button">🚫 Scam</button>
        </div>
      </div>

      {currentAnswer && (
        <CoachCard message={message} answer={currentAnswer} onNext={next} />
      )}
    </>
  );

  if (!phoneMode) {
    return <section className="stack">{content}</section>;
  }

  return (
    <section className="phoneStage">
      <div className="phoneShell">
        <div className="phoneTopBar">
          <button className="textButton" onClick={onHome} type="button" style={{ color: "rgba(255,255,255,0.9)", padding: 0, minHeight: "auto" }}>Home</button>
          <span>9:41</span>
          <span className="phoneSignals">5G · 100%</span>
        </div>
        <div className="phoneApp">
          <div className="phoneAppHeader">
            <div>
              <div className="smallCaps">Incoming message</div>
              <div className="smallCaps">Training phone</div>
              <strong>{level.label}</strong>
            </div>
            <div className="statusChip" data-tone="good">Hands-on mode</div>
          </div>
          {content}
        </div>
        <div className="phoneHomeBar" />
      </div>
    </section>
  );
}

function CoachCard({ message, answer, onNext }: { message: Message; answer: AnswerRecord; onNext: () => void }) {
  const tone = answer.correct ? "good" : "warn";
  const badgeTone = tacticTone(message.tactic);
  const flags = message.flags;
  return (
    <div className="coachCard">
      <div className="coachBadge" data-tactic={badgeTone}>
        {message.tactic ? `${tacticLabel(message.tactic)} tactic` : "Trust signals"}
      </div>
      <div className="bodyText">{message.explanation}</div>
      <ul className="bulletList">
        {flags.map((flag) => <li key={flag}>{flag}</li>)}
      </ul>
      <div className="buttonRow">
        <div className="statusChip" data-tone={tone}>{answer.correct ? "Correct" : "Sneaky one"}</div>
        <button className="primaryButton" onClick={onNext} type="button">Next message</button>
      </div>
    </div>
  );
}

function ImageGuideScreen({ onHome, onContinue }: { onHome: () => void; onContinue: () => void }) {
  return (
    <section className="panel stack">
      <div className="buttonRow" style={{ gridTemplateColumns: "auto auto", justifyContent: "start" }}>
        <div className="smallCaps">Level 3 · Photo & Video Check</div>
        <button className="textButton" onClick={onHome} type="button">Home</button>
      </div>
      <h1 className="headline" style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>Spot the fake before you trust it.</h1>
      <p className="subhead">Scammers now use photos and videos, not just messages. Here&apos;s what to look for before you decide what&apos;s real.</p>

      <div className="guideGrid">
        {fieldGuideCategories.map((category) => (
          <div key={category.id} className="metricCard guideCard" data-tone={imageCategoryTone(category.id)}>
            <div className="statusChip" data-tone={imageCategoryTone(category.id)}>{category.label}</div>
            <p className="bodyText">{category.summary}</p>
            <ul className="bulletList">
              {category.signs.map((sign) => <li key={sign}>{sign}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <div className="coachCard">
        <div className="coachBadge" data-tactic="authority">Before you decide</div>
        <ul className="bulletList">
          {fieldGuideGeneralTips.map((tip) => <li key={tip}>{tip}</li>)}
        </ul>
      </div>

      <div className="buttonRow">
        <button className="primaryButton" onClick={onContinue} type="button">Start the Photo & Video Check</button>
      </div>
    </section>
  );
}

function imageCategoryTone(category: ImageCategory) {
  if (category === "real") return "good";
  if (category === "ai") return "warn";
  return "bad";
}

function IllustratedMedia({ illustration }: { illustration: Illustration }) {
  if (illustration === "profile") {
    return (
      <div className="mediaFrame mediaFrame--profile">
        <div className="mediaAvatar" />
        <div className="mediaProfileLines">
          <div className="mediaLine" style={{ width: "62%" }} />
          <div className="mediaLine" style={{ width: "40%" }} />
        </div>
      </div>
    );
  }
  if (illustration === "listing") {
    return (
      <div className="mediaFrame mediaFrame--listing">
        <div className="mediaListingImage" />
        <div className="mediaListingTag">$24.99</div>
      </div>
    );
  }
  return (
    <div className="mediaFrame mediaFrame--videocall">
      <div className="mediaVideoChrome"><span className="mediaLiveDot" />Live video</div>
      <div className="mediaVideoFace" />
    </div>
  );
}

function ImageRoundScreen({ items, onHome, onComplete }: { items: ImageItem[]; onHome: () => void; onComplete: (answers: ImageAnswerRecord[]) => void }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<ImageAnswerRecord[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState<ImageAnswerRecord | null>(null);
  const [locked, setLocked] = useState(false);

  const item = items[index];
  const isFinal = index === items.length - 1;

  function answer(userSaidCategory: ImageCategory) {
    if (locked || !item) return;
    setLocked(true);
    const correct = userSaidCategory === item.category;
    const nextAnswer: ImageAnswerRecord = { id: item.id, userSaidCategory, correct, category: item.category };
    const nextAnswers = [...answers, nextAnswer];
    setAnswers(nextAnswers);
    setCurrentAnswer(nextAnswer);
  }

  function next() {
    if (isFinal) {
      onComplete(answers);
      return;
    }
    setIndex((current) => current + 1);
    setCurrentAnswer(null);
    setLocked(false);
  }

  if (!item) return null;

  const verdict = currentAnswer
    ? currentAnswer.correct
      ? { tone: "good" as const, icon: "✓", text: "You spotted it!" }
      : { tone: "warn" as const, icon: "○", text: "Good try — this one's sneaky" }
    : null;

  return (
    <section className="stack">
      <div className="screenHeader">
        <div className="buttonRow" style={{ gridTemplateColumns: "auto auto", justifyContent: "start" }}>
          <div className="progressChip">Item {index + 1} of {items.length}</div>
          <button className="textButton" onClick={onHome} type="button">Home</button>
        </div>
        <div className="scoreChip">{answers.filter((entry) => entry.correct).length} correct</div>
      </div>

      <div className="messageCard">
        <div className="messageHeader">
          <div>
            <div className="smallCaps">Photo & video check</div>
            <strong className="bodyText">{item.context}</strong>
          </div>
          <div className="statusChip" data-tone="neutral">Practice item</div>
        </div>

        {item.kind === "photo" ? (
          <div className="mediaFrame mediaFrame--photo">
            <img src={item.photoSrc} alt={item.photoAlt ?? ""} />
          </div>
        ) : (
          <IllustratedMedia illustration={item.illustration ?? "profile"} />
        )}

        {verdict && <div className="verdictBox" data-tone={verdict.tone}>{verdict.icon} {verdict.text}</div>}

        <div className="answerGrid answerGrid--triple">
          <button className="answerButton" data-choice="real" disabled={locked} onClick={() => answer("real")} type="button">✅ Real</button>
          <button className="answerButton" data-choice="ai" disabled={locked} onClick={() => answer("ai")} type="button">🖼️ AI-Made</button>
          <button className="answerButton" data-choice="deepfake" disabled={locked} onClick={() => answer("deepfake")} type="button">🎭 Deepfake</button>
        </div>
      </div>

      {currentAnswer && <ImageCoachCard item={item} answer={currentAnswer} onNext={next} />}
    </section>
  );
}

function ImageCoachCard({ item, answer, onNext }: { item: ImageItem; answer: ImageAnswerRecord; onNext: () => void }) {
  const tone = answer.correct ? "good" : "warn";
  return (
    <div className="coachCard">
      <div className="coachBadge" data-tactic={item.category === "real" ? "familiarity" : item.category === "ai" ? "greed" : "fear"}>
        {imageCategoryLabel[item.category]}
      </div>
      <div className="bodyText">{item.explanation}</div>
      <ul className="bulletList">
        {item.tells.map((tell) => <li key={tell}>{tell}</li>)}
      </ul>
      <div className="buttonRow">
        <div className="statusChip" data-tone={tone}>{answer.correct ? "Correct" : "Sneaky one"}</div>
        <button className="primaryButton" onClick={onNext} type="button">Next item</button>
      </div>
    </div>
  );
}

function SummaryScreen({
  profile,
  score,
  imageScore,
  combined,
  round,
  answers,
  level,
  canAdvance,
  nextLevel,
  onHome,
  onDigest,
  onTrainAgain,
  onBackToArena,
  onNextLevel
}: {
  profile: Profile;
  score: ScoreBreakdown;
  imageScore: ImageScoreBreakdown | null;
  combined: { score: number; correct: number; total: number };
  round: Message[];
  answers: AnswerRecord[];
  level: TrainingLevel;
  canAdvance: boolean;
  nextLevel: TrainingLevel | null;
  onHome: () => void;
  onDigest: () => void;
  onTrainAgain: () => void;
  onBackToArena: () => void;
  onNextLevel?: () => void;
}) {
  return (
    <section className="summaryGrid">
      <div className="panel stack">
        <div className="buttonRow" style={{ gridTemplateColumns: "auto auto", justifyContent: "start" }}>
          <button className="textButton" onClick={onHome} type="button">Home</button>
          <button className="textButton" onClick={onBackToArena} type="button">Back to arena</button>
        </div>
        <div className="smallCaps">{level.label} summary</div>
        <h1 className="headline" style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>Nice work, {profile.firstName || "friend"}.</h1>
        <div className="summaryScore">{combined.score}</div>
        <div className="bodyText">Scam-Proof Score</div>
        <p className="subhead">{scoreHeadline(combined.score)}</p>
        {canAdvance && nextLevel && <div className="verdictBox" data-tone="good">Unlocked {nextLevel.label}: {nextLevel.title}</div>}
        <div className="metricGrid">
          <div className="metricCard"><strong>{combined.correct}</strong><span className="muted">Correct answers</span></div>
          <div className="metricCard"><strong>{combined.total}</strong><span className="muted">Items faced</span></div>
          {level.id !== 3 && (
            <>
              <div className="metricCard"><strong>{score.strongestTactic ?? "n/a"}</strong><span className="muted">Best tactic</span></div>
              <div className="metricCard"><strong>{score.weakestTactic ?? "n/a"}</strong><span className="muted">Needs another pass</span></div>
            </>
          )}
        </div>
      </div>
      <div className="panel stack">
        {level.id !== 3 && (
          <>
            <div className="smallCaps">Per tactic</div>
            <div className="bars">
              {Object.entries(score.byTactic).map(([tactic, stats]) => {
                const percent = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
                return (
                  <div key={tactic} className="barRow">
                    <div className="screenHeader">
                      <strong>{tacticLabel(tactic as Tactic)}</strong>
                      <span className="muted">{stats.correct}/{stats.total}</span>
                    </div>
                    <div className="barTrack"><div className="barFill" style={{ width: `${percent}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {imageScore && (
          <>
            <div className="smallCaps">Photo & video check</div>
            <div className="bars">
              {Object.entries(imageScore.byCategory).map(([category, stats]) => {
                const percent = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
                return (
                  <div key={category} className="barRow">
                    <div className="screenHeader">
                      <strong>{imageCategoryLabel[category as ImageCategory]}</strong>
                      <span className="muted">{stats.correct}/{stats.total}</span>
                    </div>
                    <div className="barTrack"><div className="barFill" style={{ width: `${percent}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <div className="buttonRow">
          <button className="primaryButton" onClick={onDigest} type="button">Share with family</button>
          <button className="secondaryButton" onClick={onTrainAgain} type="button">Train again</button>
        </div>
        <div className="buttonRow">
          {onNextLevel && <button className="textButton" onClick={onNextLevel} type="button">Next level</button>}
        </div>
      </div>
    </section>
  );
}

function DigestScreen({
  profile,
  score,
  imageScore,
  combined,
  level,
  copyState,
  summaryText,
  onHome,
  onCopy,
  onShare,
  onBack,
  onTrainAgain
}: {
  profile: Profile;
  score: ScoreBreakdown;
  imageScore: ImageScoreBreakdown | null;
  combined: { score: number; correct: number; total: number };
  level: TrainingLevel;
  copyState: "idle" | "copied" | "failed";
  summaryText: string;
  onHome: () => void;
  onCopy: () => void;
  onShare: () => void;
  onBack: () => void;
  onTrainAgain: () => void;
}) {
  return (
    <section className="digestGrid">
      <div className="digestCard stack">
        <div className="digestStamp">Scam Dojo Family Report</div>
        <h1 className="digestTitle">{profile.firstName}&apos;s Scam Defense Report</h1>
        <p className="subhead">A screenshot-friendly summary for the family chat.</p>
        <div className="digestStats">
          <div className="digestStat"><div className="smallCaps">Score</div><strong className="summaryScore" style={{ fontSize: "clamp(2.6rem, 6vw, 4rem)" }}>{combined.score}</strong></div>
          <div className="digestStat"><div className="smallCaps">Items faced</div><strong>{combined.total}</strong></div>
          {level.id !== 3 && (
            <>
              <div className="digestStat"><div className="smallCaps">Best tactic</div><strong>{score.strongestTactic ?? "n/a"}</strong></div>
              <div className="digestStat"><div className="smallCaps">Hardest tactic</div><strong>{score.weakestTactic ?? "n/a"}</strong></div>
            </>
          )}
          {imageScore && (
            <div className="digestStat"><div className="smallCaps">Photo & video check</div><strong>{imageScore.correct}/{imageScore.total}</strong></div>
          )}
        </div>
        <div className="panel compact">
          <div className="smallCaps">Share text</div>
          <div className="bodyText" style={{ userSelect: "text" }}>{summaryText}</div>
        </div>
      </div>
      <div className="panel stack">
        <div className="buttonRow" style={{ gridTemplateColumns: "auto auto", justifyContent: "start" }}>
          <button className="textButton" onClick={onHome} type="button">Home</button>
          <button className="textButton" onClick={onBack} type="button">Back to my score</button>
        </div>
        <div className="smallCaps">Actions</div>
        <div className="buttonRow">
          <button className="primaryButton" onClick={onCopy} type="button">{copyState === "copied" ? "Copied ✓" : "Copy summary"}</button>
          <button className="secondaryButton" onClick={onShare} type="button">Share</button>
        </div>
        <button className="textButton" onClick={onTrainAgain} type="button">Train again</button>
        {copyState === "failed" && <p className="fieldError">Couldn&apos;t copy — long-press the text to select it.</p>}
        <p className="muted">No backend, no email, and no stored history. This card is meant to be screenshotted or shared directly from the device.</p>
        <div className="metricCard">
          <strong>Why this matters</strong>
          <span className="muted">Families can see progress without policing messages one by one.</span>
        </div>
      </div>
    </section>
  );
}