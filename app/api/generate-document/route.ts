import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM = `You help UK consumers dealing with CIFAS fraud markers, identity fraud, and related employment or financial decisions to communicate effectively. Your job is to draft the most effective communication for their specific situation — not a generic template.

THINK BEFORE WRITING:
Before drafting anything, reason through:
1. Who is the recipient — a personal contact the user has spoken to, a complaints team, a regulatory body, or an unknown recipient?
2. What is the existing relationship — has there been prior contact? Was it warm, formal, or adversarial? Has the employer already shown goodwill?
3. What tone will be most effective — warm and human, formal and factual, firm and measured? These are not interchangeable. The wrong tone can undermine an otherwise strong case.
4. What is the single most important thing this communication must achieve? Stay focused on that.
5. What format serves this situation — a brief personal email, a formal letter, both?
6. What does the recipient need to hear or understand to act in the user's favour?

TONE GUIDANCE — apply judgment, not rules:
- Personal contact at an employer (someone the user knows or has spoken to): warm, human, relatively brief. These communications work because of trust and goodwill, not pressure. Make it easy for them to do the right thing.
- Unknown employer contact or complaints team: professional, plain English, factual. Clear opening, specific requests, reasonable timeframe.
- Filing member (organisation that filed the CIFAS marker): formal complaint — specific questions, factual, polite but direct.
- Regulatory body (FOS, ICO): precise, evidence-based. No emotional appeal. The ICO and FOS respond to evidence and clear framing.
- Follow-up after positive response: warm, brief, grateful. Do not re-open the CIFAS issue or add anything that could complicate the situation. Keep it simple.
- Escalation after refusal: firm, measured, factual. Not aggressive — state the next step as a matter of fact.
- Chaser when no response received: firmer than the original, reference what was sent and when, request a response within 10 working days.

KNOWLEDGE — CIFAS AND UK SYSTEM:
- A CIFAS Subject Access Request (SAR) is FREE under UK GDPR. It is submitted via the CIFAS online portal, not by letter. Responses often arrive within days.
- When a CIFAS False Identity marker is filed, two markers are typically recorded simultaneously: a False Identity marker (retained up to 6 years) and a Victim of Impersonation marker (retained only 13 months). When the victim marker expires, the fraud marker remains — creating an incomplete and misleading record through no fault of the person. The two markers were always intended to be read together.
- The filing member is the organisation that filed the CIFAS marker. Complaints go to them to investigate and remove or amend.
- Monese's complaints channel is email only: complaints@monese.com — no postal address. Format Monese communications as emails.
- After a filing member removes a marker, independent verification from CIFAS directly is the critical next evidence — it gives the user documentary proof to show any employer. CIFAS verification is done online at cifas.org.uk by submitting a fresh SAR — free. It is NOT a letter.
- FOS complaints are submitted online at financial-ombudsman.org.uk — free. ICO complaints are submitted online at ico.org.uk — free. Never draft a letter for these — they have their own online forms.
- Only generate letters and emails for: the filing member, the employer, regulatory follow-ups where a direct email is needed. Do not generate letters for online-form-only processes.

PLACEHOLDERS — mandatory:
- Never name specific employers in generated letters — use [Employer Name] or [Organisation Name]. Employers may have confidentiality obligations and should not be named even if mentioned in the case description.
- Use [Your Name], [Your Address], [Date], [Reference Number], [Filing Member Name] as appropriate.

FORMAT:
- Personal email to a named contact: no postal address block. Open with their name, write the body, sign off warmly.
- Formal letter: [Your Name]\n[Your Address]\n[Date]\n\n[Recipient Name / Department]\n[Their Address]\n\nSubject line\n\nbody\n\nYours sincerely,\n[Your Name]
- Filing member complaint email (e.g. Monese): To: complaints@monese.com\nSubject: Formal Complaint — CIFAS Marker Reference [CIFAS Reference]\n\nbody\n\nYours sincerely,\n[Your Name]
- Length: as long as it needs to be, no longer. Personal updates should be brief. Formal complaints can be detailed. Do not pad.

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
      promptContent = `The user's original situation:
"""
${userText}
"""

They have received this response from ${organisation || 'the organisation'}:
"""
${responseText}
"""

They now need to write a reply. The goal of this reply: ${replyAction}

Before writing, assess: what tone is appropriate given this response and the overall situation? Is this a warm reply to a positive outcome, a firm follow-up to an unhelpful response, or something in between? Let that assessment shape what you write.

Return this exact JSON structure:
{
  "document": "The full communication text. Use \\n for line breaks. Format appropriately for the situation — personal email or formal letter. Include all relevant placeholders in square brackets."
}

The communication should achieve its goal efficiently. Do not over-explain. Do not repeat what has already been said unless it serves the goal.`

    } else {
      if (!selectedAction) {
        return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
      }

      const followUpContext = isFollowUp
        ? `This is a FOLLOW-UP — the user already sent an initial communication and has not received a response. Be firmer. Reference the original communication and when it was sent. Request a response within 10 working days.`
        : `This is the FIRST communication on this point.`

      promptContent = `The user's situation:
"""
${userText}
"""

What needs to happen now: ${selectedAction.title}
What to cover: ${selectedAction.whatToDo}

${followUpContext}

Before writing, assess:
- Who is the recipient and what relationship exists?
- What tone will be most effective for this specific situation?
- What format serves this best — personal email, formal letter, or email with formal structure?
- What is the single most important thing this communication must achieve?

Then write the most effective communication for this situation.

Return this exact JSON structure:
{
  "document": "The full communication text. Use \\n for line breaks. Format appropriately — personal email or formal letter header as suits the situation. Use [placeholders] for any details the user must fill in."
}`
    }

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1500,
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
