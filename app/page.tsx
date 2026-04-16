'use client'

import { useState, useRef, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UploadedDoc {
  name: string
  fileType: string
  extractedText: string
}

interface ExplanationResult {
  type: string
  whatHappened: string
  whatItDoesNotMean: string
  whatMattersNow: string
  example: string
}

interface EvidenceAnalysis {
  confirmedFacts: string[]
  missingInformation: string[]
  potentialIssues: string[]
  suggestedNextEvidence: string[]
}

interface Action {
  title: string
  whatToDo: string
  whyItMatters: string
}

interface ResponseBreakdown {
  organisation: string
  recipientOrganisation: string
  summary: string
  whatItMeans: string
  whatHappened: string
  keyPhrases: { original: string; translated: string }[]
  replyAction: string
}

interface TimelineStep {
  label: string
  detail: string
  status: 'done' | 'active' | 'upcoming'
  sequential?: boolean
  lockedReason?: string
  dependsOnStep?: number  // 1-based index of the specific step this depends on
}

type Screen = 'welcome' | 'input' | 'timeline' | 'activity' | 'response'

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface TimelineCard {
  step: number
  label: string
  detail: string
  status: 'done' | 'active' | 'upcoming'
  isOpenable: boolean
  sequential: boolean
  lockedReason: string | null
  dependsOnStep: number | null
}

function TimelineSpine({
  cards,
  manuallyDone,
  sentStepLabels,
  onOpenStep,
}: {
  cards: TimelineCard[]
  manuallyDone: Set<number>
  sentStepLabels: Set<string>
  onOpenStep: (i: number) => void
}) {
  return (
    <div>
      <div className="flex">
        {cards.map((card, i) => {
          const isDone = card.status === 'done' || manuallyDone.has(i)
          const effectiveStatus: 'done' | 'active' | 'upcoming' = isDone ? 'done' : card.status
          const depIdx = card.dependsOnStep != null ? card.dependsOnStep - 1 : i - 1
          const depCard = depIdx >= 0 ? cards[depIdx] : null
          const depIsDone = depIdx < 0 || (depCard != null && (depCard.status === 'done' || manuallyDone.has(depIdx)))
          const isLocked = card.sequential && !depIsDone && !isDone

          const dotStyle = isLocked
            ? 'bg-[#0b1020] border-gray-700'
            : isDone
            ? 'bg-green-500 border-green-500'
            : card.status === 'active'
            ? 'bg-blue-500 border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.7)]'
            : 'bg-[#0b1020] border-gray-600'
          const connectorStyle = isDone ? 'bg-green-500/40' : 'bg-gray-700'

          return (
            <div key={i} className="relative flex-1 flex flex-col items-center px-1.5">
              {/* Per-item horizontal line segment — adjacent segments form a continuous line */}
              <div className="absolute top-[5px] left-0 right-0 h-px bg-gray-700" />
              <div className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 relative z-10 ${dotStyle}`} />
              <div className={`w-px h-5 flex-shrink-0 ${connectorStyle}`} />
              <div className={`w-full bg-[#11182b] border rounded-xl p-3 text-left transition-all ${
                isLocked
                  ? 'border-gray-700/50 opacity-35 cursor-not-allowed'
                  : effectiveStatus === 'active'
                  ? 'border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.08)]'
                  : effectiveStatus === 'upcoming'
                  ? 'border-gray-700 opacity-40'
                  : 'border-gray-700'
              }`}>
                <p className="text-[10px] text-gray-500 mb-1.5">Step {card.step}</p>
                <p className="text-[11px] text-white font-medium leading-snug line-clamp-3 min-h-[2.75rem] mb-2">{card.label}</p>
                {isLocked ? (
                  <p className="text-[10px] text-gray-600 leading-snug line-clamp-2">🔒 {card.lockedReason}</p>
                ) : card.isOpenable && !isDone && !sentStepLabels.has(card.label) ? (
                  <button
                    onClick={() => onOpenStep(i)}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                  >
                    Open →
                  </button>
                ) : (
                  <StatusBadge status={effectiveStatus} />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LetterDisplay({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g)
  return (
    <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-white">
      {parts.map((part, i) =>
        /^\[.+\]$/.test(part) ? (
          <mark key={i} className="bg-yellow-500/20 text-yellow-400 rounded px-0.5 not-italic font-semibold">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </pre>
  )
}

function PageTitle({ step, title }: { step: string; title: string }) {
  return (
    <h1 className="text-4xl font-black text-white leading-tight tracking-tight">
      {step} · {title}
    </h1>
  )
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-gray-400 text-sm py-3">
      <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin flex-shrink-0" />
      <span>{label}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: 'done' | 'active' | 'upcoming' }) {
  if (status === 'done') {
    return <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Complete</span>
  }
  if (status === 'active') {
    return <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">In progress</span>
  }
  return <span className="text-xs bg-gray-700/60 text-gray-500 px-2 py-1 rounded">Not started</span>
}

function Header({ onBack, backLabel, title, right }: {
  onBack?: () => void
  backLabel?: string
  title: string
  right?: React.ReactNode
}) {
  return (
    <header className="sticky top-0 z-50 bg-[#0d1427] h-14 flex items-center border-b border-gray-800">
      <div className="max-w-6xl mx-auto w-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="text-gray-500 hover:text-white text-sm transition-colors mr-1">
              ← {backLabel || ''}
            </button>
          )}
          <span className="text-white font-semibold text-sm">{title}</span>
        </div>
        {right}
      </div>
    </header>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const [screen, setScreen] = useState<Screen>('welcome')
  const [userText, setUserText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [manuallyDone, setManuallyDone] = useState<Set<number>>(new Set())

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadTab, setUploadTab] = useState<'file' | 'paste'>('file')
  const [pasteDocText, setPasteDocText] = useState('')
  const [pasteDocName, setPasteDocName] = useState('')

  // Response file upload
  const responseFileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingResponseFile, setUploadingResponseFile] = useState(false)

  // Results
  const [explanation, setExplanation] = useState<ExplanationResult | null>(null)
  const [actions, setActions] = useState<Action[]>([])
  const [selectedAction, setSelectedAction] = useState<Action | null>(null)
  const [selectedTimelineStep, setSelectedTimelineStep] = useState<TimelineStep | null>(null)
  const [selectedTimelineCard, setSelectedTimelineCard] = useState<TimelineCard | null>(null)
  const [document, setDocument] = useState<string | null>(null)
  const [sentAt, setSentAt] = useState<Date | null>(null)
  const [sentStepLabels, setSentStepLabels] = useState<Set<string>>(new Set())
  const [followUpDoc, setFollowUpDoc] = useState<string | null>(null)
  const [formalAttachmentDoc, setFormalAttachmentDoc] = useState<string | null>(null)
  const [caseTimeline, setCaseTimeline] = useState<TimelineStep[] | null>(null)
  const [loadingTimeline, setLoadingTimeline] = useState(false)

  // Loading flags
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [loadingActions, setLoadingActions] = useState(false)
  const [loadingDocument, setLoadingDocument] = useState(false)
  const [loadingFollowUp, setLoadingFollowUp] = useState(false)
  const [loadingFormalAttachment, setLoadingFormalAttachment] = useState(false)

  // Copy confirmations
  const [copiedLetter, setCopiedLetter] = useState(false)
  const [letterEverCopied, setLetterEverCopied] = useState(false)
  const [copiedFollowUp, setCopiedFollowUp] = useState(false)
  const [copiedResponseReply, setCopiedResponseReply] = useState(false)
  const [copiedFormalAttachment, setCopiedFormalAttachment] = useState(false)

  // Response decoder
  const [responseText, setResponseText] = useState('')
  const [responseBreakdown, setResponseBreakdown] = useState<ResponseBreakdown | null>(null)
  const [loadingResponse, setLoadingResponse] = useState(false)
  const [responseError, setResponseError] = useState<string | null>(null)
  const [responseReplyDoc, setResponseReplyDoc] = useState<string | null>(null)
  const [loadingResponseReply, setLoadingResponseReply] = useState(false)
  const [responseReplySent, setResponseReplySent] = useState(false)

  // Accumulated context from decoded responses — persists across steps so later fetchTimeline calls know what's already resolved
  const [cumulativeDecodedContext, setCumulativeDecodedContext] = useState<string | null>(null)
  // The specific step label that was confirmed complete by a decoded response (passed as completedStepLabel in later calls)
  const [resolvedStepLabel, setResolvedStepLabel] = useState<string | null>(null)

  // ── Derived ──────────────────────────────────────────────────────────────────

  const followUpDate = sentAt ? new Date(sentAt.getTime() + 7 * 24 * 60 * 60 * 1000) : null
  const daysRemaining = followUpDate
    ? Math.max(0, Math.ceil((followUpDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  // ── localStorage persistence (dev convenience) ────────────────────────────────

  useEffect(() => {
    const saved = localStorage.getItem('cc_dev_state')
    if (!saved) return
    try {
      const s = JSON.parse(saved)
      if (s.screen) setScreen(s.screen)
      if (s.userText) setUserText(s.userText)
      if (s.explanation) setExplanation(s.explanation)
      if (s.actions) setActions(s.actions)
      if (s.caseTimeline) setCaseTimeline(s.caseTimeline)
      if (s.selectedAction) setSelectedAction(s.selectedAction)
      if (s.selectedTimelineStep) setSelectedTimelineStep(s.selectedTimelineStep)
      if (s.selectedTimelineCard) setSelectedTimelineCard(s.selectedTimelineCard)
      if (s.document) setDocument(s.document)
      if (s.formalAttachmentDoc) setFormalAttachmentDoc(s.formalAttachmentDoc)
      if (s.sentAt) setSentAt(new Date(s.sentAt))
      if (s.sentStepLabels) setSentStepLabels(new Set(s.sentStepLabels))
      if (s.manuallyDone) setManuallyDone(new Set(s.manuallyDone))
      if (s.uploadedDocs) setUploadedDocs(s.uploadedDocs)
      if (s.responseBreakdown) setResponseBreakdown(s.responseBreakdown)
      if (s.responseText) setResponseText(s.responseText)
      if (s.responseReplyDoc) setResponseReplyDoc(s.responseReplyDoc)
      if (s.cumulativeDecodedContext) setCumulativeDecodedContext(s.cumulativeDecodedContext)
      if (s.resolvedStepLabel) setResolvedStepLabel(s.resolvedStepLabel)
    } catch {}
  }, [])

  useEffect(() => {
    const state = {
      screen,
      userText,
      explanation,
      actions,
      caseTimeline,
      selectedAction,
      selectedTimelineStep,
      selectedTimelineCard,
      document,
      formalAttachmentDoc,
      sentAt: sentAt?.toISOString() ?? null,
      sentStepLabels: [...sentStepLabels],
      manuallyDone: [...manuallyDone],
      uploadedDocs,
      responseBreakdown,
      responseText,
      responseReplyDoc,
      cumulativeDecodedContext,
      resolvedStepLabel,
    }
    localStorage.setItem('cc_dev_state', JSON.stringify(state))
  }, [screen, userText, explanation, actions, caseTimeline, selectedAction, selectedTimelineStep, selectedTimelineCard, document, formalAttachmentDoc, sentAt, sentStepLabels, manuallyDone, uploadedDocs, responseBreakdown, responseText, responseReplyDoc, cumulativeDecodedContext, resolvedStepLabel])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleFileUpload = async (files: FileList | File[]) => {
    setUploadError(null)
    for (const file of Array.from(files)) {
      setUploadingFile(true)
      const form = new FormData()
      form.append('file', file)
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: form })
        const data = await res.json()
        if (!res.ok) setUploadError(data.error || 'Could not process file.')
        else setUploadedDocs(prev => [...prev, data as UploadedDoc])
      } catch {
        setUploadError('Could not upload file. Please try again.')
      }
      setUploadingFile(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files)
  }

  const removeDoc = (index: number) => setUploadedDocs(prev => prev.filter((_, i) => i !== index))

  const handleResponseFileUpload = async (files: FileList | File[]) => {
    const file = Array.from(files)[0]
    if (!file) return
    setUploadingResponseFile(true)
    setResponseError(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) setResponseError(data.error || 'Could not read file.')
      else setResponseText(data.extractedText || '')
    } catch {
      setResponseError('Could not upload file. Please try again.')
    }
    setUploadingResponseFile(false)
  }

  const fetchTimeline = async (params: {
    explanationType?: string
    actionsData?: Action[]
    lettersSent?: boolean
    decodedResponseContext?: string
    completedStepLabel?: string
  }) => {
    setLoadingTimeline(true)
    try {
      const res = await fetch('/api/case-timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userText,
          uploadedDocNames: uploadedDocs.map(d => d.name),
          explanationType: params.explanationType,
          actions: params.actionsData,
          lettersSent: params.lettersSent ?? false,
          decodedResponseContext: params.decodedResponseContext ?? null,
          completedStepLabel: params.completedStepLabel ?? null,
        }),
      })
      const data = await res.json()
      if (res.ok && data.steps) setCaseTimeline(data.steps)
    } catch (err) {
      console.error('[fetchTimeline] failed:', err)
    }
    setLoadingTimeline(false)
  }

  const handleSubmit = async () => {
    if (!userText.trim()) return
    setError(null)
    setExplanation(null)
    setActions([])
    setSelectedAction(null)
    setDocument(null)
    setSentAt(null)
    setFollowUpDoc(null)
    setFormalAttachmentDoc(null)
    setCaseTimeline(null)
    setLoadingTimeline(false)
    setManuallyDone(new Set())
    setSentStepLabels(new Set())
    setCumulativeDecodedContext(null)
    setResolvedStepLabel(null)
    setLoadingAnalysis(true)
    setScreen('timeline')

    const extractedDocText = uploadedDocs.length > 0
      ? uploadedDocs.map(d => `[${d.name}]\n${d.extractedText}`).join('\n\n---\n\n')
      : null

    try {
      const [explainRes, evidenceRes] = await Promise.all([
        fetch('/api/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userText, extractedDocText }),
        }),
        fetch('/api/analyze-evidence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userText, extractedDocText }),
        }),
      ])
      const [explainData, evidenceData] = await Promise.all([explainRes.json(), evidenceRes.json()])
      if (!explainRes.ok) throw new Error(explainData.error || 'Could not analyse your situation.')
      if (!evidenceRes.ok) throw new Error(evidenceData.error || 'Could not analyse your evidence.')
      setExplanation(explainData)
      setLoadingAnalysis(false)

      // Kick off timeline and next-actions in parallel — timeline only needs explanationType
      setLoadingActions(true)
      const [actionsRes] = await Promise.all([
        fetch('/api/next-actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userText, evidenceAnalysis: evidenceData }),
        }),
        fetchTimeline({ explanationType: explainData.type, lettersSent: false }),
      ])
      const actionsData = await actionsRes.json()
      if (!actionsRes.ok) throw new Error(actionsData.error || 'Could not generate next steps.')
      const fetchedActions: Action[] = actionsData.actions || []
      setActions(fetchedActions)
      setLoadingActions(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoadingAnalysis(false)
      setLoadingActions(false)
    }
  }

  const handleGenerateDocument = async (action: Action) => {
    setSelectedAction(action)
    setDocument(null)
    setSentAt(null)
    setFollowUpDoc(null)
    setLoadingDocument(true)
    setError(null)
    try {
      // If a response was previously decoded (e.g. filer confirmed marker removal), enrich the
      // case description so the generated letter references it appropriately
      const enrichedUserText = responseBreakdown
        ? `${userText}\n\nImportant context — a response has been received from ${responseBreakdown.organisation}: ${responseBreakdown.summary} ${responseBreakdown.whatHappened} The recommended next action is: ${responseBreakdown.replyAction}`
        : userText
      const res = await fetch('/api/generate-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userText: enrichedUserText, selectedAction: action, isFollowUp: false }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not generate letter.')
      setDocument(data.document)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate letter.')
    }
    setLoadingDocument(false)
  }

  const handleGenerateFollowUp = async () => {
    setLoadingFollowUp(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userText, selectedAction, isFollowUp: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not generate follow-up.')
      setFollowUpDoc(data.document)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate follow-up.')
    }
    setLoadingFollowUp(false)
  }

  const handleGenerateFormalAttachment = async () => {
    setLoadingFormalAttachment(true)
    setError(null)
    try {
      const formalAction = {
        title: 'Formal reconsideration request (PDF attachment)',
        whatToDo: 'Generate a formal written reconsideration request to attach to the employer email. This is letter type 3b — a standalone formal document for compliance or HR teams, covering the two CIFAS markers, the structural expiry problem, and three numbered requests.',
        whyItMatters: 'The personal email goes to the contact. This formal document goes to whoever reviews the decision officially.',
      }
      const enrichedUserText = responseBreakdown
        ? `${userText}\n\nContext from previous response: ${responseBreakdown.summary} ${responseBreakdown.whatHappened}`
        : userText
      const res = await fetch('/api/generate-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userText: enrichedUserText, selectedAction: formalAction, isFollowUp: false }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not generate formal attachment.')
      setFormalAttachmentDoc(data.document)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate formal attachment.')
    }
    setLoadingFormalAttachment(false)
  }

  const handleCopy = (text: string, confirm: (v: boolean) => void) => {
    navigator.clipboard.writeText(text)
    confirm(true)
    setTimeout(() => confirm(false), 2000)
  }

  const handleInterpretResponse = async () => {
    if (!responseText.trim()) return
    setLoadingResponse(true)
    setResponseBreakdown(null)
    setResponseReplyDoc(null)
    setResponseReplySent(false)
    setResponseError(null)
    try {
      const res = await fetch('/api/interpret-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseText, userText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not analyse this response.')
      setResponseBreakdown(data)
      setScreen('response')
      const resolvedCtx = `A response from ${data.organisation} has been received and decoded. This resolves the step: "${selectedTimelineStep?.label || 'the current step'}". Only that specific step is now complete. Any other parallel steps that have not been explicitly confirmed as done must remain active. The next action on this track is: ${data.replyAction}`
      setCumulativeDecodedContext(resolvedCtx)
      setResolvedStepLabel(selectedTimelineStep?.label ?? null)
      fetchTimeline({
        lettersSent: !!sentAt,
        completedStepLabel: selectedTimelineStep?.label,
        decodedResponseContext: resolvedCtx,
      })
    } catch (err) {
      setResponseError(err instanceof Error ? err.message : 'Something went wrong.')
    }
    setLoadingResponse(false)
  }

  const handleGenerateResponseReply = async () => {
    if (!responseBreakdown) return
    setLoadingResponseReply(true)
    setResponseReplyDoc(null)
    try {
      const res = await fetch('/api/generate-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userText,
          responseText,
          replyAction: responseBreakdown.replyAction,
          organisation: responseBreakdown.recipientOrganisation || responseBreakdown.organisation,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not generate reply.')
      setResponseReplyDoc(data.document)
    } catch (err) {
      setResponseError(err instanceof Error ? err.message : 'Could not generate reply.')
    }
    setLoadingResponseReply(false)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  // Derived timeline cards — available to all screens
  const timelineCards = caseTimeline
    ? caseTimeline.map((step, i) => ({
        step: i + 1,
        label: step.label,
        detail: step.detail,
        status: step.status,
        isOpenable: step.status === 'active',
        sequential: step.sequential ?? false,
        lockedReason: step.lockedReason ?? null,
        dependsOnStep: step.dependsOnStep ?? null,
      }))
    : []

  const handleOpenStep = (i: number) => {
    const step = caseTimeline![i]
    const card = timelineCards[i]
    const activeStepsBefore = timelineCards.slice(0, i).filter(c => c.status === 'active').length
    const actionForStep = actions[activeStepsBefore] ?? actions[0]
    setSelectedTimelineStep(step)
    setSelectedTimelineCard(card)
    setSelectedAction({
      title: step.label,
      whatToDo: step.detail,
      whyItMatters: actionForStep?.whyItMatters || step.detail,
    })
    setDocument(null)
    setSentAt(null)
    setFollowUpDoc(null)
    setFormalAttachmentDoc(null)
    setLetterEverCopied(false)
    setResponseText('')
    setResponseBreakdown(null)
    setResponseReplyDoc(null)
    setScreen('activity')
  }

  // ── 1. Welcome ───────────────────────────────────────────────────────────────

  if (screen === 'welcome') {
    return (
      <div className="min-h-screen bg-[#0b1020] flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-3xl">

          <div className="mb-8">
            <span className="inline-block text-xs px-3 py-1.5 rounded-full border border-gray-700 bg-white/[0.04] text-blue-100">
              ClarityCase · explain-as-you-go AI
            </span>
          </div>

          <h1 className="text-5xl font-black text-white leading-[1.1] mb-3">
            Explain the decision.<br />Build the case.
          </h1>
          <p className="text-gray-400 text-base leading-relaxed mb-8">
            AI guidance for confusing financial, identity, and screening decisions — in plain English, with a step-by-step plan to challenge the decision.
          </p>

          <div className="relative mb-8">
            <div className="absolute top-[5px] left-0 right-0 h-px bg-gray-700" />
            <div className="flex">
              {[
                { label: '?', title: 'Understand what happened', body: 'Translate reports, emails, and decision wording into plain English.' },
                { label: '✓', title: 'Know your strongest next step', body: 'Get a personalised roadmap and why each action matters.' },
                { label: '✎', title: 'Generate credible responses', body: 'Draft letters and emails that fit your evidence, ready to send.' },
              ].map(item => (
                <div key={item.title} className="flex-1 flex flex-col items-center px-1.5">
                  <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-500 bg-blue-500 flex-shrink-0 relative z-10" />
                  <div className="w-px h-5 flex-shrink-0 bg-gray-700" />
                  <div className="w-full bg-[#11182b] border border-gray-700 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-2">{item.label}</p>
                    <p className="text-sm text-white font-semibold leading-snug mb-2">{item.title}</p>
                    <p className="text-xs text-gray-400 leading-relaxed">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setScreen('input')}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 rounded-xl text-sm transition-colors"
          >
            Start case review →
          </button>

          <p className="text-center text-xs text-gray-600 mt-5">Free · No account needed · UK cases</p>
        </div>
      </div>
    )
  }

  // ── 2. Input ─────────────────────────────────────────────────────────────────

  if (screen === 'input') {
    return (
      <div className="min-h-screen bg-[#0b1020]">
        <Header
          title="ClarityCase"
          onBack={() => setScreen('welcome')}
          backLabel=""
        />

        <div className="max-w-3xl mx-auto px-6 pt-10 pb-16">

          <div className="mb-8">
            <PageTitle step="01" title="Describe what happened" />
            <p className="text-gray-400 text-sm leading-relaxed mt-3">
              Tell us about the decision that&apos;s affected you. The more detail you give, the more specific our guidance will be.
            </p>
          </div>

          <div className="space-y-4">
            <textarea
              value={userText}
              onChange={e => setUserText(e.target.value)}
              placeholder="e.g. My job offer was withdrawn after a background check. The employer mentioned a CIFAS marker but didn't explain what it was or why it was there..."
              rows={7}
              className="w-full bg-[#11182b] border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-gray-600 resize-none focus:outline-none focus:border-blue-500 transition-colors leading-relaxed"
            />

            <div className="flex flex-wrap gap-2">
              {['Job offer withdrawn', 'Bank account closed', 'CIFAS marker found', 'Credit refused'].map(fill => (
                <button
                  key={fill}
                  onClick={() => setUserText(fill)}
                  className="text-xs px-3 py-1.5 rounded-full bg-[#11182b] border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                >
                  {fill}
                </button>
              ))}
            </div>

            {/* Supporting documents */}
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept=".pdf,image/*,.txt"
                onChange={e => e.target.files && handleFileUpload(e.target.files)}
              />

              {/* Tab toggle */}
              <div className="flex gap-1 bg-[#0b1020] border border-gray-700 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setUploadTab('file')}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
                    uploadTab === 'file' ? 'bg-[#11182b] text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Upload file
                </button>
                <button
                  type="button"
                  onClick={() => setUploadTab('paste')}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
                    uploadTab === 'paste' ? 'bg-[#11182b] text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Paste text
                </button>
              </div>

              {/* File drop zone */}
              {uploadTab === 'file' && (
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-dashed border-gray-700 hover:border-gray-600 bg-[#11182b] rounded-xl px-5 py-6 text-center cursor-pointer transition-colors"
                >
                  {uploadingFile ? (
                    <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
                      <div className="w-3.5 h-3.5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                      <span>Extracting text from document...</span>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-white font-medium mb-1">Drop files here or click to browse</p>
                      <p className="text-xs text-gray-500">Letters, emails, screenshots, or reports · PDF, image, or text · 10MB max</p>
                    </>
                  )}
                </div>
              )}

              {/* Paste text zone */}
              {uploadTab === 'paste' && (
                <div className="space-y-2">
                  <input
                    value={pasteDocName}
                    onChange={e => setPasteDocName(e.target.value)}
                    placeholder="Document name (optional) — e.g. CIFAS letter, Employer email"
                    className="w-full bg-[#11182b] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <textarea
                    value={pasteDocText}
                    onChange={e => setPasteDocText(e.target.value)}
                    placeholder="Paste the content of any letter, email, or document here..."
                    rows={5}
                    className="w-full bg-[#11182b] border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-gray-600 resize-none focus:outline-none focus:border-blue-500 transition-colors leading-relaxed"
                  />
                  <button
                    onClick={() => {
                      if (!pasteDocText.trim()) return
                      setUploadedDocs(prev => [...prev, {
                        name: pasteDocName.trim() || 'Pasted document',
                        fileType: 'text/plain',
                        extractedText: pasteDocText.trim(),
                      }])
                      setPasteDocText('')
                      setPasteDocName('')
                    }}
                    disabled={!pasteDocText.trim()}
                    className="text-sm px-4 py-2 bg-[#11182b] border border-gray-700 hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    Add document →
                  </button>
                </div>
              )}

              {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}

              {/* Added docs list */}
              {uploadedDocs.length > 0 && (
                <div className="space-y-1.5">
                  {uploadedDocs.map((doc, i) => (
                    <div key={i} className="flex items-center justify-between bg-[#11182b] border border-gray-700 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded flex-shrink-0">
                          {doc.fileType === 'application/pdf' ? 'PDF' : doc.fileType.startsWith('image/') ? 'IMG' : 'TXT'}
                        </span>
                        <span className="text-sm text-white truncate">{doc.name}</span>
                        <span className="text-xs text-gray-500 flex-shrink-0">· ready</span>
                      </div>
                      <button onClick={() => removeDoc(i)} className="text-gray-600 hover:text-red-400 text-xs ml-2 flex-shrink-0 transition-colors">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-500/[0.08] border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!userText.trim() || loadingAnalysis}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-colors text-sm"
            >
              {loadingAnalysis ? 'Analysing your case...' : 'Start case review →'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── 3. Timeline ───────────────────────────────────────────────────────────────

  if (screen === 'timeline') {
    const activeTimelineStep = caseTimeline?.find(s => s.status === 'active')
    const currentStage = activeTimelineStep?.label
      || (loadingAnalysis ? 'Analysing your situation...' : explanation?.type || 'Building your case')
    const nextBestAction = actions[0]?.title || (loadingActions ? 'Calculating...' : null)

    return (
      <div className="min-h-screen bg-[#0b1020]">
        <Header
          title="ClarityCase"
          onBack={() => setScreen('input')}
          backLabel=""
          right={
            <button
              onClick={() => { setScreen('input') }}
              className="text-xs text-gray-500 hover:text-white transition-colors border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg"
            >
              New case
            </button>
          }
        />

        <div className="max-w-6xl mx-auto p-6">

          {/* Case header */}
          <div className="mb-6">
            <PageTitle step="02" title="Your case" />
            <p className="text-gray-400 text-sm mt-2">
              {userText.length > 90 ? userText.slice(0, 90) + '…' : userText}
            </p>
          </div>

          {/* Snapshot bar */}
          <div className="bg-[#11182b] rounded-xl p-4 mb-8 border border-gray-700">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">Current stage</p>
                <p className="text-base font-medium text-white">{currentStage}</p>
              </div>
              {nextBestAction && (
                <div className="text-right">
                  <p className="text-xs text-gray-400 mb-1">Next best action</p>
                  <p className="text-blue-400 font-medium text-sm">{nextBestAction}</p>
                </div>
              )}
            </div>
          </div>

          {/* Loading */}
          {(loadingAnalysis || loadingActions) && (
            <Spinner label={loadingAnalysis ? 'Analysing your situation…' : 'Building your case roadmap…'} />
          )}

          {/* Error state — shown prominently if analysis failed */}
          {error && !explanation && (
            <div className="bg-[#11182b] border border-red-500/30 rounded-xl p-6 text-center space-y-4">
              <p className="text-2xl">⚠</p>
              <div>
                <p className="text-white font-semibold mb-1">Analysis failed</p>
                <p className="text-sm text-gray-400">{error}</p>
              </div>
              <button
                onClick={() => setScreen('input')}
                className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {/* Org-chart timeline */}
          {(loadingTimeline || timelineCards.length > 0) && (
            <div>
              <div className="flex items-start justify-between gap-4 mb-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Case timeline</p>
              </div>

              {/* Loading state */}
              {loadingTimeline && (
                <Spinner label="Building your case timeline…" />
              )}

              {!loadingTimeline && timelineCards.length > 0 && (
              <>
              {/* How this works tip */}
              <div className="bg-[#11182b] border border-gray-700 rounded-xl px-4 py-3 mb-6 flex gap-3 items-start">
                <span className="text-blue-400 text-sm flex-shrink-0 mt-px">ℹ</span>
                <div>
                  <p className="text-xs text-white font-medium mb-0.5">Steps can run in parallel</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Some steps are independent and can happen at the same time — both will show as <strong className="text-gray-300">In progress</strong>. Tap <strong className="text-gray-300">Open →</strong> on any active step to work on it.
                  </p>
                </div>
              </div>
              <TimelineSpine cards={timelineCards} manuallyDone={manuallyDone} sentStepLabels={sentStepLabels} onOpenStep={handleOpenStep} />
              </>
              )}
            </div>
          )}

          {/* Plain English explanation */}
          {explanation && (
            <div className="bg-[#11182b] rounded-xl p-5 mt-8 border border-gray-700">
              <p className="text-xs text-blue-400 uppercase tracking-wider font-semibold mb-3">What happened</p>
              <p className="text-sm text-gray-300 leading-relaxed mb-4">{explanation.whatHappened}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#0b1020] rounded-lg p-3 border border-gray-800">
                  <p className="text-xs text-green-400 font-semibold mb-1.5">What this does NOT mean</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{explanation.whatItDoesNotMean}</p>
                </div>
                <div className="bg-[#0b1020] rounded-lg p-3 border border-gray-800">
                  <p className="text-xs text-blue-400 font-semibold mb-1.5">What matters now</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{explanation.whatMattersNow}</p>
                </div>
              </div>
            </div>
          )}

          {/* Inline error if analysis partially succeeded but a later step failed */}
          {error && explanation && (
            <div className="bg-red-500/[0.08] border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>
          )}
        </div>
      </div>
    )
  }

  // ── 4. Activity ───────────────────────────────────────────────────────────────

  if (screen === 'activity') {
    const currentAction = selectedAction || actions[0]
    // Use the step that was explicitly opened — not just the first active step
    const currentStep = selectedTimelineStep
    const isSARStep = (() => {
      const label = (selectedTimelineStep?.label || selectedAction?.title || '').toLowerCase()
      const hasSARKeyword = label.includes('sar') || label.includes('subject access')
      // Only trigger for the initial SAR request step — not CIFAS verification or confirmation steps
      const isVerificationStep = label.includes('verif') || label.includes('confirm') || label.includes('removal') || label.includes('clear')
      return hasSARKeyword && !isVerificationStep
    })()

    return (
      <div className="min-h-screen bg-[#0b1020]">
        <Header
          title="Current Step"
          onBack={() => setScreen('timeline')}
          backLabel="Timeline"
        />

        <div className="max-w-3xl mx-auto p-6 space-y-4">

          <div className="flex items-start gap-3">
            <div className="flex-1">
              <PageTitle
                step={selectedTimelineCard ? String(selectedTimelineCard.step).padStart(2, '0') : '03'}
                title={currentStep?.label || currentAction?.title || 'Current step'}
              />
            </div>
            {sentAt && <span className="mt-1 flex-shrink-0 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded font-medium">In progress</span>}
          </div>

          {/* What to do — hidden once letter is sent */}
          {currentAction && !sentAt && (
            <div className="bg-[#11182b] p-4 rounded-xl border border-gray-700">
              <h3 className="font-medium text-white mb-2">What to do</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">{currentAction.whatToDo}</p>

              {isSARStep ? (
                <div className="space-y-3">
                  <div className="bg-blue-500/[0.08] border border-blue-500/20 rounded-xl px-4 py-3 space-y-2">
                    <p className="text-sm text-white font-medium">This is done online — no letter needed</p>
                    <ol className="text-sm text-gray-400 leading-relaxed space-y-1 list-decimal list-inside">
                      <li>Go to <span className="text-blue-400">cifas.org.uk</span></li>
                      <li>Find the <strong className="text-gray-300">Subject Access Request</strong> section</li>
                      <li>Complete the online form — it is <strong className="text-gray-300">free</strong></li>
                      <li>Expect your report within <strong className="text-gray-300">30 days</strong> (often much faster)</li>
                    </ol>
                  </div>
                  <button
                    onClick={() => {
                      setSentAt(new Date())
                      if (selectedTimelineStep) setSentStepLabels(prev => new Set([...prev, selectedTimelineStep.label]))
                      fetchTimeline({
                        lettersSent: true,
                        completedStepLabel: resolvedStepLabel ?? undefined,
                        decodedResponseContext: selectedTimelineStep
                          ? `The CIFAS SAR has been submitted online for the step "${selectedTimelineStep.label}". Still awaiting the SAR report — keep this step as "active".`
                          : undefined,
                      })
                    }}
                    className="text-sm px-4 py-2 rounded-lg bg-green-500/[0.12] hover:bg-green-500/[0.18] border border-green-500/30 text-green-400 font-semibold transition-colors"
                  >
                    Mark as submitted
                  </button>
                </div>
              ) : (
                <>
                  {loadingDocument && <Spinner label="Drafting your letter..." />}
                  {!document && !loadingDocument && (
                    <button
                      onClick={() => handleGenerateDocument(currentAction)}
                      disabled={loadingDocument}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Generate letter →
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Generated letter */}
          {document && (
            <div className="bg-[#11182b] p-4 rounded-xl border border-gray-700 space-y-3">
              <h3 className="font-medium text-white">Your letter</h3>
              {!sentAt && (
                <div className="border-l-4 border-yellow-500/70 bg-yellow-500/[0.06] rounded-r-lg px-4 py-3">
                  <p className="text-sm text-gray-200">
                    <strong className="text-yellow-400">Fill in before sending.</strong> Replace each{' '}
                    <mark className="bg-yellow-500/20 text-yellow-400 rounded px-0.5 font-semibold not-italic">[placeholder]</mark>{' '}
                    with your details.
                  </p>
                </div>
              )}
              <div className="bg-[#0b1020] border border-gray-800 rounded-xl p-5 max-h-48 overflow-y-auto">
                <LetterDisplay text={document} />
              </div>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => { setLetterEverCopied(true); handleCopy(document, setCopiedLetter) }}
                  className="text-sm px-4 py-2 rounded-lg bg-white/[0.05] border border-gray-700 hover:border-gray-500 text-white transition-colors"
                >
                  {copiedLetter || letterEverCopied ? '✓ Copied' : 'Copy letter'}
                </button>
                {!sentAt && (
                  <button
                    onClick={() => {
                      setSentAt(new Date())
                      if (selectedTimelineStep) {
                        setSentStepLabels(prev => new Set([...prev, selectedTimelineStep.label]))
                      }
                      fetchTimeline({
                        lettersSent: true,
                        completedStepLabel: resolvedStepLabel ?? undefined,
                        decodedResponseContext: selectedTimelineStep
                          ? `A letter has been sent for the step "${selectedTimelineStep.label}" but no response has been received yet. This step is still awaiting a reply — keep it as "active", do not mark it as done.`
                          : undefined,
                      })
                    }}
                    className="text-sm px-4 py-2 rounded-lg bg-green-500/[0.12] hover:bg-green-500/[0.18] border border-green-500/30 text-green-400 font-semibold transition-colors"
                  >
                    Mark as sent
                  </button>
                )}
                {sentAt && (
                  <span className="text-sm px-4 py-2 rounded-lg bg-green-500/[0.07] border border-green-500/20 text-green-400 font-medium">
                    ✓ Marked as sent
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Formal attachment — shown when main letter is generated for an employer-contact step */}
          {document && (() => {
            const label = (selectedTimelineStep?.label || selectedAction?.title || '').toLowerCase()
            const isEmployerStep = label.includes('employer') || label.includes('holding') || label.includes('ybs') || label.includes('building society') || label.includes('bank')
            if (!isEmployerStep) return null
            return (
              <div className="bg-[#11182b] p-4 rounded-xl border border-gray-700 space-y-3">
                <div>
                  <h3 className="font-medium text-white">Formal attachment (PDF)</h3>
                  <p className="text-xs text-gray-500 mt-1">A separate formal document to attach to your email — written for compliance or HR teams who need to review the decision officially.</p>
                </div>
                {loadingFormalAttachment && <Spinner label="Drafting formal attachment..." />}
                {!formalAttachmentDoc && !loadingFormalAttachment && (
                  <button
                    onClick={handleGenerateFormalAttachment}
                    className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Generate formal attachment →
                  </button>
                )}
                {formalAttachmentDoc && (
                  <>
                    <div className="bg-[#0b1020] border border-gray-800 rounded-xl p-5 max-h-48 overflow-y-auto">
                      <LetterDisplay text={formalAttachmentDoc} />
                    </div>
                    <button
                      onClick={() => handleCopy(formalAttachmentDoc, setCopiedFormalAttachment)}
                      className="text-sm px-4 py-2 rounded-lg bg-white/[0.05] border border-gray-700 hover:border-gray-500 text-white transition-colors"
                    >
                      {copiedFormalAttachment ? '✓ Copied' : 'Copy attachment'}
                    </button>
                  </>
                )}
              </div>
            )
          })()}

          {/* After sent — show updated timeline so user can navigate to next step */}
          {sentAt && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Your case timeline</p>
                {/* Follow-up nudge — subtle, below the timeline */}
              </div>

              {loadingTimeline && <Spinner label="Updating your timeline…" />}

              {!loadingTimeline && timelineCards.length > 0 && (
                <TimelineSpine cards={timelineCards} manuallyDone={manuallyDone} sentStepLabels={sentStepLabels} onOpenStep={handleOpenStep} />
              )}

              {/* Follow-up chaser — secondary, shown after 7 days */}
              {daysRemaining !== null && daysRemaining === 0 && (
                <div className="mt-4 bg-yellow-500/[0.08] border border-yellow-500/20 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-gray-200">
                    <strong className="text-yellow-400">No reply yet.</strong> Seven days since you sent this letter.
                  </p>
                  <button
                    onClick={handleGenerateFollowUp}
                    disabled={loadingFollowUp}
                    className="text-xs text-yellow-400 hover:text-yellow-300 font-medium flex-shrink-0 transition-colors"
                  >
                    {loadingFollowUp ? 'Generating...' : 'Generate follow-up →'}
                  </button>
                </div>
              )}
              {loadingFollowUp && <Spinner label="Drafting your follow-up letter..." />}
              {followUpDoc && (
                <div className="mt-3 space-y-2">
                  <div className="bg-[#0b1020] border border-gray-800 rounded-xl p-5 max-h-48 overflow-y-auto">
                    <LetterDisplay text={followUpDoc} />
                  </div>
                  <button
                    onClick={() => handleCopy(followUpDoc, setCopiedFollowUp)}
                    className="text-sm px-4 py-2 rounded-lg bg-white/[0.05] border border-gray-700 hover:border-gray-500 text-white transition-colors"
                  >
                    {copiedFollowUp ? '✓ Copied' : 'Copy follow-up'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Response upload */}
          <div className="bg-[#11182b] p-4 rounded-xl border border-gray-700">
            <h3 className="font-medium text-white mb-2">Received a response?</h3>
            <p className="text-sm text-gray-400 mb-3">
              Paste any reply you&apos;ve received, or drop the file — we&apos;ll decode the language and tell you exactly what to do next.
            </p>

            {/* Drop zone */}
            <input
              ref={responseFileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,image/*,.txt"
              onChange={e => e.target.files && handleResponseFileUpload(e.target.files)}
            />
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) handleResponseFileUpload(e.dataTransfer.files) }}
              onClick={() => responseFileInputRef.current?.click()}
              className="border border-dashed border-gray-600 hover:border-gray-500 rounded-lg px-4 py-3 text-center cursor-pointer transition-colors mb-3"
            >
              {uploadingResponseFile ? (
                <div className="flex items-center justify-center gap-2 text-gray-400 text-xs">
                  <div className="w-3 h-3 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                  <span>Extracting text from document...</span>
                </div>
              ) : (
                <p className="text-xs text-gray-500">Drop a file here or click to upload · PDF, image, or text</p>
              )}
            </div>

            <textarea
              value={responseText}
              onChange={e => setResponseText(e.target.value)}
              placeholder="Or paste the response text here..."
              rows={4}
              className="w-full bg-[#0b1020] border border-gray-700 rounded-lg p-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />
            {responseError && <p className="text-sm text-red-400 mt-2">{responseError}</p>}
            {loadingResponse && <Spinner label="Reading and translating the language..." />}
            <button
              onClick={handleInterpretResponse}
              disabled={!responseText.trim() || loadingResponse}
              className="mt-3 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {loadingResponse ? 'Analysing...' : 'Decode response →'}
            </button>
          </div>

          <p className="text-xs text-gray-700 text-center pt-2">
            ClarityCase provides information and guidance only. This is not legal advice.
          </p>
        </div>
      </div>
    )
  }

  // ── 5. Response breakdown ─────────────────────────────────────────────────────

  if (screen === 'response' && responseBreakdown) {
    return (
      <div className="min-h-screen bg-[#0b1020]">
        <Header
          title="Response decoded"
          onBack={() => setScreen('activity')}
          backLabel="Back"
        />

        <div className="max-w-3xl mx-auto p-6 space-y-4">

          <PageTitle
            step={selectedTimelineCard ? String(selectedTimelineCard.step + 1).padStart(2, '0') : '04'}
            title={`Response from ${responseBreakdown.organisation}`}
          />

          {/* Summary — green */}
          <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-xl">
            <h3 className="font-medium text-white mb-1">In short</h3>
            <p className="text-sm text-gray-300 leading-relaxed">{responseBreakdown.summary}</p>
          </div>

          {/* Key phrases — one box per phrase */}
          {responseBreakdown.keyPhrases.length > 0 && (
            <>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">What they&apos;re really saying</p>
              {responseBreakdown.keyPhrases.map((phrase, i) => (
                <div key={i} className="bg-[#11182b] p-4 rounded-xl border border-gray-700">
                  <p className="text-sm text-white mb-2">&ldquo;{phrase.original}&rdquo;</p>
                  <p className="text-sm text-gray-400 leading-relaxed">→ {phrase.translated}</p>
                </div>
              ))}
            </>
          )}

          {/* Updated timeline — shows where the case stands after this response */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-4">Your case timeline</p>

            {loadingTimeline && <Spinner label="Updating your timeline…" />}

            {!loadingTimeline && timelineCards.length > 0 && (
              <TimelineSpine cards={timelineCards} manuallyDone={manuallyDone} sentStepLabels={sentStepLabels} onOpenStep={handleOpenStep} />
            )}
          </div>

          <div className="flex justify-center pt-2">
            <button
              onClick={() => setScreen('timeline')}
              className="text-sm text-gray-500 hover:text-white transition-colors"
            >
              ← Back to full timeline
            </button>
          </div>

          <p className="text-xs text-gray-700 text-center pb-4">
            ClarityCase provides information and guidance only. This is not legal advice.
          </p>
        </div>
      </div>
    )
  }

  return null
}
