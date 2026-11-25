import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '@/utils/supabase/server'

const LANGS: Record<string, string> = { malayalam: 'Malayalam', kannada: 'Kannada' }

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { blocks, from, to } = await req.json()
    if (!Array.isArray(blocks) || blocks.length === 0) {
      return NextResponse.json({ error: 'No blocks to translate' }, { status: 400 })
    }
    if (!LANGS[from] || !LANGS[to] || from === to) {
      return NextResponse.json({ error: 'Invalid languages' }, { status: 400 })
    }
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey || apiKey === 'dummy') {
      return NextResponse.json({ error: 'GEMINI_API_KEY is missing' }, { status: 400 })
    }

    const ai = new GoogleGenAI({ apiKey })
    const src = LANGS[from]
    const tgt = LANGS[to]

    const input = blocks.map((b: any, i: number) => ({ i, type: b.type, content: b.content }))

    const prompt = `
You are a professional film script translator fluent in ${src} and ${tgt}.
Translate the following screenplay blocks from ${src} to ${tgt}.

RULES:
1. Keep the SAME number of blocks, in the SAME order, with the SAME "i" and "type" values.
2. Translate only "content" into natural, cinematic ${tgt} written in ${tgt} script.
3. Character names ("character" blocks) and proper nouns: TRANSLITERATE into ${tgt} script, do not translate their meaning.
4. Dialogue must sound natural and spoken, preserving tone, emotion and colloquialism.
5. Keep English words (e.g. INT., EXT., CUT, technical camera terms) as they are.
6. Preserve line breaks inside content.
7. Return ONLY a raw JSON array: [{ "i": 0, "type": "...", "content": "..." }]. No markdown.

INPUT:
${JSON.stringify(input)}
`

    const models = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash']
    let response: any
    let lastError: any
    for (const model of models) {
      try {
        response = await ai.models.generateContent({ model, config: { temperature: 0.2 }, contents: prompt })
        if (response) break
      } catch (e: any) {
        lastError = e
        console.warn(`Translate - Model ${model} failed:`, e.message)
        if (e.status === 429 || e.status === 402 || e.message?.includes('429') || e.message?.includes('402')) break
      }
    }
    if (!response) {
      if (lastError?.status === 402 || lastError?.message?.includes('402')) {
        return NextResponse.json({ 
          error: 'Your Google Cloud Project prepayment credits are depleted. Please top up your billing at ai.google.dev or create a Free Tier API key at aistudio.google.com.' 
        }, { status: 402 })
      }
      if (lastError?.status === 429 || lastError?.message?.includes('429')) {
        return NextResponse.json({ 
          error: 'AI Quota Exceeded. You have hit the Google AI rate limits for today.' 
        }, { status: 429 })
      }
      const status = lastError?.status || 500
      return NextResponse.json({ error: lastError?.message || 'All AI models failed' }, { status })
    }

    let text = (response.text || '[]').replace(/```json/g, '').replace(/```/g, '').trim()
    const s = text.indexOf('['), e = text.lastIndexOf(']')
    if (s !== -1 && e > s) text = text.substring(s, e + 1)

    let out: any[]
    try { out = JSON.parse(text) } catch {
      return NextResponse.json({ error: 'AI did not return valid JSON' }, { status: 500 })
    }

    // Map back by index; fall back to original if a block is missing
    const byIndex = new Map(out.map((o: any) => [o.i, o]))
    const translated = blocks.map((b: any, i: number) => {
      const t: any = byIndex.get(i)
      const content = t?.content || b.content
      return { type: b.type, content, originalContent: content }
    })

    return NextResponse.json({ blocks: translated })
  } catch (err: any) {
    console.error('Translate error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
