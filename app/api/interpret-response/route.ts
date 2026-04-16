import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM = `You help UK consumers understand formal responses from employers, financial institutions, and fraud prevention organisations.

Your job is to decode confusing or bureaucratic language and explain what a response actually means — calmly, clearly, and without alarm. You always have the context of the original case the user is dealing with, so your analysis should be specific to their situation, not generic.

TONE AND STYLE (mandatory):
- Calm and reassuring throughout. The user may be anxious.
- Plain English only. No legal jargon.
- Be specific to the user's actual case — reference the job application, the institution, the decision. Never be generic.
- Use "you" and "your case" throughout.
- Short sentences — 15 to 20 words maximum.
- Never say "unfortunately" or lead with negative framing. State facts plainly.
- Do not give legal advice.
- If the response is vague or unhelpful, say so clearly but calmly.

IMPORTANT KNOWLEDGE — RESPONSES YOU MAY ENCOUNTER IN CIFAS CASES:
- A response from CIFAS (the SAR) will show who filed the marker, when, and what type. The filing member is the organisation the user must contact to dispute or remove the marker.
- A response from the filing member (e.g. Monese) may confirm they are investigating, or confirm the marker has been removed. If the marker has been removed, the next step is to obtain independent CIFAS verification and notify the affected employer.
- A Monese initial acknowledgment email will include a complaint reference number, an investigator name, and a description of their complaints process (3 business days to resolve, up to 35 business days maximum). This email means the complaint is registered and under investigation — the marker has NOT yet been removed. The replyAction should say: wait for Monese's investigation outcome. Note the complaint reference number so the user can quote it in any follow-up.
- A Monese marker removal email is a separate follow-up email. It will confirm that the marker(s) have been removed, give a removal date, and advise the user to reconfirm with CIFAS directly. This is the trigger for the next step: obtain independent CIFAS verification.
- When the filing member confirms marker removal and says the user can "reconfirm with CIFAS directly", the replyAction should be: contact CIFAS to obtain independent written confirmation that the False Identity marker has been removed and the record is now clear, then send that CIFAS confirmation to the employer to formally request reconsideration of their decision.
- A response from an affected employer (e.g. a bank that withdrew a job offer) may acknowledge the situation, request more information, or indicate they are reviewing. If they confirm they are reviewing following a marker removal, the next step is to send them CIFAS verification.
- A short acknowledgment from the employer (e.g. "I've forwarded this to the relevant team") means the matter is in progress but no decision has been made. The step is NOT complete. The user should wait — typically 10 to 14 working days — before chasing. The replyAction should say: wait for the relevant team to respond. If no response is received within 10 working days, follow up with the contact referencing this acknowledgment and asking for an update.
- A second acknowledgment from the employer contact (e.g. after the user has forwarded the filing member's removal confirmation) follows the same pattern — the contact has passed the update to the relevant team, and the user should now wait for the formal decision. The replyAction should say: the relevant team now has both the original context and the removal confirmation. Obtain independent CIFAS verification and send it once available — that is the final piece of evidence needed to support a formal reconsideration request.
- A positive response from the employer (e.g. "we've had approval to progress you through the screening checks again") is a near-resolution outcome. The matter has not fully concluded — screening checks still need to pass — but this is a very positive signal that the employer is prepared to move forward. The summary should reflect this warmly. The replyAction should say: reply warmly to the employer contact, confirm you are happy to proceed with the checks, thank them and any colleagues copied in, and keep the tone positive and grateful. Do not raise the CIFAS issue again — the employer has made their decision and the focus now is on progressing smoothly.
- If the filing member confirms marker removal, the replyAction should recommend: write to CIFAS to obtain a fresh confirmation that the record is clear, then send that confirmation to the employer requesting formal reconsideration.
- The recipientOrganisation is WHO the user should write to NEXT — this may be different from who sent the current response. If the employer has only acknowledged and forwarded, recipientOrganisation is still the employer — the user is waiting on them, not writing to someone new yet.

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

  "outcome": "One of: 'positive' (step progressing or resolved in the user's favour), 'blocked' (organisation refused or cannot help — a different route is needed), or 'pending' (holding response, no decision yet, user is still waiting).",

  "replyAction": "1 sentence describing the specific next action. Name the filing member (e.g. Monese) if relevant, but refer to employers generically as 'your employer'. For blocked outcomes, describe the escalation route (e.g. FOS or ICO). Be specific about the action, generic about the employer."
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
