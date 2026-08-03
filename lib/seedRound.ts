import type { Message, Profile } from "./types";

export const seededProfile: Profile = {
  firstName: "Margaret",
  bankName: "First Community Credit Union",
  hobbies: ["gardening"],
  familyMember: "Bobby",
  relation: "grandson",
  services: ["Amazon", "Medicare", "utility company"]
};

export const seededRound: Message[] = [
  {
    id: "seed-1",
    channel: "sms",
    sender: "First Community Credit Union",
    body: "FCCU: Your account is locked for security. Verify in 30 minutes at secure-fccu-verify.com or your account will pause.",
    isScam: true,
    tactic: "urgency",
    explanation: "This text tries to rush you. Real banks do not push you to act fast through a text link.",
    flags: ["deadline pressure", "fake link", "asks for fast action"]
  },
  {
    id: "seed-2",
    channel: "email",
    sender: "Medicare Support",
    subject: "Annual coverage check-in",
    body: "We need you to confirm your Medicare details today to keep your card active. Open the secure form here: medicare-help-center.com.",
    isScam: true,
    tactic: "authority",
    explanation: "It borrows official language to sound important. A real program would not send a random link asking you to confirm details this way.",
    flags: ["official-sounding name", "link to verify", "pressure to comply"]
  },
  {
    id: "seed-3",
    channel: "popup",
    sender: "Browser Security Alert",
    body: "Warning: 5 viruses found on this device. Call support now to remove them before your photos are deleted.",
    isScam: true,
    tactic: "fear",
    explanation: "This popup tries to scare you into calling a number right away. Real device alerts do not use panic like this.",
    flags: ["panic message", "threat of loss", "pushes a call"]
  },
  {
    id: "seed-4",
    channel: "sms",
    sender: "Garden Club Prize Desk",
    body: "Margaret, your gardening club raffle entry won $500. Send a $20 processing fee to claim your prize today.",
    isScam: true,
    tactic: "greed",
    explanation: "It promises easy money to get you excited. Prize scams often ask for a fee before you can get anything back.",
    flags: ["too-good-to-be-true", "fee upfront", "claim today"]
  },
  {
    id: "seed-5",
    channel: "sms",
    sender: "Bobby",
    body: "Grandma, it's me with a new number. I'm in a hurry and need gift cards for a friend. Please don't call, just text back.",
    isScam: true,
    tactic: "familiarity",
    explanation: "The scammer pretends to be someone you know so you lower your guard. Real family asks in normal ways and does not block a call back.",
    flags: ["new number", "can't call back", "gift cards"]
  },
  {
    id: "seed-6",
    channel: "sms",
    sender: "Bobby",
    body: "Saw tomato stakes at the store and thought of you. Want me to swing by Sunday afternoon and help in the garden?",
    isScam: false,
    tactic: null,
    explanation: "This looks like a normal family text. It mentions something specific, asks no money, and does not push urgency.",
    flags: ["specific detail", "normal tone", "no money request"]
  },
  {
    id: "seed-7",
    channel: "email",
    sender: "First Community Credit Union",
    subject: "Your monthly statement is ready",
    body: "Hello Margaret, your monthly statement is ready to view in online banking. No action is needed unless you want to review it.",
    isScam: false,
    tactic: null,
    explanation: "The message is calm and expected. It does not pressure you, ask for a password, or send you to a strange link.",
    flags: ["calm tone", "expected statement", "no urgent request"]
  },
  {
    id: "seed-8",
    channel: "sms",
    sender: "Lakeview Pharmacy",
    body: "Your refill for blood pressure medicine is ready for pickup. Reply STOP to opt out of texts.",
    isScam: false,
    tactic: null,
    explanation: "This is a routine service reminder. It gives a normal opt-out line and does not ask for private information.",
    flags: ["routine reminder", "opt-out line", "no pressure"]
  },
  {
    id: "seed-9",
    channel: "popup",
    sender: "Browser",
    body: "Save password for this site? Yes / No",
    isScam: false,
    tactic: null,
    explanation: "This is a normal browser prompt, not a trick. It helps you decide whether to remember a login on your device.",
    flags: ["system prompt", "normal browser UI", "no request for money"]
  }
];