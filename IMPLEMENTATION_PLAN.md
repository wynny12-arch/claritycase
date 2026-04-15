# ClarityCase — MVP Implementation Plan

> Core principle: **Explain complex decisions in plain English with examples, building user understanding before action.**
> This is an "explanation-first decision recovery engine", not a workflow tool or chatbot.

> **Differentiation principle (added from user feedback):** The product must cross the line from "AI assistant" to "case service". Anyone can paste a CIFAS letter into ChatGPT and get an explanation. ClarityCase's defensibility is: **case continuity over time, workflow enforcement, domain depth, and outcome learning**. These must be felt from the first session, not treated as future-phase nice-to-haves.

> **MVP scope tightened:** CIFAS fraud markers are the sole focus. One use case done exceptionally well is more defensible than multiple case types done adequately.

---

## 1. Architecture Overview

### High-Level System Design

```
User Browser (Next.js App Router)
        │
        ├── Auth layer (Supabase Auth)
        │
        ├── API Routes (Next.js /app/api/*)
        │       ├── /classify         → Case Classifier AI module
        │       ├── /explain          → Plain English Explainer + Example Generator
        │       ├── /analyze-evidence → Evidence Analyzer AI module (NEW)
        │       ├── /plan             → Action Planner AI module
        │       ├── /generate-doc     → Document Generator AI module
        │       ├── /generate-followup→ Follow-up Letter Generator (NEW)
        │       ├── /interpret        → Response Interpreter AI module
        │       └── /upload           → File handling → Supabase Storage
        │
        ├── Supabase
        │       ├── Auth (email magic link, MVP)
        │       ├── Postgres (cases, documents, outputs, users)
        │       └── Storage (uploaded files)
        │
        └── Anthropic API (Claude claude-opus-4-6)
                └── All AI modules call this API
```

### Frontend / Backend / AI Interaction Model

- **Frontend** drives a **linear wizard flow** (screens 1–6). Each step collects data and triggers an AI module on advance.
- **API Routes** are thin: they validate input, call the appropriate AI module function, persist outputs, and return structured JSON.
- **AI modules** are isolated service functions (`/lib/ai/`) that build prompts and parse Claude responses.
- **No streaming in MVP** — show loading states, return complete JSON responses.
- **Session-first**: case state is stored in Supabase on first submission. Anonymous sessions are not supported in MVP (require sign-in before case creation).
- **Case continuity is a first-class feature**: every action (letter sent, response received, follow-up done) is logged to a persistent timeline. Users returning to the app see exactly where they are without re-explaining. This is the primary structural difference from using a general LLM.
- **Follow-up nudges**: when a letter is generated and logged as sent, a follow-up checkpoint is calculated (default: 10 working days for CIFAS member institutions). The Case Tracker surfaces this date prominently. Email reminder via Supabase Edge Function is a Phase 6 addition.
- **Outcome tracking**: cases have an `outcome` field. When users report a result, this is aggregated anonymously across all cases to power future "similar cases" recommendations. This is the long-term moat — not built in MVP beyond the data collection, but the schema supports it from day one.

---

## 2. Folder Structure

```
/claritycase
├── app/
│   ├── layout.tsx                  # Root layout, dark theme, Inter font
│   ├── page.tsx                    # Welcome screen (Screen 01)
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── callback/page.tsx       # Supabase auth callback
│   ├── case/
│   │   ├── new/page.tsx            # What Happened (Screen 02)
│   │   ├── [id]/
│   │   │   ├── evidence/page.tsx   # Upload Evidence (Screen 03)
│   │   │   ├── explain/page.tsx    # What This Means (Screen 04)
│   │   │   ├── action/page.tsx     # Next Best Action (Screen 05)
│   │   │   └── tracker/page.tsx    # Case Tracker (Screen 06)
│   └── api/
│       ├── classify/route.ts
│       ├── explain/route.ts
│       ├── plan/route.ts
│       ├── generate-doc/route.ts
│       ├── interpret/route.ts
│       └── upload/route.ts
│
├── components/
│   ├── ui/
│   │   ├── Card.tsx
│   │   ├── Button.tsx
│   │   ├── Chip.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── TermBox.tsx             # Accent-bordered explanation callout
│   │   ├── ConfidenceNote.tsx      # "Confidence note: likely but not confirmed..."
│   │   ├── Timeline.tsx
│   │   ├── UploadZone.tsx
│   │   └── WhatHappensNext.tsx     # Static "what typically happens next" block (NEW)
│   ├── layout/
│   │   ├── AppShell.tsx            # Dark nav + step indicator
│   │   ├── StepIndicator.tsx       # Steps 1–6 breadcrumb
│   │   └── CaseStageBar.tsx        # Named stage display (NEW) — shown in header post-intake
│   └── case/
│       ├── ClassificationBadge.tsx
│       ├── ExplainBlock.tsx        # Plain English + Example + Evidence Breakdown sections
│       ├── EvidenceBreakdown.tsx   # What we know / What's missing / What might be a problem (NEW)
│       ├── ActionBlock.tsx         # Recommended action + Do/Don't lists
│       ├── ReadyToSend.tsx         # Placeholder checklist + "Mark as sent" (NEW)
│       └── DocumentPreview.tsx
│
├── lib/
│   ├── ai/
│   │   ├── classifier.ts
│   │   ├── explainer.ts
│   │   ├── examples.ts
│   │   ├── evidenceAnalyzer.ts     # NEW
│   │   ├── planner.ts
│   │   ├── docGenerator.ts
│   │   ├── followUpGenerator.ts    # NEW
│   │   └── responseInterpreter.ts
│   ├── stages.ts                   # Case stage definitions + plain-English labels (NEW)
│   ├── supabase/
│   │   ├── client.ts               # Browser client
│   │   ├── server.ts               # Server client
│   │   └── middleware.ts
│   └── utils/
│       ├── fileExtract.ts          # PDF/image text extraction
│       └── promptHelpers.ts        # Shared prompt building utilities
│
├── types/
│   └── index.ts                    # Case, Document, AIOutput, etc.
│
├── middleware.ts                   # Supabase auth middleware
├── tailwind.config.ts
└── .env.local
```

---

## 3. Screen-by-Screen Implementation Plan

### Screen 01 — Welcome (`/`)

**Purpose:** Establish the product promise. Convert anxiety into confidence. Gate entry with sign-in.

**Components:**
- `AppShell` (no step indicator on this screen)
- Three feature cards (understand / next step / generate)
- Primary CTA button
- Sign-in gate (if not authenticated, CTA → login)

**State/Data:**
- `useUser()` from Supabase auth — if authenticated, CTA goes to `/case/new`; if not, goes to `/login`

**Interactions:**
- "Start case review" → auth check → redirect

**Explain-as-you-go:**
- Feature cards use plain-English micro-copy: "Translate reports, emails, and decision wording", not "Document analysis"
- No jargon on this screen. Tone: calm, confident, accessible.

---

### Screen 02 — What Happened (`/case/new`)

**Purpose:** Collect the user's description in their own words. Do not force them into categories.

**Components:**
- `Textarea` (open freetext, pre-populated placeholder with CIFAS example)
- `Chip` row (quick-fill examples: "Offer withdrawn", "Bank account closed", "Credit issue", "Fraud marker")
- `TermBox` — "Why this matters: the first step is not escalation. It is understanding..."
- Submit button ("Continue")

**State/Data:**
- `description: string` — user freetext
- On submit: POST to `/api/classify` → returns `classificationResult`
- Create case row in DB with `status: 'classifying'`
- On success: redirect to `/case/[id]/evidence`

**Interactions:**
- Chip click → appends/sets relevant term in textarea
- Submit → loading state ("Analysing your situation...") → DB write + AI classify

**Explain-as-you-go:**
- The `TermBox` at bottom explains *why* we ask this way (understanding before action)
- Chips help users who don't know the right words — reduce cognitive load

---

### Screen 03 — Upload Evidence (`/case/[id]/evidence`)

**Purpose:** Accept messy real-world documents. Reassure user that imperfect inputs are fine.

**Components:**
- `UploadZone` — drag-drop or click-to-upload (PDF, image, text paste)
- Detected files list (shows uploaded file name + inferred type)
- "What we'll look for" bullet card (sets expectations pre-analysis)
- "Analyse documents" CTA

**State/Data:**
- `uploadedFiles: File[]`
- `detectedFiles: {name, type, size}[]` — populated after upload
- On file upload: POST to `/api/upload` → file stored in Supabase Storage → text extracted → stored in `documents` table
- On "Analyse": fire **two parallel requests** — POST `/api/explain` + POST `/api/analyze-evidence` — both use caseId, both read from DB
- Redirect to `/case/[id]/explain` once both resolve
- Case stage set to `GATHERING_EVIDENCE` on this screen

**Interactions:**
- Drag-drop or file picker
- Each uploaded file shows with icon (PDF/image/@)
- "Skip" link (evidence optional — AI works from description alone; evidence analysis will note what's missing)
- Single loading state covers both parallel API calls ("Analysing your situation...")

**Explain-as-you-go:**
- "What we'll look for" card sets expectations: what the decision says, who controls the evidence, what is missing or unclear
- Accepted file types listed in plain English ("PDF, image, screenshot, or pasted email text")
- Reassurance copy: "Imperfect or partial documents are fine — we'll flag what's missing"

---

### Screen 04 — What This Means (`/case/[id]/explain`)

**Purpose:** THE CORE SCREEN. Deliver the signature ClarityCase moment — jargon decoded, example given, evidence assessed. Users leave this screen understanding their situation, not just having read about it.

**Components:**
- `ExplainBlock` — four sub-sections in fixed order:
  1. **Plain English** card — what the key term actually means (not a legal definition)
  2. **Example** card — concrete fictional-but-real scenario
  3. **What likely happened in your case** — bullet list tailored to user's input
  4. **Your Case Breakdown** (`EvidenceBreakdown`) — NEW, see below
- `ConfidenceNote` — "Confidence note: likely, but not fully confirmed until..."
- `SimilarCasesHint` — lightweight hardcoded line, e.g. "In similar cases, contacting the filing institution first is the most effective step"
- CTA: "Show next best action"

**EvidenceBreakdown component (new, critical):**
Three colour-coded sub-sections within a single card:
- **What we know** (green accent) — confirmed facts from description + documents
- **What's missing** (amber accent) — evidence gaps that could strengthen the case
- **What might be a problem** (red accent) — potential weaknesses or complicating factors

This component renders from `evidenceAnalysis` stored in DB. If no documents uploaded, "What we know" reflects description only and "What's missing" is more detailed.

**State/Data:**
- `explanationResult: ExplanationOutput` — loaded from DB
- `evidenceAnalysis: EvidenceAnalysisOutput` — loaded from DB (set by `/api/analyze-evidence`)
- Both are computed in parallel on Screen 03 submit; this screen is pure display

**Interactions:**
- Page loads with all data already computed — no AI calls on this screen
- "Show next best action" → trigger `/api/plan` (passes `evidenceAnalysis` as additional context) → redirect to `/case/[id]/action`

**Explain-as-you-go:**
- Four-section structure is a fixed template — always in this order, never skipped
- `ConfidenceNote` is mandatory — always shown regardless of confidence level
- `SimilarCasesHint` is hardcoded for MVP ("In similar cases...") — appears below confidence note
- Evidence Breakdown is especially important for grey-area cases where the situation is ambiguous

---

### Screen 05 — Next Best Action (`/case/[id]/action`)

**Purpose:** Deliver one clear recommended action with rationale. Include "do not do yet" guardrails.

**Components:**
- Subtitle: recommended action summary in plain English
- "Why this step matters" card — bullet list
- "Do this now" card — specific preparation checklist
- "Do not do yet" card — anti-action guardrail
- CTA: "Generate letter & track case"

**State/Data:**
- `actionPlan: ActionPlanOutput` — loaded from DB
- `evidenceAnalysis: EvidenceAnalysisOutput` — passed as context to Action Planner so missing evidence influences the plan
- On "Generate letter": POST to `/api/generate-doc` → returns `DocumentOutput`
- Page transitions to **"Ready to Send" state** in-place (no redirect yet)

**Interactions:**
- Static display of AI output (action plan section)
- "Generate letter" → loading state → letter appears in `ReadyToSend` component below action plan
- **ReadyToSend component shows:**
  - The generated letter (scrollable preview)
  - "Fill in before sending" checklist — each `[PLACEHOLDER]` listed with a plain-English label
  - "Where to send this" — institution address/email if known, else "[PLACEHOLDER: institution address]"
  - "Mark as sent" button → sets `letter_sent_at`, calculates `follow_up_due_at`, creates case event, redirects to tracker
  - Copy to clipboard + download as plain text (PDF generation deferred post-MVP)
- Case stage advances to `CONTACTING_INSTITUTION` when "Mark as sent" is clicked

**Explain-as-you-go:**
- Single recommended action only — never a list
- "Do not do yet" section always shown — sequencing understanding is core
- "Why it matters" appears before the action steps, not after
- `ReadyToSend` component labels placeholders in plain English ("Add your full name here") not as raw `[PLACEHOLDER_NAME]`

---

### Screen 06 — Case Tracker (`/case/[id]/tracker`)

**Purpose:** The persistent home base for the case. Users return here after sending letters, receiving responses, and at every checkpoint. It must feel like the case is being actively managed, not just stored.

**Layout (top to bottom):**

1. **`CaseStageBar`** — the current named stage shown prominently at the top of the screen (also in app header on all case pages). Stages in order: Understanding → Gathering Evidence → Contacting Institution → Waiting for Response → Follow-Up / Escalation → Resolution. Current stage highlighted; future stages greyed out. Each stage has a plain-English tooltip explaining what it means and what "good progress" looks like.

2. **`FollowUpCheckpoint`** — shown only when `letter_sent_at` is set. Displays: "Follow up due: [date]" with a days-remaining countdown. When due date is reached, button activates: "Generate follow-up message" → POST `/api/generate-followup` → returns firmer-toned letter referencing original → shown in ReadyToSend component inline.

3. **`WhatHappensNext`** — static, hardcoded block (no AI needed). Shows the typical process for this case stage:
   - "Institutions are expected to respond within 20 working days"
   - "If no response → we'll prompt you to follow up"
   - "If rejected → escalation options include the ICO and Financial Ombudsman"
   This content is selected by `current_stage` — different text per stage. High value, low effort, not replicable by a general LLM without manual research.

4. **`Timeline`** — event-driven, dates shown. Each event type has a plain-English label. Events: CASE_CREATED, DOC_UPLOADED, EXPLAINED, PLAN_GENERATED, LETTER_GENERATED, LETTER_SENT, RESPONSE_RECEIVED, INTERPRETED, FOLLOWUP_SENT, OUTCOME_REPORTED.

5. **Response interpretation panel** — shown after "Log response received" is submitted. Three sub-sections (always in this order):
   - **"What this means"** — plain-English interpretation (2-3 sentences)
   - **"What changed"** — `caseStateChange` field from interpreter output, e.g. "Your case has moved to: Waiting for Response"
   - **"What to do next"** — `nextAction` field
   - If `redFlags` present: shown in amber TermBox below

6. **`TermBox`** — proactive plain-English interpretation of likely bureaucratic language. Rotates based on current stage (e.g. "Waiting" stage shows: "'Passed to the relevant team' usually means your case has moved beyond first-line handling...")

7. **"Report outcome"** button — appears once case reaches Resolution stage or user manually triggers it. Simple modal with options: MARKER_REMOVED / EMPLOYER_RECONSIDERED / ESCALATED_ICO / STILL_IN_PROGRESS / CLOSED_UNSUCCESSFUL.

**State/Data:**
- `case: Case` — full case record
- `generatedDoc: GeneratedDocument`
- `caseEvents: CaseEvent[]` — from `case_events` table
- `latestInterpretation: ResponseInterpretation | null` — most recent from `response_interpretations`

**Interactions:**
- "Log response received" → modal → paste text → `/api/interpret` → interpretation rendered in panel → stage potentially updated → timeline event added
- "Generate follow-up" (when follow-up due) → `/api/generate-followup` → ReadyToSend inline → "Mark as sent" resets follow-up clock
- "Report outcome" → modal → saves outcome → stage set to RESOLUTION

**Institution-specific timeline data (hardcoded in `lib/stages.ts`):**
- Default CIFAS member: 20 working days
- ICO referral window: 3 months from institution's final response
- Financial Ombudsman: 8 weeks from complaint
- This specificity cannot be produced reliably by a general LLM on demand

---

## 4. AI Module Design

### 4.1 Case Classifier

**Purpose:** Identify the case type, key entities, and severity from a plain-English description.

**Input:**
```json
{
  "description": "string — user's freetext description"
}
```

**Output JSON Schema:**
```json
{
  "caseType": "CIFAS_MARKER | ACCOUNT_CLOSURE | JOB_REJECTION | CREDIT_DECISION | DBS_ISSUE | OTHER",
  "subType": "string — e.g. 'False Identity Marker'",
  "keyEntities": {
    "filingInstitution": "string | null",
    "employer": "string | null",
    "referenceNumbers": ["string"]
  },
  "severity": "HIGH | MEDIUM | LOW",
  "confidence": "HIGH | MEDIUM | LOW",
  "summaryOneLiner": "string — plain English 1-sentence summary of what happened"
}
```

**Prompt Structure:**
```
SYSTEM:
You are a specialist in UK financial, identity, and employment screening decisions.
Your job is to classify a user's situation from plain English — not legal documents.
Return ONLY valid JSON. No extra text.

USER:
The user has described their situation as follows:

"""
{description}
"""

Classify this situation. Return JSON with these fields:
- caseType: one of [CIFAS_MARKER, ACCOUNT_CLOSURE, JOB_REJECTION, CREDIT_DECISION, DBS_ISSUE, OTHER]
- subType: specific marker or decision type if identifiable (e.g. "False Identity Marker")
- keyEntities: any institutions, employers, or reference numbers mentioned
- severity: how urgent this situation is (HIGH/MEDIUM/LOW)
- confidence: how confident you are in this classification (HIGH/MEDIUM/LOW)
- summaryOneLiner: one sentence summarising what happened in plain English

If unsure, use LOW confidence — do not guess.
```

---

### 4.2 Plain English Explainer

**Purpose:** Take a classified case + document text and explain the core decision in plain English. No jargon.

**Input:**
```json
{
  "caseType": "string",
  "subType": "string",
  "description": "string",
  "extractedDocText": "string | null"
}
```

**Output JSON Schema:**
```json
{
  "keyTerm": "string — the main jargon term being explained",
  "plainEnglish": "string — what it actually means, no jargon",
  "whatLikelyHappened": ["string — bullet points specific to this case"],
  "confidenceNote": "string — what would confirm or change this assessment",
  "confidence": "HIGH | MEDIUM | LOW"
}
```

**Prompt Structure:**
```
SYSTEM:
You are an expert in UK financial regulation, CIFAS fraud markers, employment screening, and consumer rights.
Your job is to explain complex decisions in plain English — as if explaining to a friend with no financial background.
Never use legal jargon without immediately explaining it. Never give legal advice.
Return ONLY valid JSON. No extra text.

USER:
Case type: {caseType} / {subType}
User description: """{description}"""
Document text (if any): """{extractedDocText}"""

Identify the most important term or concept in this situation that is likely confusing the user.
Then explain it plainly.

Return JSON:
- keyTerm: the term (e.g. "False Identity marker")
- plainEnglish: explain what this term means in 2-3 simple sentences. Use "you" not "the applicant".
  Start with what it does NOT mean before what it does mean where that helps.
- whatLikelyHappened: 3-4 bullet points specific to this user's situation
- confidenceNote: what still needs to be confirmed and by whom
- confidence: HIGH/MEDIUM/LOW
```

---

### 4.3 Example Generator

**Purpose:** Generate a concrete, relatable real-world example that anchors the Plain English explanation.

**Input:**
```json
{
  "keyTerm": "string",
  "caseType": "string",
  "subType": "string"
}
```

**Output JSON Schema:**
```json
{
  "example": "string — 2-4 sentence concrete scenario in plain English"
}
```

**Prompt Structure:**
```
SYSTEM:
You explain complex financial and identity decisions using concrete examples.
Examples must be realistic, specific, and easy to picture.
Never use abstract language. Use ordinary people and ordinary situations.
Return ONLY valid JSON.

USER:
Generate a concrete real-world example that illustrates what a "{keyTerm}" is,
in the context of a {caseType} / {subType} case.

The example should:
- Describe a specific scenario (real names, real actions — fictional but believable)
- Show how someone ends up with this outcome without intending fraud
- Be 2-4 sentences maximum

Return JSON: { "example": "..." }
```

> Note: The Example Generator is called alongside the Explainer and the two outputs are combined into the Screen 04 `ExplainBlock`.

---

### 4.4 Action Planner

**Purpose:** Recommend ONE next best action with rationale, plus explicit "do not do yet" guardrails.

**Input:**
```json
{
  "caseType": "string",
  "subType": "string",
  "plainEnglish": "string",
  "whatLikelyHappened": ["string"],
  "confidence": "string"
}
```

**Output JSON Schema:**
```json
{
  "recommendedAction": "string — one sentence",
  "whyItMatters": ["string — 3 bullet points"],
  "doNow": ["string — specific preparation steps, 3-5 bullets"],
  "doNotYet": "string — single most important thing to avoid and why",
  "expectedOutcome": "string — what success looks like"
}
```

**Prompt Structure:**
```
SYSTEM:
You are a UK consumer rights and financial complaints advisor.
Your job is to recommend the single most effective first action — not a list of options.
Be direct. Explain why the action matters before listing the steps.
Never recommend legal escalation before basic information gathering is complete.
Never give legal advice. Return ONLY valid JSON.

USER:
Case: {caseType} / {subType}
What likely happened: {whatLikelyHappened}
Confidence: {confidence}

Recommend the single best next action.
Return JSON:
- recommendedAction: one sentence starting with a verb (e.g. "Contact the filing institution...")
- whyItMatters: 3 bullet points explaining why this step is essential before any other
- doNow: 3-5 specific preparation steps the user should take
- doNotYet: the one thing users typically do too early in this situation, and why it backfires
- expectedOutcome: what a successful response to this action looks like
```

---

### 4.5 Document Generator

**Purpose:** Generate a formal but plain-English letter or email appropriate to the action.

**Input:**
```json
{
  "caseType": "string",
  "subType": "string",
  "recommendedAction": "string",
  "doNow": ["string"],
  "keyEntities": {
    "filingInstitution": "string | null",
    "employer": "string | null"
  },
  "userName": "string"
}
```

**Output JSON Schema:**
```json
{
  "documentType": "FORMAL_COMPLAINT | INFORMATION_REQUEST | SUBJECT_ACCESS_REQUEST | EMPLOYER_APPEAL",
  "subject": "string",
  "body": "string — full letter text with [PLACEHOLDERS] for unknowns",
  "placeholders": ["string — list of placeholders the user must fill in"],
  "toneNote": "string — brief note on the tone used and why"
}
```

**Prompt Structure:**
```
SYSTEM:
You write formal but plain-English letters for UK consumers dealing with financial and identity decisions.
Letters must be: polite, factual, specific, and actionable.
Use [PLACEHOLDER] for any information the user must insert.
Do not make legal arguments. Focus on requesting information and documenting the timeline.
Return ONLY valid JSON.

USER:
Case: {caseType} / {subType}
Recommended action: {recommendedAction}
Steps to cover: {doNow}
Filing institution: {filingInstitution}
User name: {userName}

Generate a formal letter.
Return JSON:
- documentType: the type of document
- subject: email/letter subject line
- body: the full letter text — professional, clear, no jargon
- placeholders: list of [PLACEHOLDER] items the user must complete
- toneNote: one sentence on tone
```

---

### 4.6 Response Interpreter

**Purpose:** When the user receives a reply, explain what the response actually means and what to do next.

**Input:**
```json
{
  "caseType": "string",
  "responseText": "string — the text of the reply they received"
}
```

**Output JSON Schema:**
```json
{
  "whatThisMeans": "string — plain English interpretation",
  "isPositive": true | false | "UNCLEAR",
  "nextAction": "string — what to do now",
  "waitOrAct": "WAIT | ACT | UNCLEAR",
  "timeframe": "string | null — e.g. 'Allow 10 working days before following up'",
  "redFlags": ["string | null"]
}
```

**Output JSON Schema** — updated to support case state changes:
```json
{
  "whatThisMeans": "string — plain English interpretation",
  "isPositive": "true | false | UNCLEAR",
  "nextAction": "string — what to do now",
  "waitOrAct": "WAIT | ACT | UNCLEAR",
  "timeframe": "string | null",
  "redFlags": ["string"],
  "caseStateChange": "string | null — e.g. 'Your case has moved to: Waiting for Response'",
  "recommendedStage": "UNDERSTANDING | GATHERING_EVIDENCE | CONTACTING_INSTITUTION | WAITING_FOR_RESPONSE | FOLLOW_UP_ESCALATION | RESOLUTION | null",
  "outcomeDirection": "POSITIVE | NEGATIVE | NEUTRAL | UNCLEAR"
}
```

**Prompt Structure:**
```
SYSTEM:
You interpret formal responses from UK financial institutions and employers for ordinary consumers.
Your job is to translate bureaucratic language into plain English and advise what to do next.
Be honest if a response is vague or unhelpful — do not spin bad news.
Return ONLY valid JSON.

SHARED TONE RULE (applies to all modules):
- Use plain English. Explain before you instruct. Never use legal tone.
- Never start a sentence with "pursuant to", "aforementioned", or "herein".
- Use "you" not "the applicant" or "the individual".
- If something is uncertain, say so clearly.

USER:
Case type: {caseType}
Current case stage: {currentStage}
Response received: """{responseText}"""

Interpret this response.
Return JSON:
- whatThisMeans: 2-3 sentences in plain English — what is actually being communicated
- isPositive: true / false / "UNCLEAR"
- nextAction: what the user should do now, in one sentence
- waitOrAct: "WAIT" / "ACT" / "UNCLEAR"
- timeframe: if waiting, how long is reasonable before following up
- redFlags: any phrases or omissions that suggest the case is not being handled properly (empty array if none)
- caseStateChange: a plain-English sentence describing what has changed, or null if nothing changed
- recommendedStage: the stage this response suggests the case has moved to (use the stage enum values)
- outcomeDirection: overall direction — POSITIVE, NEGATIVE, NEUTRAL, or UNCLEAR
```

---

### 4.7 Evidence Analyzer (NEW)

**Purpose:** Given the user's description and any uploaded documents, identify what is confirmed, what is missing, what could strengthen the case, and what could be a problem. Powers the `EvidenceBreakdown` section on Screen 04.

**Input:**
```json
{
  "caseType": "string",
  "subType": "string",
  "description": "string",
  "extractedDocText": "string | null"
}
```

**Output JSON Schema:**
```json
{
  "confirmedFacts": ["string — facts clearly established from description or documents"],
  "assumptions": ["string — things being inferred but not confirmed"],
  "missingInformation": ["string — specific evidence gaps that matter"],
  "potentialIssues": ["string — factors that could weaken the case or complicate resolution"],
  "suggestedNextEvidence": ["string — what to gather next and why, in plain English"]
}
```

**Prompt Structure:**
```
SYSTEM:
You are a UK consumer casework specialist analysing a person's evidence in a CIFAS marker dispute.
Your job is to identify what is confirmed, what is assumed, what is missing, and what could cause problems.
Be specific. Do not use legal jargon. Use plain English.
Never give legal advice. Return ONLY valid JSON.

SHARED TONE RULE:
- Explain before you instruct. Use plain English throughout.
- Use "you" / "your case" not "the applicant" or "the claimant".
- If something is uncertain, name it clearly rather than hedging vaguely.

USER:
Case type: {caseType} / {subType}
Description: """{description}"""
Documents (if any): """{extractedDocText}"""

Analyse the evidence position for this case.
Return JSON:
- confirmedFacts: what is clearly established (from documents or unambiguous description). List each as a short sentence.
- assumptions: what we are inferring but cannot confirm without further evidence.
- missingInformation: what is absent that would meaningfully strengthen the case. Be specific — name the document or information type.
- potentialIssues: factors that could complicate or weaken the case. Be honest — do not omit difficulties.
- suggestedNextEvidence: the 2-3 most important things to gather next. Each item should name what it is AND why it matters.

If no documents were provided, reflect that in confirmedFacts (less confirmed) and missingInformation (more detailed).
```

---

### 4.8 Follow-up Generator (NEW)

**Purpose:** When the follow-up deadline is reached and no response has been received, generate a firmer second letter that references the original and the lack of response.

**Input:**
```json
{
  "caseType": "string",
  "subType": "string",
  "originalLetterSubject": "string",
  "originalLetterSentAt": "string — ISO date",
  "institutionName": "string",
  "userName": "string",
  "daysSinceOriginal": "number"
}
```

**Output JSON Schema:**
```json
{
  "subject": "string",
  "body": "string — full follow-up letter with [PLACEHOLDERS]",
  "placeholders": ["string"],
  "toneNote": "string — confirms tone is firmer but professional"
}
```

**Prompt Structure:**
```
SYSTEM:
You write follow-up letters for UK consumers who have not received a response to a formal complaint or information request.
The tone should be firmer than the original — more direct, citing the lack of response — but remain professional and factual.
Do not threaten legal action. Do not use legal jargon.
Reference the original correspondence and the time elapsed. Return ONLY valid JSON.

SHARED TONE RULE:
- Plain English throughout. Explain the situation clearly in the opening paragraph.
- Use "you" not "the applicant". Be direct but not aggressive.

USER:
Case type: {caseType} / {subType}
Original letter subject: {originalLetterSubject}
Original letter sent: {originalLetterSentAt} ({daysSinceOriginal} days ago)
Institution: {institutionName}
User name: {userName}

Generate a follow-up letter.
Return JSON:
- subject: follow-up subject line referencing original
- body: the full letter — firmer tone, references original letter and date, requests a response within a reasonable timeframe
- placeholders: [PLACEHOLDER] items for the user to complete
- toneNote: one sentence confirming the tone shift and why it is appropriate at this stage
```

---

### Shared Prompt Rule (applied to ALL modules)

Add this block to every `SYSTEM` prompt. It ensures tone is consistent across the product without needing to review every prompt individually:

```
TONE AND STYLE (mandatory):
- Write in plain English. No legal jargon.
- Explain before you instruct — never lead with what to do before explaining why.
- Use "you" and "your case" throughout. Never "the applicant", "the individual", or "the claimant".
- Use short sentences. 15-20 words maximum per sentence where possible.
- Forbidden words: pursuant, aforementioned, herein, shall be deemed, in accordance with, notwithstanding.
- If you are uncertain, name the uncertainty clearly. Do not hedge vaguely ("it could be...").
- Never give legal advice. You can explain, inform, and suggest practical steps.
- Do not be alarming. The goal is clarity and calm confidence.
```

---

## 5. API Design

### Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/classify` | POST | Run Case Classifier on user description |
| `/api/explain` | POST | Run Explainer + Example Generator on case + docs |
| `/api/analyze-evidence` | POST | Run Evidence Analyzer on case + docs (NEW) |
| `/api/plan` | POST | Run Action Planner (now takes evidence analysis as input) |
| `/api/generate-doc` | POST | Run Document Generator |
| `/api/generate-followup` | POST | Run Follow-up Letter Generator when deadline reached (NEW) |
| `/api/interpret` | POST | Run Response Interpreter — now returns stage transition fields |
| `/api/upload` | POST | Upload file to Supabase Storage + extract text |

### Request / Response Formats

**POST `/api/classify`**
```json
// Request
{ "caseId": "uuid", "description": "string" }

// Response
{ "success": true, "data": { ...ClassificationOutput } }
```

**POST `/api/explain`**
```json
// Request
{ "caseId": "uuid" }
// (uses case record + uploaded docs from DB)

// Response
{ "success": true, "data": { ...ExplanationOutput, "example": "string" } }
```

**POST `/api/analyze-evidence`** (NEW)
```json
// Request
{ "caseId": "uuid" }
// (uses case record + uploaded doc extracted text from DB)

// Response
{ "success": true, "data": { ...EvidenceAnalysisOutput } }
```

**POST `/api/generate-followup`** (NEW)
```json
// Request
{ "caseId": "uuid" }
// (reads letter_sent_at, institution_name, original letter subject from DB)

// Response
{ "success": true, "data": { ...FollowUpDocumentOutput } }
```

**POST `/api/plan`**
```json
// Request
{ "caseId": "uuid" }

// Response
{ "success": true, "data": { ...ActionPlanOutput } }
```

**POST `/api/generate-doc`**
```json
// Request
{ "caseId": "uuid" }

// Response
{ "success": true, "data": { ...DocumentOutput } }
```

**POST `/api/interpret`**
```json
// Request
{ "caseId": "uuid", "responseText": "string" }

// Response — includes stage transition fields
{
  "success": true,
  "data": {
    "whatThisMeans": "string",
    "isPositive": "true | false | UNCLEAR",
    "nextAction": "string",
    "waitOrAct": "WAIT | ACT | UNCLEAR",
    "timeframe": "string | null",
    "redFlags": ["string"],
    "caseStateChange": "string | null",
    "recommendedStage": "string | null",
    "outcomeDirection": "POSITIVE | NEGATIVE | NEUTRAL | UNCLEAR"
  }
}
// Side effects: updates cases.current_stage if recommendedStage is set;
//               creates case_event of type INTERPRETED;
//               inserts row into response_interpretations table
```

**POST `/api/upload`**
```json
// Request: multipart/form-data
// Fields: file (File), caseId (string)

// Response
{ "success": true, "data": { "documentId": "uuid", "extractedText": "string", "fileType": "PDF|IMAGE|TEXT" } }
```

**Error format (all routes):**
```json
{ "success": false, "error": "string — plain English error message" }
```

All routes require authenticated session (Supabase session cookie). Return 401 if unauthenticated.

---

## 6. Database Schema (Supabase)

### `users` (managed by Supabase Auth — extend with profile)

```sql
-- profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `cases`

```sql
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  -- status values: new | classifying | classified | explaining | explained | planning | planned | generating | complete

  -- Case stage (user-facing journey position, distinct from internal status)
  current_stage TEXT NOT NULL DEFAULT 'UNDERSTANDING',
  -- stage values: UNDERSTANDING | GATHERING_EVIDENCE | CONTACTING_INSTITUTION |
  --               WAITING_FOR_RESPONSE | FOLLOW_UP_ESCALATION | RESOLUTION

  -- Classification output
  case_type TEXT,
  sub_type TEXT,
  key_entities JSONB,
  severity TEXT,
  classification_confidence TEXT,
  summary_one_liner TEXT,

  -- Explanation output
  key_term TEXT,
  plain_english TEXT,
  example_text TEXT,
  what_likely_happened JSONB,   -- array of strings
  confidence_note TEXT,
  explanation_confidence TEXT,

  -- Evidence analysis output (NEW)
  confirmed_facts JSONB,            -- array of strings
  assumptions JSONB,                -- array of strings
  missing_information JSONB,        -- array of strings
  potential_issues JSONB,           -- array of strings
  suggested_next_evidence JSONB,    -- array of strings

  -- Action plan output
  recommended_action TEXT,
  why_it_matters JSONB,
  do_now JSONB,
  do_not_yet TEXT,
  expected_outcome TEXT,

  -- Workflow tracking (case service layer)
  letter_sent_at TIMESTAMPTZ,                -- set when user logs "letter sent"
  follow_up_due_at TIMESTAMPTZ,              -- calculated from letter_sent_at + institution timeline
  institution_name TEXT,                     -- e.g. "Barclays", "CIFAS" — used for timeline lookup
  follow_up_done_at TIMESTAMPTZ,

  -- Outcome tracking (for aggregate learning across all cases)
  outcome TEXT,
  -- outcome values: MARKER_REMOVED | EMPLOYER_RECONSIDERED | ESCALATED_ICO | STILL_IN_PROGRESS | CLOSED_UNSUCCESSFUL
  outcome_reported_at TIMESTAMPTZ,
  outcome_notes TEXT,                        -- optional user note on what worked

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `documents`

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,   -- PDF | IMAGE | TEXT
  storage_path TEXT NOT NULL, -- Supabase Storage path
  extracted_text TEXT,        -- text extracted from file
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `generated_documents`

```sql
CREATE TABLE generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  placeholders JSONB,
  tone_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `case_events`

```sql
CREATE TABLE case_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  -- event_type values: CASE_CREATED | DOC_UPLOADED | EXPLAINED | PLAN_GENERATED |
  --                    LETTER_GENERATED | RESPONSE_RECEIVED | RESPONSE_INTERPRETED
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `response_interpretations`

```sql
CREATE TABLE response_interpretations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  response_text TEXT NOT NULL,
  what_this_means TEXT,
  is_positive TEXT,              -- 'true' | 'false' | 'UNCLEAR'
  next_action TEXT,
  wait_or_act TEXT,
  timeframe TEXT,
  red_flags JSONB,
  case_state_change TEXT,        -- plain-English description of what changed (NEW)
  recommended_stage TEXT,        -- stage enum value the interpreter recommends (NEW)
  outcome_direction TEXT,        -- POSITIVE | NEGATIVE | NEUTRAL | UNCLEAR (NEW)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security
Enable RLS on all tables. Policy: `user_id = auth.uid()`.

---

## 7. File Handling Strategy

### Upload Flow

1. User selects file(s) on Screen 03
2. Frontend POSTs `multipart/form-data` to `/api/upload`
3. API route:
   - Validates file type (PDF, JPG, PNG, WEBP, plain text)
   - Uploads to Supabase Storage: `files/{user_id}/{case_id}/{filename}`
   - Extracts text (see below)
   - Creates `documents` row with `storage_path` and `extracted_text`
4. Frontend shows file in "Detected files" list

### Text Extraction Strategy (MVP)

| File Type | Extraction Method |
|-----------|------------------|
| PDF | Use `pdf-parse` npm package (server-side) |
| Image (JPG/PNG) | Send to Claude with `image` content type — ask Claude to extract visible text |
| Plain text / email paste | No extraction needed — use directly |

**Important:** Extracted text is stored in `documents.extracted_text`. This is what gets sent to AI modules — the original file in Storage is kept for reference only.

### What is Persisted vs Transient

| Data | Persisted | Where |
|------|-----------|-------|
| Uploaded files | Yes | Supabase Storage |
| Extracted text | Yes | `documents.extracted_text` |
| AI outputs (explanation, plan, doc) | Yes | `cases` table + `generated_documents` |
| Case events/timeline | Yes | `case_events` |
| Intermediate prompt text | No | Never stored |
| Raw Anthropic API responses | No | Only parsed JSON stored |

---

## 8. Build Phases

### Phase 1: Project Setup (Days 1–2)

- `npx create-next-app@latest claritycase --typescript --tailwind --app`
- Install: `@supabase/supabase-js`, `@supabase/ssr`, `@anthropic-ai/sdk`, `pdf-parse`
- Configure Supabase project: Auth (magic link email), Storage bucket (`files`), run schema migrations
- Set up `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`
- Configure Tailwind with design tokens from CSS (dark navy palette: `#0b1020`, `#11182b`, etc.)
- Set up Supabase middleware for session management
- Deploy skeleton to Vercel (connect env vars)

### Phase 2: Core UI + Routing (Days 3–5)

- Build all 6 screens as static pages with hardcoded sample data
- Build shared components: `Card`, `Button`, `Chip`, `TermBox`, `ConfidenceNote`, `Timeline`, `UploadZone`
- Build `AppShell` with `StepIndicator` (steps 1–6)
- Wire up routing: `/` → `/case/new` → `/case/[id]/evidence` → etc.
- Build auth screens (`/login`, `/callback`)
- Protect all `/case/*` routes via middleware

### Phase 3: Basic AI Integration (Days 6–8)

- Build `/lib/ai/classifier.ts` — implement prompt, call Claude, parse JSON
- Build `/api/classify/route.ts` — wire to classifier, write to `cases` table
- Wire Screen 02 submit to `/api/classify` — show loading state, redirect on success
- Build `/lib/ai/explainer.ts` and `/lib/ai/examples.ts`
- Build `/lib/ai/evidenceAnalyzer.ts` — implement Evidence Analyzer prompt + JSON parsing
- Build `/api/explain/route.ts` and `/api/analyze-evidence/route.ts`
- Wire Screen 03 → fire both API calls in parallel → Screen 04 loads both outputs from DB
- Test end-to-end: description → classify → explain + evidence analysis → display on Screen 04

### Phase 4: Explanation Engine + Evidence Breakdown (Days 9–12)

- Build Screen 04 `ExplainBlock` — four-section layout (Plain English / Example / What Likely Happened / Evidence Breakdown)
- Build `EvidenceBreakdown` component — three colour-coded sub-sections (confirmed / missing / problems)
- Add `ConfidenceNote` and `SimilarCasesHint` components
- Build `CaseStageBar` component — renders in header on all `/case/[id]/*` pages
- Build `lib/stages.ts` — stage definitions, plain-English labels, "good progress" descriptions, institution timelines
- Update Action Planner prompt to accept `evidenceAnalysis` as input context
- Build `/lib/ai/planner.ts` and `/api/plan/route.ts`
- Wire Screen 04 CTA → `/api/plan` → Screen 05 loads from DB
- Test: does evidence analysis context meaningfully change the action plan? Iterate prompts.
- Ensure "Do not do yet" always appears on Screen 05

### Phase 5: Document Generation + Ready to Send (Days 13–15)

- Build file upload: `UploadZone` component, `/api/upload/route.ts`, PDF text extraction
- Build `/lib/ai/docGenerator.ts` and `/api/generate-doc/route.ts`
- Build `ReadyToSend` component — placeholder checklist, "where to send", "Mark as sent" button
- Wire Screen 05: "Generate letter" → `ReadyToSend` in-place → "Mark as sent" → sets `letter_sent_at`, calculates `follow_up_due_at`, redirects to tracker
- Build `/lib/ai/followUpGenerator.ts` and `/api/generate-followup/route.ts`
- Build `/lib/ai/responseInterpreter.ts` and `/api/interpret/route.ts` — include stage transition fields
- Wire "Log response received" on tracker → `/api/interpret` → three-panel response UI (What this means / What changed / What to do next) → stage updated

### Phase 6: Persistence + Tracking + Case Service Layer (Days 16–19)

- Build `Timeline` component driven by `case_events` table — all event types with dates and plain-English labels
- Build `FollowUpCheckpoint` component — countdown to follow-up due date, activates "Generate follow-up" when reached
- Build `WhatHappensNext` component — stage-aware static block, driven by `lib/stages.ts`
- Build case list page (`/cases`) — all user cases with current stage badge and follow-up due date
- Wire "Generate follow-up" → `/api/generate-followup` → `ReadyToSend` inline on tracker
- Add stage-aware `TermBox` content on tracker (different text per stage)
- Add "Report outcome" modal → saves to `cases.outcome`
- Supabase Edge Function: daily cron checks `follow_up_due_at` — sends email reminder when window is reached
- QA full flow: signup → describe → upload → explain (4 sections) → evidence breakdown → plan → generate letter → ready to send → mark sent → tracker with countdown → follow-up generated → log response → interpretation panel → stage updated → report outcome
- Final prompt tuning pass across all 8 modules — verify shared tone rule is applied consistently

---

## 9. MVP Simplifications

### Deliberately NOT building in MVP:

| Feature | Reason deferred |
|---------|----------------|
| Multiple recommended actions / branching paths | Single action is the product principle; branching adds complexity |
| Real-time streaming AI responses | Loading states are sufficient; streaming adds infra complexity |
| Payment / subscription gating | Focus on proving value first |
| Case sharing or collaboration | Single-user MVP |
| Push notifications / email reminders | Outcome tracking schema ready; email nudges added Phase 6 via Supabase Edge Functions |
| Mobile native app | Responsive web is sufficient |
| Multi-language support | UK English only in MVP |
| OCR for handwritten documents | Use Claude vision for printed images only |
| Admin dashboard | No admin tooling in MVP |
| Analytics / tracking | Basic Vercel Analytics only |
| SAR (Subject Access Request) automation | Manual generation only — no API integrations |
| Integrations with CIFAS / credit bureaus | No external API integrations in MVP |
| "Similar cases" recommendations | Schema captures outcome data from day one — surfacing it as recommendations requires sufficient case volume, post-MVP |
| Account closure / DBS / credit case types | Deferred — CIFAS markers only in MVP |

### Scope guardrails:
- **CIFAS markers only** — not "primarily". Removing other case types from the intake chips and classifier. One case type done exceptionally well is the MVP strategy.
- AI modules return JSON — no streaming, no partial renders.
- File upload is limited to 10MB and 3 files per case.
- Institution-specific timeline knowledge (follow-up dates, escalation paths) is **hardcoded** for major UK CIFAS members in MVP — not AI-generated. This is more reliable and more defensible.

### What makes this meaningfully different from ChatGPT (in MVP):
1. **Case continuity** — the full case history is held; users never re-explain.
2. **Evidence gap analysis** — the system explicitly tells you what you have, what's missing, and what could be a problem. A general LLM won't flag this unprompted.
3. **Follow-up enforcement** — the system tells you *when* to act, not just what to do. Follow-up date is calculated automatically.
4. **Named stages** — users always know where they are in the process and what "good progress" looks like.
5. **Institution-specific depth** — timelines, escalation paths, and response language decoding tuned to CIFAS and UK institutions.
6. **Response → state change** — when a response is received, the system updates the case stage. It doesn't just explain; it moves things forward.
7. **Outcome capture** — every resolved case feeds the long-term learning model (Runna method).

These cannot be replicated by pasting a document into a general LLM.

---

## 10. Risks and Design Considerations

### Handling Uncertainty in AI Outputs

- Every AI module returns a `confidence: HIGH | MEDIUM | LOW` field
- `ConfidenceNote` component is shown on Screen 04 whenever confidence is MEDIUM or LOW
- Never display AI output as fact — use hedging language: "likely", "usually", "based on what you've told us"
- If classification returns `OTHER` or LOW confidence — show a fallback card: "We couldn't fully classify this yet. Here's what to do first..." (trigger a generic first step: request a SAR from CIFAS)

### Avoiding "Legal Advice" Positioning

- Footer on all screens: "ClarityCase provides information and guidance only. This is not legal advice."
- AI system prompts explicitly instruct Claude: "Never give legal advice. You can explain what things mean and recommend practical steps, but not interpret the law."
- Avoid phrases: "you have a right to", "legally entitled", "the organisation must" — instead: "organisations are typically expected to", "you can ask them to"
- Document Generator generates informational requests and complaints — not legal arguments

### User Trust and Clarity

- Always show *why* the AI is asking what it's asking (TermBox pattern)
- Never show raw AI output — always structure it through defined components
- `ConfidenceNote` is non-negotiable — users must know when AI is uncertain
- Tone calibration: serious and calm, not alarming or overly optimistic
- Design principle from mockups: "the fog is lifting, not entering another bureaucracy"

### Sensitive Data Handling

- All data encrypted at rest (Supabase default)
- Files stored in private Supabase Storage bucket (not public)
- RLS on all tables — users can only access their own data
- No PII logged in server logs or Anthropic API metadata
- Clear privacy statement on upload screen: "Your documents are stored securely and used only to analyse your case"
- MVP: do not send full file contents to Claude unless necessary — prefer extracted text
- Future: consider data retention policy (auto-delete after 90 days)

---

## 11. Prompt Design Principles

### Plain English Explanations

- Always instruct Claude: "Explain as if to a friend with no financial background"
- Use "you" not "the applicant", "the individual", or "the claimant"
- Maximum sentence length guidance in prompts: "Use short sentences. Aim for 15-20 words maximum per sentence."
- Start Plain English explanations with what something is NOT before what it is — this is more reassuring and more memorable
- Forbidden words list in system prompts: "pursuant", "aforementioned", "herein", "shall be deemed", "in accordance with"

### Including Examples Consistently

- Example Generator is always called alongside the Explainer — they are never separated in the UI
- Example prompt instructs: "Use a fictional but realistic person. Give them a name. Make the scenario specific — not generic."
- Examples must show how an innocent person ends up in the situation — not how a fraudster operates
- Examples are capped at 4 sentences in the prompt

### Avoiding Hallucination and Overconfidence

- All prompts include: "If you are not sure, say LOW confidence. Do not guess."
- JSON-only output reduces hallucination — Claude cannot add narrative around its response
- Validation on the API route: if output doesn't parse as valid JSON, return a safe fallback rather than surfacing raw Claude output to users
- Key terms identified by the Explainer must come from the user's input or document text — the prompt instructs Claude to "only explain terms that appear in the user's description or documents — do not introduce new terms"
- Confidence field is required in schema — if absent after parsing, default to LOW
- Response Interpreter explicitly told: "Be honest if a response is vague or unhelpful. Do not spin bad news."

### Prompt Testing Strategy

Before launch, each prompt should be tested against:
1. Clear CIFAS case (high confidence scenario)
2. Vague description (low confidence scenario)
3. Adversarial input (user describes something unrelated)
4. Edge case: user describes multiple overlapping issues

Output should be reviewed for: accuracy, tone, plain English quality, and correct confidence calibration.

---

## Appendix: Design Token Reference (from mockups)

```css
--bg:       #0b1020   /* Page background */
--panel:    #11182b   /* Card background */
--panel2:   #16213a   /* Secondary panel */
--text:     #eef4ff   /* Primary text */
--muted:    #9fb0cf   /* Secondary text */
--accent:   #57a8ff   /* Blue accent (links, icons) */
--accent2:  #7ef0d0   /* Teal accent (timeline dots, upload border) */
--warning:  #ffc857   /* Warning states */
--danger:   #ff6b6b   /* Error/red flags */
--border:   rgba(255,255,255,.08)
```

Tailwind custom config should map these as named colours.
Font: Inter (Google Fonts or next/font).
Border radius: cards use 18px, buttons 14px, chips 999px.

---

## Appendix: Live Test Case Protocol

A real user is currently navigating a CIFAS False Identity marker case. This gives us access to a genuine test case before public launch.

### How to use this:

**Phase 3 (AI integration):** Run the real description and documents through the classifier and explainer. Does the Plain English explanation match what an informed human would say? Is the confidence note accurate? Does the example resonate?

**Phase 4 (explanation engine):** Does the "what likely happened in your case" section feel accurate to the real situation? Is the tone right — calming rather than alarming?

**Phase 5 (document generation):** Use the generated letter in a real context. Compare it to what was manually crafted previously ("hours crafting emails"). Is it better? What's missing?

**Phase 6 (tracker):** Does the follow-up checkpoint feel useful? Is the institution timeline accurate for the specific member involved?

### What to capture from the test case:
- Which terms caused the most confusion initially (feeds into the explainer prompt)
- What the real institution response said (tests the Response Interpreter)
- What the actual outcome is — first real data point for outcome tracking
- What the user wished they had known at each stage (surfaces gaps in the explanation engine)

### A note on using real data:
Test with real documents only with explicit consent. Use extracted text only — do not log full document contents anywhere outside the Supabase storage bucket. Strip any reference numbers or personal identifiers before using in prompt testing.
