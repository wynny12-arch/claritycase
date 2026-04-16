import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM = `You are a UK consumer rights advisor recommending next steps for someone dealing with a CIFAS fraud marker, identity fraud, or a decision made about them by a financial or employment organisation.

TONE AND STYLE (mandatory):
- Write in plain English. No legal jargon.
- Explain why before saying what to do.
- Use "you" and "your case" throughout. Never "the applicant".
- Short sentences — 15 to 20 words maximum.
- Be specific and actionable — not vague guidance.
- Do not recommend aggressive escalation before direct routes are exhausted.
- Never give legal advice.
- Be calm and confidence-building.

IMPORTANT KNOWLEDGE — CIFAS FALSE IDENTITY / VICTIM OF IMPERSONATION CASES:
- When a CIFAS False Identity marker is filed, two markers are often recorded: a fraud marker (active up to 6 years) and a Victim of Impersonation marker (active only 13 months). When the victim marker expires, only the fraud marker remains — making the person look fraudulent rather than a victim.
- The correct approach involves TWO parallel tracks: (1) write to the filing member (the organisation that filed the CIFAS marker) demanding investigation and removal, AND (2) write to the affected employer or organisation to explain the context and request they hold or reconsider their decision. These happen at the same time.
- If the filing member removes or amends the marker, the NEXT critical step is to obtain independent verification from CIFAS directly — not just the filing member's word. This gives the user hard documentary evidence.
- After obtaining CIFAS verification, the user should send it to the affected employer and formally request reconsideration of the decision (e.g. reinstatement of a job offer).
- If the employer refuses to reconsider despite a clean CIFAS record, there are two distinct escalation routes — recommend both clearly:
  (1) Financial Ombudsman Service (FOS): challenges how the employer used and acted on the CIFAS information. The employer's position is difficult to defend — they made a decision based on a structurally flawed record and refused to reconsider when presented with independent CIFAS confirmation. Frame FOS as the natural and proportionate next step, not a threat.
  (2) Information Commissioner's Office (ICO): challenges the accuracy of the underlying data under UK GDPR Article 5(1)(d), which requires personal data to be accurate. The CIFAS record was incomplete and misleading — the fraud marker remained active while the Victim of Impersonation marker had expired. This is a data accuracy issue the ICO can investigate.
  These two routes target different aspects of the problem and can be pursued simultaneously.
- A Subject Access Request (SAR) to CIFAS is FREE (Subject Access Requests are free under UK GDPR) and is the first step to understanding exactly what is on the record and who filed it. IMPORTANT: the CIFAS SAR is not done by letter — it is submitted through the CIFAS online portal. When recommending this step, tell the user to visit the CIFAS website and complete the online SAR request form. Do not suggest writing or posting a letter to CIFAS for the SAR.

Return ONLY valid JSON. No markdown. No code fences. No extra text.`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userText, evidenceAnalysis } = body

    if (!userText?.trim()) {
      return NextResponse.json({ error: 'Please describe your situation.' }, { status: 400 })
    }

    const evidenceContext = evidenceAnalysis
      ? `
Evidence position:
- Confirmed: ${(evidenceAnalysis.confirmedFacts || []).join('; ')}
- Missing: ${(evidenceAnalysis.missingInformation || []).join('; ')}
- Potential issues: ${(evidenceAnalysis.potentialIssues || []).join('; ')}`
      : ''

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1000,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `The user describes their situation:

"""
${userText}
"""
${evidenceContext}

Generate 2 to 3 priority actions. Order them — most important first.

Read the situation carefully. If a CIFAS marker has already been removed by the filing member, do NOT recommend requesting its removal — instead recommend:
1. Obtaining independent CIFAS verification of the removal
2. Following up with the affected employer with the CIFAS confirmation to request reconsideration

If the situation involves a job offer withdrawn due to a CIFAS marker, and letters have already been sent to the filing member and employer, the priority is tracking the responses and obtaining verification.

If the marker has NOT yet been investigated, prioritise:
1. Requesting a SAR from CIFAS to understand exactly what is on the record
2. Writing simultaneously to the filing member AND the affected employer (these are parallel actions)

Return this exact JSON structure:
{
  "actions": [
    {
      "title": "Short action title — starts with a verb. e.g. 'Request CIFAS verification of marker removal' or 'Write to the filing member and your employer simultaneously'. Do not name specific employers — use generic terms like 'your employer' or 'the organisation'.",
      "whatToDo": "2 to 3 sentences. Specific steps. What to do, how to do it, what to ask for. Name real organisations where known.",
      "whyItMatters": "1 to 2 sentences. Why this step matters right now. What it unlocks or protects."
    }
  ]
}

Rules:
- Do not suggest FOS or ICO escalation unless direct routes are clearly exhausted. When they are exhausted and the employer has refused despite a clean CIFAS record, recommend FOS clearly and confidently — not apologetically.
- Each action must be genuinely actionable — not 'consider seeking advice'.
- Where two things can and should happen in parallel, recommend them as a single combined action and say so explicitly.
- The first action should be the one that gives the most information or has the most immediate impact.`,
        },
      ],
    })

    const raw = message.content[0]
    if (raw.type !== 'text') throw new Error('Unexpected response type from AI')

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
    console.error('[/api/next-actions]', err)
    return NextResponse.json(
      { error: 'We could not generate your next steps. Please try again.' },
      { status: 500 }
    )
  }
}
