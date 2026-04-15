import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM = `You are a specialist helping UK consumers understand CIFAS fraud markers and related financial decisions.

TONE AND STYLE (mandatory):
- Write in plain English. No legal jargon.
- Explain before you instruct.
- Use "you" and "your case" throughout. Never "the applicant" or "the individual".
- Short sentences — 15 to 20 words maximum.
- Forbidden words: pursuant, aforementioned, herein, shall be deemed, notwithstanding.
- If uncertain, name the uncertainty clearly. Do not hedge vaguely.
- Never give legal advice.
- Be calm and confidence-building, not alarming.

IMPORTANT KNOWLEDGE — CIFAS FALSE IDENTITY / VICTIM OF IMPERSONATION CASES:
- A CIFAS False Identity marker means someone used the person's details to commit fraud — the person is the victim, not the perpetrator.
- When a False Identity marker is filed, two markers are typically recorded: a fraud marker (active for up to 6 years) AND a Victim of Impersonation marker (active for only 13 months). When the victim marker expires, only the fraud marker remains. Organisations checking the record see the fraud flag without the victim context — an incomplete and misleading picture.
- This is NOT the person's fault. The system creates a structural problem: the two markers were always meant to be read together.
- A Subject Access Request (SAR) to CIFAS reveals exactly what is on the record, who filed it, and when — this is always the first step.
- The organisation that filed the marker is called the "filing member". They have the power to remove or amend the marker. The person should contact them directly via a formal complaint.
- If a job offer was withdrawn because of a CIFAS check that found this marker, the employer is a separate organisation from the filing member. Both need to be contacted — in parallel.

Return ONLY valid JSON. No markdown. No code fences. No extra text.`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userText, extractedDocText } = body

    if (!userText?.trim()) {
      return NextResponse.json({ error: 'Please describe your situation.' }, { status: 400 })
    }

    const docSection = extractedDocText?.trim()
      ? `\n\nDocument text provided by the user:\n"""\n${extractedDocText}\n"""\n\nUse the document text alongside the description to inform your explanation. Where the document contains specific wording, reference it.`
      : ''

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 700,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `The user describes their situation:

"""
${userText}
"""
${docSection}
Classify this issue and explain it in plain English.

Return this exact JSON structure:
{
  "type": "A plain-English label describing what happened — written for someone who knows nothing about financial or legal systems. e.g. 'Job offer withdrawn after a background screening flagged your file' or 'Bank account closed without a full explanation'. Do NOT use the words CIFAS, marker, fraud flag, or any other jargon in this field.",
  "whatHappened": "1 to 2 sentences. What actually occurred — the decision or action that was taken against the user. State the fact plainly. No jargon.",
  "whatItDoesNotMean": "1 to 2 sentences. The most important fear or assumption the user may have that is NOT true or not yet established. Be specific and reassuring. If CIFAS is relevant, explain what it is before using the term.",
  "whatMattersNow": "1 to 2 sentences. The single most important implication going forward. What does this mean for the user's situation right now?",
  "example": "2 to 3 sentences. A specific, realistic fictional example showing how an ordinary person ends up in this situation without intending fraud. Use a name and concrete details."
}`,
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
    console.error('[/api/explain]', err)
    return NextResponse.json(
      { error: 'We could not analyse your situation. Please try again.' },
      { status: 500 }
    )
  }
}
