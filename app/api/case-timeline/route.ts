import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM = `You are a UK consumer casework specialist building a step-by-step case plan for someone dealing with a financial, identity, or employment decision.

Your job is to produce a specific, ordered timeline of steps for this exact case — not a generic template. Each step should name the actual organisations involved, the actual documents mentioned, and the actual actions required.

IMPORTANT KNOWLEDGE — CIFAS FALSE IDENTITY / VICTIM OF IMPERSONATION CASES:
- When a CIFAS False Identity marker is filed, two markers are often recorded simultaneously: a fraud marker (active for up to 6 years) and a Victim of Impersonation marker (active for only 13 months).
- When the victim marker expires, the fraud marker remains — creating an incomplete picture that makes the person look fraudulent rather than a victim.
- The standard workflow for these cases involves TWO parallel tracks that can run simultaneously:
  Track A — Filing member (e.g. Monese, bank who filed the marker): formal complaint requesting investigation and removal or amendment of the marker.
  Track B — Affected employer or organisation (e.g. the bank that withdrew the job offer): explain the context, that the victim marker has expired, and request reconsideration.
- These two tracks can and should happen in parallel. Both depend on the SAR being reviewed first. Mark both as sequential: true with dependsOnStep pointing to the SAR review step — they will unlock simultaneously and can both be active at the same time without depending on each other.
- After the filing member removes or amends the marker, a CRITICAL step is to obtain independent CIFAS verification — a confirmation direct from CIFAS (not just from the filing member) that the record is clear. This protects the user and gives them hard evidence to show the employer.
- After CIFAS verification, the user should follow up with the affected employer, providing the CIFAS confirmation, and formally request that their decision be reconsidered.
- If the employer refuses to reconsider despite a clean CIFAS record, there are two distinct escalation routes that can run in parallel: (1) the Financial Ombudsman Service (FOS) — to challenge how the employer used and acted on the CIFAS information; and (2) the Information Commissioner's Office (ICO) — to challenge the accuracy of the data itself under UK GDPR Article 5(1)(d). These are different routes targeting different aspects of the problem and can be pursued simultaneously.

Return ONLY valid JSON. No markdown. No code fences. No extra text.`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userText, uploadedDocNames, explanationType, actions, lettersSent, decodedResponseContext, completedStepLabel } = body

    if (!userText?.trim()) {
      return NextResponse.json({ error: 'Missing case description.' }, { status: 400 })
    }

    const docContext = uploadedDocNames?.length
      ? `Documents uploaded so far: ${uploadedDocNames.join(', ')}.`
      : 'No documents uploaded yet.'

    const actionsContext = actions?.length
      ? `Recommended actions from case analysis: ${actions.map((a: { title: string }) => a.title).join('; ')}.`
      : ''

    const progressContext = [
      lettersSent ? 'A letter has been sent to one of the organisations.' : '',
      completedStepLabel ? `The step "${completedStepLabel}" has been confirmed complete — a response was received that resolved it. Mark this step as "done".` : '',
      decodedResponseContext || '',
    ].filter(Boolean).join(' ')

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Build a case timeline for this situation:

"""
${userText}
"""

${docContext}
Case classified as: ${explanationType || 'unknown'}.
${actionsContext}
${progressContext}

Generate a specific, ordered list of steps for this case. Include:
- Steps already completed (mark as "done")
- The current active step (mark as "active")
- Steps still to come (mark as "upcoming")

Be specific: name the actual organisations, documents, and actions involved. Do not be generic.

WORKFLOW PATTERN FOR CIFAS / FALSE IDENTITY CASES:
The correct workflow is:
1. Request SAR from CIFAS — to identify who filed the marker and what it says (sequential: true after case is initiated)
2. Review SAR — identify the filing member, understand the marker details (sequential: true, needs SAR first)
3a. Write to filing member (e.g. Monese) — formal complaint requesting investigation and removal/amendment (sequential: true, dependsOnStep: 2 — depends on SAR review. Parallel with 3b: both unlock when step 2 is done.)
3b. Write holding letter to affected employer (e.g. Yorkshire Building Society) — enclose the CIFAS SAR, explain the victim marker expiry problem, state you are in contact with the filing member, and ask the employer to review the decision in light of the full picture. This goes BEFORE the filing member has acted. (sequential: true, dependsOnStep: 2 — same dependency as 3a. Both 3a and 3b are active simultaneously once step 2 is done. They do NOT depend on each other.)
4. Obtain CIFAS verification of marker removal — once the filing member confirms removal, request confirmation from CIFAS directly (sequential: true, needs filing member to act first)
5. Follow up with employer providing CIFAS confirmation — send the CIFAS confirmation to the employer and formally request reconsideration of their decision (sequential: true, needs CIFAS confirmation first)
6. If employer declines — two parallel escalation routes: FOS (challenge how the employer used the CIFAS data) and ICO (challenge the accuracy of the data under UK GDPR). Both can run simultaneously. (sequential: true, only if employer refuses)

Adapt this entirely to the actual case described. Use the document names and case description to determine what has already happened:
- If a document clearly shows the SAR has been received from CIFAS, mark the SAR request step as done
- If a document clearly shows the employer has confirmed the job offer withdrawal or responded formally, mark the employer-contact step as done — this means the user already HAS that confirmation and the next step is likely the SAR or writing to the filing member
- If a document shows the filing member has responded, mark that step as done
- Do not assume steps are done unless the documents or progress context clearly support it
- The active step must reflect where the user actually is right now

Return this exact JSON:
{
  "steps": [
    {
      "label": "Short step title — specific to this case. e.g. 'Request SAR from CIFAS' or 'Write to Monese to dispute marker' or 'Obtain CIFAS confirmation of removal'",
      "detail": "1 sentence. What this step involves or what was found. Specific to the case.",
      "status": "done" | "active" | "upcoming",
      "sequential": true | false,
      "lockedReason": "1 short sentence. Only include if sequential is true. Plain English. e.g. 'You need the CIFAS confirmation before the employer will take the removal seriously.'",
      "dependsOnStep": 3
    }
  ]
}

Rules:
- 5 to 8 steps total
- For parallel steps (sequential: false that run simultaneously), BOTH can have status "active" at the same time — this is correct and expected
- For non-parallel cases, only one step is "active"
- All steps before the first active step should be "done", all steps after the last active step should be "upcoming"
- Step labels must name real organisations and real document types from the case
- Use the document names and case description together to infer what has ALREADY happened. Be precise:
  - Only mark the SAR request step as "done" if a document name explicitly indicates a CIFAS SAR response (e.g. contains "SAR", "subject access", "CIFAS data", "CIFAS response")
  - If a document name indicates a letter or email FROM the employer (e.g. "employer letter", "YBS letter", "confirmation from employer", "job offer withdrawal"), mark the step for receiving/obtaining employer confirmation as "done"
  - If a document name indicates a letter or email FROM the filing member (e.g. "Monese response", "filing member letter"), mark the step for contacting the filing member as "done"
  - Do not guess — only mark a step done if the document clearly corresponds to it
- Sending a letter does NOT complete a step — a step is only done when a response has been received and acted on. If the context says a letter was sent but no response received, keep that step as "active".
- If a completedStepLabel is provided in the progress context, mark THAT step as "done". Do not mark other steps as done unless documents or the case description explicitly confirm them.
- If a decoded response context says a step is still awaiting a reply, keep it as "active" — even if a different step has been confirmed done.
- CRITICAL — parallel steps: if two steps are running in parallel (sequential: false) and only one has been resolved, the other must remain "active". Never collapse a parallel track just because the other track advanced. Example: if "Write to Monese" is resolved but "Write holding letter to employer" has not been confirmed done, the employer step must stay "active".
- If the decoded response says a marker has been removed, the active step on the Monese track should be "Obtain CIFAS verification of removal" — but any unresolved parallel employer track must remain "active" alongside it
- The active step must reflect where the user actually is RIGHT NOW based on the progress context
- sequential: set to true if this step has a genuine dependency on a prior step. Set to false only if a step has NO dependency at all and can be done at any time.
- dependsOnStep: the 1-based step number this step depends on. Always set this when sequential is true.
- PARALLEL STEPS: steps that can run simultaneously but both depend on the same prior step should BOTH have sequential: true and the SAME dependsOnStep. Example: step 3a (Write to filing member) and step 3b (Write holding letter to employer) both depend on step 2 (Review SAR). Set both to sequential: true, dependsOnStep: 2. They will unlock simultaneously when step 2 is done and can both be active at the same time. They do NOT depend on each other.
- Step 4 (Obtain CIFAS verification) depends on step 3a (Write to filing member) only — NOT on step 3b (employer letter). Set dependsOnStep to the step number of the filing member step.
- lockedReason: only set if sequential is true`,
        },
      ],
    })

    const raw = message.content[0]
    if (raw.type !== 'text') throw new Error('Unexpected response type')

    const clean = raw.text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    let result
    try {
      result = JSON.parse(clean)
    } catch {
      const match = clean.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Could not parse AI response as JSON')
      result = JSON.parse(match[0])
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[/api/case-timeline]', err)
    return NextResponse.json({ error: 'Could not generate case timeline.' }, { status: 500 })
  }
}
