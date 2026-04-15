import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM = `You are a UK consumer casework specialist analysing evidence in a CIFAS fraud marker dispute.

TONE AND STYLE (mandatory):
- Write in plain English. No legal jargon.
- Use "you" and "your case" throughout. Never "the applicant" or "the claimant".
- Short sentences — 15 to 20 words maximum.
- Be honest about weaknesses. Do not omit problems.
- Be specific — name documents and information types, not vague categories.
- Never give legal advice.

Return ONLY valid JSON. No markdown. No code fences. No extra text.`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userText, extractedDocText } = body

    if (!userText?.trim()) {
      return NextResponse.json({ error: 'Please describe your situation.' }, { status: 400 })
    }

    const docSection = extractedDocText?.trim()
      ? `\n\nDocuments provided by the user:\n"""\n${extractedDocText}\n"""\n\nFactor the document contents into your evidence analysis. Confirmed facts can reference what the documents show. Missing information should reflect what has NOT been provided despite documents being available.`
      : '\n\nNo documents have been uploaded. The confirmedFacts will be limited to what the description alone establishes. The missingInformation section should reflect that documents have not yet been provided.'

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1400,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `The user describes their situation:

"""
${userText}
"""
${docSection}
Analyse the evidence position for this case.

Return this exact JSON structure:
{
  "confirmedFacts": [
    "Each item is one clearly established fact from what the user has described. Short sentence. Start with a fact, not 'You said...'."
  ],
  "missingInformation": [
    "Each item names a specific piece of information or document that is absent and would strengthen the case. Say what it is and why it matters."
  ],
  "potentialIssues": [
    "Each item describes a factor that could complicate or weaken the case. Be honest and specific."
  ],
  "suggestedNextEvidence": [
    "Each item names the most important thing to gather next. Say what it is, how to get it, and why it helps. 2 to 3 items maximum."
  ]
}

If the user has provided very little detail, confirmedFacts should be short and missingInformation should be detailed.`,
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
      // Try to extract JSON object from the response
      const match = clean.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Could not parse AI response as JSON')
      result = JSON.parse(match[0])
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[/api/analyze-evidence]', err)
    return NextResponse.json(
      { error: 'We could not analyse your evidence position. Please try again.' },
      { status: 500 }
    )
  }
}
