import { NextResponse } from 'next/server'
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType = 'image/jpeg', language = 'malayalam' } = await req.json()
    const lang = language === 'kannada' ? 'Kannada' : 'Malayalam'
    const sceneWord = language === 'kannada' ? 'ದೃಶ್ಯ' : 'സീൻ'
    const exampleLine = language === 'kannada' ? 'ಅವರು ನಡೆದು ಬರುತ್ತಾರೆ.' : 'അവർ നടന്നു വരുന്നു.'
    const isPdf = mimeType === 'application/pdf'
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey || apiKey === 'dummy') {
      return NextResponse.json({ error: 'GEMINI_API_KEY is missing' }, { status: 400 })
    }

    const ai = new GoogleGenAI({ apiKey })

    // Fetch user's ML dictionary
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    let dictionaryText = ''
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('preferences').eq('id', user.id).single()
      const glossary = profile?.preferences?.ai_glossary || []
      if (glossary.length > 0) {
        dictionaryText = `\n\nUSER'S PERSONAL HANDWRITING DICTIONARY:\nIn the past, you misread this user's handwriting. Here is a list of their corrections. Use this to correctly identify their specific handwriting/vocabulary patterns:\n`
        glossary.forEach((g: any) => {
          dictionaryText += `- When you thought it said "${g.misread}", the user actually wrote "${g.corrected}".\n`
        })
      }
    }

    let prompt = `
You are an elite ${lang} screenwriter and the world's best OCR assistant. 
Your task is to meticulously read the provided image of a handwritten ${lang} screenplay page and transcribe it EXACTLY as written (in ${lang} script), structuring it into a JSON array of screenplay blocks.

CRITICAL INSTRUCTIONS FOR ACCURACY:
1. DO NOT guess, hallucinate, or invent words. Transcribe exactly what you see.
2. If a word is messy or cursive, use advanced ${lang} vocabulary logic and the context of the sentence to deduce the correct spelling of the exact word written.
3. Ignore scribbles, crossed-out words, and page numbers.
4. Pay attention to spatial layout:
   - Centered text with a single short name is usually a 'character'.
   - Text directly below a character is 'dialogue'.
   - Left-aligned text describing what happens is 'action'.
   - ALL CAPS english words like "INT." or "EXT." or ${lang} words like "${sceneWord}" signify a 'scene_heading'.
5. Return ONLY a raw JSON array. No markdown, no \`\`\`json wrappers. 

Valid types: "scene_heading", "character", "action", "dialogue", "parenthetical".
Format: [{ "type": "action", "content": "${exampleLine}" }]
` + dictionaryText + (isPdf ? `\n\nNOTE: The input is a PDF document (possibly multiple pages, typed or handwritten). Transcribe ALL pages in order into a single JSON array.` : '')

    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash']
    let response
    let lastError
    
    for (const modelName of modelsToTry) {
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            response = await ai.models.generateContent({
              model: modelName,
              config: {
                temperature: 0,
                safetySettings: [
                  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
                ]
              },
              contents: [
                prompt,
                {
                  inlineData: {
                    data: imageBase64,
                    mimeType
                  }
                }
              ]
            })
            break
          } catch (e: any) {
            lastError = e
            if (e.status === 503 || e.message?.includes('503')) {
              await new Promise(resolve => setTimeout(resolve, 1000))
            } else if (e.status === 429 || e.message?.includes('429') || e.status === 402 || e.message?.includes('402')) {
              // Rate limit or Billing exhausted hit - don't retry, just throw to stop fallback
              throw e
            } else {
              throw e
            }
          }
        }
        if (response) break
      } catch (e: any) {
        lastError = e
        console.warn(`Image parse - Model ${modelName} failed:`, e.message)
        if (e.status === 429 || e.message?.includes('429') || e.status === 402 || e.message?.includes('402')) {
          // Break completely out of the models loop on quota limit
          break
        }
      }
    }

    if (!response) {
      if (lastError?.status === 429 || lastError?.message?.includes('429')) {
        const errorMsg = lastError?.message || 'AI Quota Exceeded. You have hit the Google AI rate limits for today.'
        return NextResponse.json({ error: errorMsg }, { status: 429 })
      }
      if (lastError?.status === 402 || lastError?.message?.includes('402')) {
        return NextResponse.json({ error: 'Your Google Cloud Project has run out of prepayment billing credits. Please top up your billing account.' }, { status: 402 })
      }
      throw lastError || new Error("All AI models failed.")
    }
    const responseText = response.text || '[]'
    console.log("AI Image Parse Response:", responseText)
    let cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim()

    // Robust JSON array extraction
    const startIndex = cleanedText.indexOf('[')
    const endIndex = cleanedText.lastIndexOf(']')
    if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
      cleanedText = cleanedText.substring(startIndex, endIndex + 1)
    }

    let blocks = []
    try {
      blocks = JSON.parse(cleanedText)
      if (!Array.isArray(blocks)) blocks = []
    } catch(e) {
      console.error("Failed to parse JSON from AI image response", cleanedText)
      return NextResponse.json({ error: 'AI did not return valid JSON' }, { status: 500 })
    }

    return NextResponse.json({ blocks })
  } catch (error: any) {
    console.error('Parse Image Route Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
