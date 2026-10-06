import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const audioChunk = formData.get('audio') as Blob
    const projectId = formData.get('projectId') as string
    const sequenceNumber = parseInt(formData.get('sequenceNumber') as string, 10)

    if (!audioChunk || !projectId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 1. Convert Blob to ArrayBuffer/Buffer for external API (e.g. OpenAI/Google Speech)
    // const buffer = Buffer.from(await audioChunk.arrayBuffer())

    // 2. Call Transcription Provider (mocked here due to missing credentials)
    // const transcriptText = await callTranscriptionService(buffer, 'ml-IN') // Malayalam
    const transcriptText = "Mocked Malayalam transcription for chunk " + sequenceNumber

    // 3. Save raw transcript segment to Supabase
    const { data: segment, error } = await supabase
      .from('transcript_segments')
      .insert({
        project_id: projectId,
        sequence_number: sequenceNumber,
        raw_text: transcriptText,
        verification_status: 'unverified'
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // 4. Return the segment
    return NextResponse.json({ segment })

  } catch (err: any) {
    console.error('Error processing audio chunk:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
