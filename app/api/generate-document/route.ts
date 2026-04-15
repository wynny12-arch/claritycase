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
1. SAR request to CIFAS — IMPORTANT: the CIFAS SAR is NOT done by letter. It is submitted through the CIFAS online portal and costs £10. If asked to generate a document for this step, instead return a short plain-English guide explaining: go to the CIFAS website, find the Subject Access Request section, complete the online form, pay the £10 fee, and expect the response within 30 days. Do not generate a letter for this step.

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

3. Holding letter to affected employer (e.g. bank that withdrew a job offer) — sent WHILE the filing member dispute is still in progress, enclosing the CIFAS SAR as supporting evidence. This should read as a warm, human, personal email — not a formal complaint. The person is reaching out to someone they have likely already spoken to, to provide important context they weren't able to share before.

   Structure and content:
   - Open warmly — reference any prior contact if mentioned (a call, a conversation), thank them for their time and honesty. If no prior contact is known, open respectfully and personally.
   - Explain that since that conversation, the person has looked into the matter in detail and obtained their CIFAS Subject Access Request (attached)
   - Explain what the SAR shows in plain English: their personal details were used fraudulently by a third party in connection with an account application to [filing member]. They had no prior knowledge of this and had never had any dealings with [filing member].
   - Explain the structural problem clearly and accessibly — NOT in legal language: two markers were recorded at the same time. One recorded that fraud had occurred. A second confirmed their status as a victim of that fraud. CIFAS retains these for very different lengths of time — the victim marker expired after 13 months, the fraud marker remains active for up to 6 years. By the time the background check was carried out, the victim marker had already dropped off, leaving only the fraud marker visible. The two were always meant to be read together. Without the victim marker, the record presents an incomplete picture through no fault of the person.
   - State that the person has now formally contacted the filing member to investigate and resolve this — with the aim of having the marker removed or the record corrected.
   - Acknowledge clearly that the employer's original decision made sense based on what was visible at the time — this is not asking them to abandon due diligence.
   - Make a single, direct, human ask: given this additional context, is there any possibility of revisiting the decision?
   - Offer to discuss directly, provide further information, or have the matter escalated to the appropriate team if that would help.
   - Attach the CIFAS SAR and mention it. If the case mentions a formal write-up or supporting document, reference that as attached too.
   - Tone: warm, honest, human. This letter works because it treats the employer as a person who wants to do the right thing — not as an institution to be challenged. No numbered demands. No legal framing. One genuine ask.
   - Note: in real cases this email is accompanied by a separate formal PDF attachment (letter type 3b) for compliance or HR teams to review. Mention in the closing that a formal write-up is attached for anyone else who needs to review it.

3b. Formal reconsideration request (PDF attachment to employer email) — a separate formal document attached to the personal email to the employer. This is designed to be passed up the chain to compliance, HR, or anyone else who needs to review the matter formally. It should:
   - Open formally: "I am writing to request a reconsideration of a recent decision made in connection with my application, which I understand was affected by a CIFAS marker recorded against my details."
   - State clearly that the person is the victim of identity fraud, not the individual responsible
   - Explain that in [approximate date], an unknown third party used their personal details without knowledge or consent to make a fraudulent application to [filing member]
   - List the two CIFAS markers that were recorded as a numbered list:
     1. A False Identity marker — recorded on [date] and retained for up to six years
     2. A Victim of Impersonation marker — recorded at the same time to confirm their status as a victim, but retained for only 13 months
   - State that a CIFAS Subject Access Request has been obtained and is enclosed as evidence
   - Explain the structural problem plainly: the victim marker has expired while the fraud marker remains active; these were intended to be read together; without the victim marker the record presents an incomplete and potentially misleading picture; the person has no control over CIFAS retention policies
   - State that they are in contact with the filing member to request reinstatement or clarification of the Victim of Impersonation marker
   - Include three numbered requests:
     1. Review the decision in light of the enclosed CIFAS SAR, which confirms their status as a victim
     2. Consider whether the outcome would differ if both markers were visible, as originally intended
     3. Confirm the outcome of this review in writing, along with any further steps available if they wish to escalate
   - Acknowledge the need for due diligence and regulatory compliance — this is not asking for those to be set aside, but for the matter to be considered in its full and proper context
   - Offer to provide further information and to discuss directly if helpful
   - Close: Yours faithfully, [Your Name]
   - Tone: formal, factual, precise. This document may be read by compliance or legal teams — it must stand on its own without the personal context of the email.

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
