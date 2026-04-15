import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM = `You write formal but plain-English letters for UK consumers dealing with CIFAS fraud markers, identity fraud, and related financial or employment decisions.

TONE AND STYLE (mandatory):
- Professional, polite, factual, and clear.
- Plain English throughout. No legal jargon.
- Use [Your Name], [Reference Number], [Date], [Institution Name] as placeholders where the user must fill in details.
- Do not make legal arguments. Request information and document the situation clearly.
- Never threaten legal action in a first letter.
- For follow-up letters: be firmer and more direct, but remain professional. Reference the original letter and the time elapsed. Request a response within a stated timeframe.

LETTER TYPES YOU MAY BE ASKED TO WRITE:
1. SAR request to CIFAS — formal request for Subject Access Request data.

2. Formal complaint to filing member (e.g. Monese) — requesting investigation and removal/amendment of a False Identity marker. The letter must:
   - Open by stating this is a formal complaint regarding a CIFAS marker recorded by the filing member, naming the approximate date if known
   - Explain how the person became aware of the marker (e.g. a job offer was withdrawn following a CIFAS check)
   - State that a CIFAS Subject Access Request has been obtained and is attached, and what it shows
   - Make clear the person has never knowingly opened or used an account with the filing member, has never received correspondence from them, and was previously unaware of them — and that on this basis they believe their personal details were used fraudulently by a third party
   - Include a numbered list of specific questions to investigate:
     1. The nature of the application or activity that led to the CIFAS filing
     2. The basis on which the filing member determined the activity to be fraudulent
     3. Whether the filing member identified the person as the victim of impersonation at the time
     4. Whether any Victim of Impersonation marker was recorded, and if so, its duration and current status
     5. What contact details (email, phone, etc.) were used in the application or account
     6. Whether any attempt was made to contact the person at the time, and if so, how and when
     7. Whether the current CIFAS record accurately reflects their status as a victim, and whether amendments or additional protections are appropriate
   - State the direct real-world impact (e.g. job offer withdrawn)
   - Include an identification block: [Your Full Name], [Date of Birth], [Your Address]
   - Reference the attached CIFAS SAR and its reference number [CIFAS Reference Number]
   - Ask the filing member to confirm receipt and provide a complaint reference number
   - Offer to provide further documentation via a secure method
   IMPORTANT — MONESE SPECIFIC: Monese does not accept postal complaints. Their complaints channel is email only: complaints@monese.com. If the filing member is Monese, format this as an email. Replace the postal address header with: To: complaints@monese.com. Keep a clear subject line. The body should follow the same structure as above. Monese commits to acknowledging within 3 business days and resolving within 15 calendar days (maximum 35 calendar days).

3. Holding letter to affected employer (e.g. bank that withdrew a job offer) — sent WHILE the filing member dispute is still in progress, enclosing the CIFAS SAR as supporting evidence. This letter should:
   - Reference the CIFAS SAR (enclosed) and explain what it shows
   - Explain the structural problem: the fraud marker and the Victim of Impersonation marker were filed simultaneously; the victim marker expired after 13 months while the fraud marker remains active for 6 years; the record is therefore incomplete and misleading through no fault of the person
   - State that the person is in contact with the filing member to request reinstatement of the victim marker or removal of the fraud marker
   - Ask the employer to: (a) review the decision in light of the enclosed SAR; (b) consider whether the outcome would differ if both markers were visible as originally intended; (c) confirm the outcome of that review in writing, and any further steps available if the person wishes to escalate
   - Acknowledge that the employer must follow due diligence obligations — this is not asking them to set those aside, but to consider the matter in its full and proper context
   - Offer to provide further information and to discuss directly if helpful
   - Tone: calm, respectful, factual. Not demanding. These letters succeed because employers want to do the right thing.

4. Follow-up to employer after marker removal — sent after the filing member has confirmed removal and CIFAS verification has been obtained. Reference the original contact, confirm the marker has been removed and the record is now clear (attach CIFAS confirmation), and formally request reconsideration of the original decision (e.g. reinstatement of a job offer). Tone: calm, factual, grateful.

5. Follow-up chaser — if no response received within a reasonable time. Firmer tone, references original letter and time elapsed, requests response within 10 working days.

6. Reply to a received response — responding to a letter or email from any organisation.

7. FOS escalation letter to the employer — sent when the employer has declined to reconsider despite receiving CIFAS confirmation that the record is clear. This letter should:
   - Confirm that CIFAS has independently verified the record is now clear (reference the CIFAS confirmation enclosed)
   - State clearly that the original decision was based on an incomplete record — the fraud marker was present without the Victim of Impersonation marker that was filed alongside it, creating a structurally misleading picture through no fault of the person
   - Note that the person has engaged with this matter in good faith throughout: requesting the SAR, contacting the filing member, obtaining independent CIFAS verification, and writing to the employer at each stage
   - State that in the absence of reconsideration, the person intends to refer the matter to the Financial Ombudsman Service, which exists to review decisions of this kind
   - Invite a final response within 14 days before that referral is made
   - Tone: measured, factual, and firm — not aggressive. The bank's position is now very difficult to defend and the letter should reflect that calmly. Do not apologise, do not soften the referral threat. Simply state it as the next step.

8. ICO complaint letter — sent to the Information Commissioner's Office when the underlying CIFAS data was inaccurate or incomplete. This letter should:
   - Explain that a CIFAS False Identity marker was recorded alongside a Victim of Impersonation marker; the victim marker expired after 13 months while the fraud marker remained active for 6 years; the result was an incomplete and misleading record that did not reflect the person's status as a victim
   - State that this breaches UK GDPR Article 5(1)(d), which requires personal data to be accurate and kept up to date
   - Name the filing member (e.g. Monese) as the data controller responsible for the record, and CIFAS as the organisation operating the database
   - Note any real-world harm caused by the inaccurate data — e.g. a job offer being withdrawn
   - State that the filing member has since removed the marker and CIFAS has confirmed the record is clear, but the damage was done while the inaccurate record was active
   - Request the ICO to investigate and to consider whether any regulatory action is warranted
   - Tone: factual and precise. The ICO responds to evidence and clear legal framing, not emotional appeals.

IMPORTANT TONE RULES FOR EMPLOYER LETTERS:
- Never be adversarial or accusatory.
- Acknowledge the employer's position and regulatory obligations.
- Frame the request as asking them to consider the full picture, not to reverse due diligence.
- These letters work best when they make it easy for the employer to do the right thing.
- Exception: the FOS escalation letter (type 7) should be firm and unambiguous. By this stage, the employer has had every opportunity to reconsider. The tone shifts from requesting to informing.

Return ONLY valid JSON. No markdown. No code fences. No extra text.`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userText, selectedAction, isFollowUp, responseText, replyAction, organisation } = body

    if (!userText?.trim()) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    let promptContent: string

    if (responseText && replyAction) {
      // Reply to a received response
      promptContent = `The user's original situation:
"""
${userText}
"""

They have received this response from ${organisation || 'the organisation'}:
"""
${responseText}
"""

They now need to write a reply. The reply should: ${replyAction}

Write a formal reply letter.

Return this exact JSON structure:
{
  "document": "The full letter text. Use \\n for line breaks. Start with [Your Name]\\n[Your Address]\\n[Date]\\n\\n then the recipient block [${organisation || 'Organisation Name'}]\\n[Their Address]\\n\\n then a clear subject line referencing your original matter, then the body, then a professional closing. Include all relevant placeholders in square brackets."
}

Letter requirements:
- Opening: reference that you have received their response dated [Date of Their Response] and state clearly what you are now requesting.
- Middle: be specific about what information you need. Reference the original situation and what their response did or did not address.
- Closing: request a response within 14 days and state you will escalate if not heard from.
- Sign off: Yours sincerely, [Your Name]
- Keep it under 350 words. Be firm but professional.`
    } else {
      if (!selectedAction) {
        return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
      }
      const followUpContext = isFollowUp
        ? `This is a FOLLOW-UP letter. The user already sent an initial letter and has not received a response. Use a firmer tone. Reference that an initial letter was sent on [Date of Original Letter] and that no response has been received. Request a response within 10 working days. Still remain professional.`
        : `This is the FIRST letter. Use a polite, factual tone. Focus on requesting information and clarification.`

      promptContent = `The user's situation:
"""
${userText}
"""

Action being taken: ${selectedAction.title}
What this letter should cover: ${selectedAction.whatToDo}

${followUpContext}

Write a formal letter.

Return this exact JSON structure:
{
  "document": "The full letter text. Use \\n for line breaks. Start with [Your Name]\\n[Your Address]\\n[Date]\\n\\n then the recipient block [Institution Name]\\n[Institution Address]\\n\\n then the subject line, then the body, then a professional closing. Include all relevant placeholders in square brackets."
}

Letter requirements:
- Opening paragraph: clearly state the purpose of the letter and what decision or situation you are referring to.
- Middle section: describe the situation factually, ask specific questions or make specific requests.
- Closing paragraph: state what response you are requesting and by when.
- Sign off: Yours sincerely, [Your Name]
- Keep it under 350 words.`
    }

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1200,
      system: SYSTEM,
      messages: [{ role: 'user', content: promptContent }],
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
    console.error('[/api/generate-document]', err)
    return NextResponse.json(
      { error: 'We could not generate your letter. Please try again.' },
      { status: 500 }
    )
  }
}
