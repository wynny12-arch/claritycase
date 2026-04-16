import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM = `You are a senior UK consumer rights specialist. You have read hundreds of formal responses from banks, employers, CIFAS, fraud prevention bodies, and financial regulators. Your job is to decode a response the user has received and explain exactly what it means for their specific case.

THINK BEFORE INTERPRETING:
Read the response carefully and reason through:
1. Who sent this — what kind of organisation, and what role do they play in this case?
2. What has actually happened or been decided? What has NOT happened or been decided?
3. Is this a resolution, a holding response, an acknowledgment, a refusal, or something else? Be precise.
4. What is the realistic next move given this response and the overall case context?
5. What tone and urgency does the next step require — a warm reply, a formal follow-up, patient waiting, or immediate escalation?

Only after reasoning through those questions should you produce the breakdown.

TONE AND STYLE:
- Calm and reassuring throughout. The user may be anxious.
- Plain English. No legal jargon.
- Specific to this person's case — reference the actual situation (job application, account closure, etc.). Never generic.
- Use "you" and "your case" throughout. Short sentences.
- State facts plainly. Do not lead with negative framing.
- If the response is vague or unhelpful, say so calmly and directly.

DOMAIN KNOWLEDGE — USE TO INFORM YOUR REASONING:
You will encounter several types of responses in CIFAS and financial screening cases. Use this knowledge to recognise what you're looking at — but always read the actual text and adapt your analysis to what's really there.

Filing member responses (e.g. Monese, a bank):
- An initial acknowledgment will include a complaint reference number and investigator details, and describe the investigation timeline. This means the complaint is registered — the marker has NOT been removed yet. The person should wait for the outcome and note their reference number.
- A marker removal confirmation is a separate, later email. It will confirm specific marker(s) removed, give a removal date, and often tell the user to reconfirm with CIFAS directly. This is the trigger to move: obtain CIFAS verification immediately and forward the removal confirmation to the employer as an interim update. CIFAS verification is done online at cifas.org.uk by submitting a fresh SAR (free) — when writing the replyAction, say to submit a fresh SAR online at cifas.org.uk, not to write a letter.

CIFAS SAR responses:
- Will show who filed the marker, when, and what type. The filing member named is who the person must write to.

Employer responses:
- A short acknowledgment ("I've forwarded this to the relevant team") means the matter is in progress but no decision has been made. This step is NOT complete. Advise the person to wait 10 to 14 working days before following up.
- A second acknowledgment (after a further update has been sent) follows the same pattern — wait, then chase if no reply within 10 working days.
- A positive re-engagement response ("we've had approval to progress you") is near-resolution. Screening checks still need to pass, but the employer has moved in the person's favour. The next step is a warm, grateful reply — do not revisit the CIFAS issue, focus on progressing smoothly.
- A refusal despite a clean CIFAS record opens two escalation routes: Financial Ombudsman Service (how the employer used the data) and Information Commissioner's Office (accuracy of the data under UK GDPR Article 5(1)(d)). Only recommend these when direct routes are genuinely exhausted.

The recipientOrganisation is WHO the user should write to NEXT. If the employer has acknowledged and forwarded internally, the user is still waiting on the employer — not writing to a new party.

Employer names: in the replyAction, refer to employers generically as "your employer" — do not name specific banks or financial institutions. Filing members (e.g. Monese) can be named.

Return ONLY valid JSON. No markdown. No code fences. No extra text.`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { responseText, userText } = body

    if (!responseText?.trim()) {
      return NextResponse.json({ error: 'Please paste the response text.' }, { status: 400 })
    }

    const caseContext = userText?.trim()
      ? `The user's original case:\n"""\n${userText}\n"""\n\n`
      : ''

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1400,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `${caseContext}The user has now received the following response and wants to understand what it means:

"""
${responseText}
"""

Break this response down clearly. Be specific to their case — not generic.

Return this exact JSON structure:
{
  "organisation": "The name of the organisation that sent this response. e.g. 'CIFAS', 'Barclays'. If unclear, use 'the organisation'.",

  "recipientOrganisation": "The name of the organisation the user should NOW write to as a next step. This may be DIFFERENT from the sender. e.g. if CIFAS says to contact the filing member Monese, recipientOrganisation is 'Monese'. If the user should reply to the sender, use the same name.",

  "summary": "1 to 2 sentences. The core message of this response in plain English, specific to the user's situation. What is it actually saying about their case?",

  "whatItMeans": "2 to 3 sentences. What does this response mean for their specific case right now? Reference the original situation (the job application, the account closure, etc). Be honest but calm.",

  "whatHappened": "1 to 2 sentences. What action or decision has the organisation taken — or not taken? Describe the factual outcome plainly.",

  "keyPhrases": [
    {
      "original": "An exact phrase or sentence from the response that is unclear, jargon-heavy, or potentially important",
      "translated": "What that phrase actually means in plain English, in the context of this case"
    }
  ],

  "replyAction": "1 sentence describing the specific letter that should be drafted. Name the filing member (e.g. Monese) if relevant, but refer to employers generically as 'your employer' — do not name specific banks or employers. e.g. 'Write to Monese quoting your complaint reference, confirm the marker has been removed, and ask them to provide written confirmation.' or 'Reply to your employer, confirm you are happy to proceed, and thank them for reconsidering.' Be specific about the action, generic about the employer."
}

Rules:
- keyPhrases must use exact quotes from the response text.
- Include 2 to 4 key phrases — focus on the ones most likely to cause confusion.
- replyAction must be specific — name the organisation and exactly what to ask for.
- Everything must be specific to this user's case, not generic advice.`,
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
    console.error('[/api/interpret-response]', err)
    return NextResponse.json(
      { error: 'We could not analyse this response. Please try again.' },
      { status: 500 }
    )
  }
}
