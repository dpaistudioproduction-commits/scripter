import { NextResponse } from 'next/server'
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: Request) {
  try {
    const { text, language = 'malayalam' } = await req.json()
    const lang = language === 'kannada' ? 'Kannada' : 'Malayalam'
    const sceneWord = language === 'kannada' ? 'ದೃಶ್ಯ' : 'സീൻ'
    const example = language === 'kannada'
      ? '[{ "type": "character", "content": "ರಾಜೇಶ್" }, { "type": "dialogue", "content": "ನೀನು ಅಲ್ಲಿಗೆ ಬರಬೇಡ" }]'
      : '[{ "type": "character", "content": "രാജേഷ്" }, { "type": "dialogue", "content": "നി അവിടെക്ക് വരരുത്" }]'
    if (!text) return NextResponse.json({ error: 'No text provided' }, { status: 400 })

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy') {
      return NextResponse.json({ error: 'Missing GEMINI_API_KEY in .env.local' }, { status: 500 })
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    
    // Fetch user's ML dictionary
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    let dictionaryText = ''
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('preferences').eq('id', user.id).single()
      const glossary = profile?.preferences?.ai_glossary || []
      if (glossary.length > 0) {
        dictionaryText = `\n\nUSER'S PERSONAL DICTATION DICTIONARY:\nIn the past, the microphone misheard this user. Here is a list of their corrections. Use this to correctly identify their specific speech patterns:\n`
        glossary.forEach((g: any) => {
          dictionaryText += `- When the transcript said "${g.misread}", the user actually meant "${g.corrected}".\n`
        })
      }
    }

    let prompt = `
You are an elite ${lang} screenwriter and parsing assistant.
Your task is to meticulously read the raw dictated ${lang} sentence and structure it into a JSON array of screenplay blocks.

CRITICAL INSTRUCTIONS FOR ACCURACY:
1. DO NOT guess, hallucinate, or invent words. Extract the dictated text exactly as is, in ${lang} script.
2. Use advanced ${lang} vocabulary logic to understand the phonetic context of the sentence to correctly categorize the blocks.
3. Pay attention to context:
   - "${sceneWord}" (Scene) or "EXT"/"INT" means 'scene_heading'.
   - A short name immediately followed by spoken words means the name is 'character' and the words are 'dialogue'.
   - Descriptions of actions are 'action'.
4. Return ONLY a raw JSON array. No markdown, no \`\`\`json wrappers. 

Valid types: "scene_heading", "character", "action", "dialogue", "parenthetical".
Format: ${example}

Raw dictation:
"${text}"
` + dictionaryText

    const modelsToTry = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash']
    let response
    let lastError
    
    for (const modelName of modelsToTry) {
      try {
        // Try up to 2 times for each model
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
              contents: prompt,
            })
            break // Success! Break out of the attempt loop
          } catch (e: any) {
            lastError = e
            if (e.status === 503 || e.message?.includes('503')) {
              // High demand, wait 1s and retry
              await new Promise(resolve => setTimeout(resolve, 1000))
            } else if (e.status === 429 || e.message?.includes('429') || e.status === 402 || e.message?.includes('402')) {
              // Rate limit or Billing hit
              throw e
            } else {
              throw e // If it's a 404 or something else, throw it to jump to next model
            }
          }
        }
        if (response) break // Success! Break out of the model loop
      } catch (e: any) {
        lastError = e
        console.warn(`Model ${modelName} failed, trying next:`, e.message)
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
    let jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim()

    // Robust JSON array extraction
    const startIndex = jsonStr.indexOf('[')
    const endIndex = jsonStr.lastIndexOf(']')
    if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
      jsonStr = jsonStr.substring(startIndex, endIndex + 1)
    }

    let blocks = []
    try {
      blocks = JSON.parse(jsonStr)
      if (!Array.isArray(blocks)) blocks = []
    } catch (e) {
      console.error("Failed to parse JSON from AI script response", jsonStr)
      return NextResponse.json({ error: 'AI did not return valid JSON' }, { status: 500 })
    }

    return NextResponse.json({ blocks })
  } catch (error: any) {
    console.error('AI Parsing Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
