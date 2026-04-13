/**
 * FrameAI — CTA template banks, one per CtaGoal.
 *
 * Slot tokens:
 *   {{topic}}     — primary topic phrase (1–3 words)
 *   {{keyword}}   — dominant keyword
 *   {{benefit}}   — short benefit / outcome phrase
 *   {{qualifier}} — preset-driven qualifier ("complimentary", "free", etc.)
 *   {{urgency}}   — urgency suffix ("today", "now", "this week", or "")
 *   {{verb}}      — business-type action verb ("Book", "Start", "Request")
 *
 * Design rules:
 *   - All templates ≤ 60 characters when slots contain short values
 *   - Imperative mood: verb-first or noun-first with implied imperative
 *   - Studio Pixel premium register: confident, no filler, no emoji
 *   - Each goal has 6 templates for variety across business types
 */

import type { CtaGoal } from "./types";

export interface CtaTemplate {
  text: string;
  rationale: string;
  editHint: string;
}

// ─── Lead generation ─────────────────────────────────────────────────────────
// Goal: capture contact info or drive an asset download.
// Tone: value-first — the lead exchange feels like a gift, not a transaction.

export const LEAD_GENERATION_TEMPLATES: CtaTemplate[] = [
  {
    text:      "Get Your {{qualifier}} {{topic}} Audit",
    rationale: "Positions the lead magnet as a personalised diagnostic — high perceived value",
    editHint:  "end-card with form overlay or link-in-bio reference",
  },
  {
    text:      "Download the {{topic}} Playbook — {{qualifier}}",
    rationale: "Asset-first framing; the qualifier reinforces zero-risk for the viewer",
    editHint:  "lower-third at 85% playtime, persist to end-card",
  },
  {
    text:      "{{verb}} Your {{qualifier}} {{keyword}} Strategy Session",
    rationale: "Consultation framing — personalisation signals premium treatment",
    editHint:  "end-card with calendar embed or booking link",
  },
  {
    text:      "Claim Your {{qualifier}} {{benefit}} Guide",
    rationale: "Outcome-led — the benefit is the lead magnet, not the format",
    editHint:  "overlay on the video's strongest benefit moment",
  },
  {
    text:      "Get {{benefit}} — {{qualifier}}",
    rationale: "Ultra-direct; strips all friction, benefit is the entire pitch",
    editHint:  "short lower-third, ≤ 2 seconds screen time",
  },
  {
    text:      "Start Your {{qualifier}} {{topic}} Assessment {{urgency}}",
    rationale: "Assessment framing implies bespoke output — reduces lead hesitation",
    editHint:  "end-card with quiz or form CTA link",
  },
];

// ─── Awareness ────────────────────────────────────────────────────────────────
// Goal: grow audience, drive content discovery, no conversion pressure.
// Tone: inviting — open-door rather than urgent.

export const AWARENESS_TEMPLATES: CtaTemplate[] = [
  {
    text:      "See How {{topic}} Works",
    rationale: "Lowest-friction CTA — 'see' implies no commitment, just curiosity",
    editHint:  "lower-third with channel or profile link",
  },
  {
    text:      "Explore {{topic}} — No Commitment",
    rationale: "Explicit objection removal makes the invite irresistible",
    editHint:  "end-card with 'learn more' link or playlist link",
  },
  {
    text:      "Follow for More {{keyword}} Insights",
    rationale: "Platform-native language; 'insights' signals ongoing value",
    editHint:  "animated follow button overlay at 90% playtime",
  },
  {
    text:      "Discover What {{benefit}} Really Looks Like",
    rationale: "Curiosity-led — viewer wants to see the proof, not just hear about it",
    editHint:  "end-card linking to case study or portfolio reel",
  },
  {
    text:      "Watch the Full {{topic}} Story",
    rationale: "Narrative continuity hook — implies there's more to discover",
    editHint:  "end-card with playlist or long-form link",
  },
  {
    text:      "Learn More About {{topic}}",
    rationale: "Simple, universal — works on any platform and audience level",
    editHint:  "lower-third with website or landing page link",
  },
];

// ─── Inquiry ──────────────────────────────────────────────────────────────────
// Goal: start a conversation — no hard commitment, just an open dialogue.
// Tone: warm and expert — positions the brand as accessible thought leaders.

export const INQUIRY_TEMPLATES: CtaTemplate[] = [
  {
    text:      "Ask Us Anything About {{topic}}",
    rationale: "Open invitation removes all barriers — maximises inbound volume",
    editHint:  "end-card with DM, email, or comment CTA",
  },
  {
    text:      "Let's Talk {{topic}} — {{qualifier}}",
    rationale: "Conversational opener signals approachability at a premium level",
    editHint:  "lower-third during the speaker's most confident moment",
  },
  {
    text:      "Have a {{keyword}} Question? We'd Love to Help.",
    rationale: "Empathy-first framing — viewer's curiosity is welcomed, not sold to",
    editHint:  "end-card with contact form or email link",
  },
  {
    text:      "Start the Conversation — No Pressure",
    rationale: "Explicit pressure-removal is a proven friction-reducer for inquiry",
    editHint:  "lower-third at 80% playtime",
  },
  {
    text:      "{{verb}} a {{qualifier}} {{keyword}} Consultation",
    rationale: "Formal but accessible — positions the brand as expert advisors",
    editHint:  "end-card with consultation booking or inquiry form",
  },
  {
    text:      "Questions About {{topic}}? Let's Connect.",
    rationale: "Peer-to-peer language — reduces the power imbalance of selling",
    editHint:  "end-card with LinkedIn, email, or DM link",
  },
];

// ─── Booking ──────────────────────────────────────────────────────────────────
// Goal: get a specific time slot confirmed — calendar or appointment.
// Tone: decisive — the viewer should feel momentum, not pressure.

export const BOOKING_TEMPLATES: CtaTemplate[] = [
  {
    text:      "{{verb}} a {{qualifier}} Discovery Call {{urgency}}",
    rationale: "Discovery framing reduces commitment anxiety — it's a conversation, not a close",
    editHint:  "end-card with embedded calendar or Calendly link",
  },
  {
    text:      "Schedule Your {{qualifier}} {{topic}} Session",
    rationale: "Ownership language ('your session') increases psychological buy-in",
    editHint:  "end-card CTA with calendar link, hold for 4+ seconds",
  },
  {
    text:      "Reserve Your {{qualifier}} Strategy Call {{urgency}}",
    rationale: "Scarcity implied by 'reserve' — premium positioning without pressure",
    editHint:  "lower-third at 85% playtime and persistent on end-card",
  },
  {
    text:      "{{verb}} a {{keyword}} Walkthrough — {{qualifier}}",
    rationale: "Walkthrough framing is low-stakes; viewer gets value before committing",
    editHint:  "end-card with demo or walkthrough booking link",
  },
  {
    text:      "Lock In Your {{qualifier}} {{topic}} Consultation",
    rationale: "'Lock in' signals decisiveness — appeals to action-oriented viewers",
    editHint:  "end-card over a strong proof-point moment",
  },
  {
    text:      "{{verb}} Your Spot — Limited Availability {{urgency}}",
    rationale: "Scarcity without fabrication — 'limited availability' is always true",
    editHint:  "end-card with urgency counter or booking link",
  },
];

// ─── Contact ──────────────────────────────────────────────────────────────────
// Goal: direct reach-out — email, phone, form, or DM.
// Tone: clear and human — no jargon, direct route to a person.

export const CONTACT_TEMPLATES: CtaTemplate[] = [
  {
    text:      "Get in Touch {{urgency}}",
    rationale: "Shortest possible CTA — maximises readability at any screen size",
    editHint:  "end-card with email, phone, or contact form link",
  },
  {
    text:      "Talk to a {{topic}} Expert {{urgency}}",
    rationale: "Expert positioning — viewer is directed to someone, not a form",
    editHint:  "lower-third at 85% playtime; repeat on end-card",
  },
  {
    text:      "Contact Our {{keyword}} Team",
    rationale: "Team framing builds trust — implies specialist knowledge available",
    editHint:  "end-card with team contact page link",
  },
  {
    text:      "Reach Out — We Respond Within 24 Hours",
    rationale: "Specific SLA removes the 'will they even reply?' objection",
    editHint:  "end-card; pair with a real team photo if available",
  },
  {
    text:      "Send Us a Message About {{topic}}",
    rationale: "Specific subject removes blank-page anxiety for the viewer",
    editHint:  "end-card with DM, WhatsApp, or email pre-fill link",
  },
  {
    text:      "Connect with the {{topic}} Team {{urgency}}",
    rationale: "Community-forward language — 'connect' is lower-friction than 'contact'",
    editHint:  "lower-third CTA with LinkedIn or community link",
  },
];

// ─── Registry ─────────────────────────────────────────────────────────────────

export const CTA_TEMPLATE_BANK: Record<CtaGoal, CtaTemplate[]> = {
  "lead-generation": LEAD_GENERATION_TEMPLATES,
  "awareness":       AWARENESS_TEMPLATES,
  "inquiry":         INQUIRY_TEMPLATES,
  "booking":         BOOKING_TEMPLATES,
  "contact":         CONTACT_TEMPLATES,
};
