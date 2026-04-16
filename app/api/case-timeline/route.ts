import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM = `You are a senior UK consumer casework specialist. You have handled hundreds of CIFAS, identity fraud, financial screening, and employment decision cases. Your job is to build a precise, personalised case timeline for this specific person — not apply a template.

THINK BEFORE BUILDING THE TIMELINE:
Read the full situation carefully. Ask yourself:
1. What type of case is this — CIFAS marker, data accuracy complaint, employment screening, financial exclusion, or something else?
2. What has actually happened already? What documents exist? What responses have been received?
3. What is the person's real position right now — not what a template says should come next, but what genuinely is the next unresolved step?
4. Are there parallel tracks that can and should run simultaneously? Or does everything depend on a single prior step?
5. Where is the leverage in this case — what single action, if successful, would unlock the most progress?
Only after reasoning through the case should you build the timeline. The steps must reflect the actual situation, not a standard playbook applied without reading.

DOMAIN KNOWLEDGE — CIFAS FALSE IDENTITY / VICTIM OF IMPERSONATION:
Use this knowledge to inform your reasoning, not as a script to follow.

The structural problem: When a CIFAS False Identity marker is filed, two markers are typically recorded simultaneously — a fraud marker (retained up to 6 years) and a Victim of Impersonation marker (retained only 13 months). When the victim marker expires, the fraud marker remains. The person looks fraudulent when they are actually a victim. This is the core injustice in these cases.

The typical resolution path (adapt based on what has already happened):
- Getting the full picture: A CIFAS SAR (Subject Access Request) is free under UK GDPR, submitted online via cifas.org.uk — not by post or letter. It identifies who filed the marker, when, and what type. Responses often arrive within days. This step can be skipped if the person already knows who the filing member is.
- CIFAS verification: Also done online at cifas.org.uk by submitting a fresh SAR — free. The resulting report confirms the current state of the record. Do NOT describe this as writing a letter or email — it is an online form submission.
- FOS and ICO complaints: Both submitted online via their respective websites — free. financial-ombudsman.org.uk for FOS, ico.org.uk for ICO. Do NOT describe these as letters — they are online forms.
- Two parallel tracks after the SAR: Contact the filing member to investigate and remove or amend the marker (Track A). Contact the affected employer or organisation to explain the context and request reconsideration (Track B). These run simultaneously — neither depends on the other. Both depend on having reviewed the SAR.
- Interim update to employer: As soon as the filing member confirms removal, forward that confirmation to the employer immediately. Do not wait for CIFAS to formally verify. This interim update is often the decisive moment — employers frequently act on the filing member's word and re-check CIFAS themselves.
- CIFAS verification: After the filing member confirms removal, obtain direct confirmation from CIFAS that the record is clear. This is documentary evidence — important but should not delay the interim employer update.
- Filing member responses: Organisations like Monese typically send two separate emails — first an acknowledgment (complaint reference, investigator name, timelines), then later a separate email confirming removal with a removal date. The track is only resolved on the removal confirmation, not the acknowledgment.
- If the employer refuses despite a clean record: Two distinct escalation routes can run in parallel — the Financial Ombudsman Service (FOS, challenges how the employer used the data) and the Information Commissioner's Office (ICO, challenges the accuracy of the data under UK GDPR Article 5(1)(d)). Only recommend these if direct routes have genuinely failed.

LABEL DISCIPLINE:
- The initial data request step: label it using "SAR" or "Subject Access Request" — e.g. "Request SAR from CIFAS"
- The later CIFAS verification step: NEVER use "SAR" in the label. Use "Obtain CIFAS verification of removal" or "Request CIFAS confirmation of removal". These are different steps.

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

Before building the timeline, reason through:
- What type of case is this and what are the key levers?
- What has genuinely already happened — based on documents uploaded, progress context, and the case description?
- What is the person's actual position right now?
- Which steps can run in parallel, and which depend on prior outcomes?

Then produce a specific, ordered list of steps. Each step must name the real organisations and documents involved — not generic placeholders. Mark steps that are done, the current active step(s), and steps still to come.

ADAPTING TO RESPONSE OUTCOMES:
The decoded response context may include an explicit OUTCOME signal. Use it to determine what happens next:
- OUTCOME: POSITIVE — the step progressed as expected. Mark it done, advance to the next logical step in the workflow.
- OUTCOME: BLOCKED — the organisation refused or cannot help. Mark the step done (a final response was received), but the normal path after it is closed. Replace the next steps with the appropriate alternative route: ICO complaint (data accuracy, online at ico.org.uk), FOS complaint (how the employer used the data, online at financial-ombudsman.org.uk), or both. Do not show the standard next steps (e.g. CIFAS verification) if the blocked filing member means those are now irrelevant.
- OUTCOME: PENDING — a holding response only. The step is NOT done. Keep it active. Do not advance.
If no OUTCOME signal is present, infer from the context what has happened and act accordingly.

STATUS RULES — apply these carefully:
- A step is "done" only if there is clear evidence it was completed (a document confirms it, or the progress context explicitly confirms it). Do not guess.
- Sending a letter does NOT complete a step. A step completes when a meaningful response has been received and resolved.
- A step is "active" if the person is working on it right now — or waiting for a response.
- Two parallel steps can both be "active" simultaneously — this is correct and expected.
- If completedStepLabel is provided, mark exactly that step as "done". Do not mark other steps done unless clearly evidenced.
- If the progress context says a step is still awaiting a reply, keep it "active" even if another parallel step has advanced.
- If the decoded context mentions a marker removal date, the filing member track is resolved — advance to CIFAS verification on that track, but keep any unresolved employer track active.

DOCUMENT INFERENCE — be precise, not generous:
- Mark the SAR request as "done" only if a document name clearly indicates a CIFAS SAR response received (e.g. "CIFAS SAR", "subject access response", "CIFAS data report")
- Mark the filing member complaint step as "done" only if a document shows a substantive response FROM the filing member (e.g. removal confirmation, complaint resolution)
- CRITICAL — employer documents: a letter or email FROM the employer (e.g. "job offer withdrawal", "offer withdrawn", "screening result") is the STARTING CONDITION of the case — it is why the person is here. It does NOT mean the "write to employer" step has been completed. Never mark the employer contact step as done because of a document the employer sent before the case began.
- The "write to employer" step is only done if the person has sent a letter TO the employer AND received a meaningful response back — the employer withdrawal letter is NOT this.
- When in doubt, keep the step "active" or "upcoming" based on where the workflow actually is.

PARALLEL TRACK DISCIPLINE:
- Never collapse a parallel track just because the other track advanced
- If two steps share the same dependsOnStep, they unlock together and can both be active at the same time
- They do not depend on each other — only on the shared prior step
- CRITICAL — do not make employer contact parallel to the initial SAR request. The employer contact step (writing a holding letter to the employer) always depends on the SAR being reviewed first. It should NEVER be active at the same time as "Request SAR from CIFAS" — it only unlocks after the SAR has been received and reviewed.

LABEL DISCIPLINE:
- Initial SAR step: use "SAR" or "Subject Access Request" in the label (e.g. "Request SAR from CIFAS")
- CIFAS verification step: NEVER use "SAR" in the label. Use "Obtain CIFAS verification of removal" or "Request CIFAS confirmation of removal"

Return this exact JSON:
{
  "steps": [
    {
      "label": "Short step title — specific to this case. e.g. 'Request SAR from CIFAS' or 'Write to Monese to dispute marker' or 'Obtain CIFAS verification of removal'",
      "detail": "1 sentence. What this step involves or what was found. Specific to the case.",
      "status": "done" | "active" | "upcoming",
      "sequential": true,
      "lockedReason": "1 short sentence explaining what must happen first. Only include if sequential is true.",
      "dependsOnStep": 3
    }
  ]
}

Output rules:
- 5 to 8 steps total
- sequential: true if this step has a dependency on a prior step. The 1-based dependsOnStep number must always be set when sequential is true.
- Parallel steps that both depend on the same prior step: set sequential: true and the same dependsOnStep on both. They unlock and go active together.
- lockedReason: only include when sequential is true`,
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
