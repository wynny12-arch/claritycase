import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic()

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'text/plain']

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File is too large. Maximum size is 10MB.' }, { status: 400 })
    }

    const mimeType = file.type
    if (!ACCEPTED_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a PDF, image, or text file.' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let extractedText = ''

    if (mimeType === 'text/plain') {
      // Plain text — read directly
      extractedText = buffer.toString('utf-8')
    } else if (mimeType === 'application/pdf') {
      // PDF — use Claude document API
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const message = await (client.messages.create as any)({
        model: 'claude-opus-4-6',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: buffer.toString('base64'),
                },
              },
              {
                type: 'text',
                text: 'Extract all the text from this document exactly as written. Return only the extracted text. Do not summarise or paraphrase — return the actual words from the document.',
              },
            ],
          },
        ],
      })
      const content = message.content[0]
      extractedText = content.type === 'text' ? content.text : ''
    } else {
      // Image — use Claude vision
      const message = await client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                  data: buffer.toString('base64'),
                },
              },
              {
                type: 'text',
                text: 'Extract all visible text from this image exactly as written. Return only the text you can read. Do not describe the image — return the actual words.',
              },
            ],
          },
        ],
      })
      const content = message.content[0]
      extractedText = content.type === 'text' ? content.text : ''
    }

    if (!extractedText.trim()) {
      return NextResponse.json(
        { error: 'No text could be extracted from this file. Try a clearer image or a different format.' },
        { status: 422 }
      )
    }

    return NextResponse.json({
      fileName: file.name,
      fileType: mimeType,
      extractedText: extractedText.trim(),
    })
  } catch (err) {
    console.error('[/api/upload]', err)
    return NextResponse.json(
      { error: 'Could not process your file. Please try again.' },
      { status: 500 }
    )
  }
}
