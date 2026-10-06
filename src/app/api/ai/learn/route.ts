import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminSupabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: profile } = await adminSupabase.from('profiles').select('preferences').eq('id', user.id).single()
  
  const aiGlossary = profile?.preferences?.ai_glossary || []
  return NextResponse.json({ aiGlossary })
}

export async function POST(req: Request) {
  const supabase = await createClient()

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { oldText, newText } = await req.json()
    
    if (!oldText || !newText) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 })
    }

    // Fetch user's profile
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('preferences')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const preferences = profile.preferences || {}
    const aiGlossary = preferences.ai_glossary || []

    // Append the new correction, prevent exact duplicates
    const isDuplicate = aiGlossary.some((g: any) => g.misread === oldText && g.corrected === newText)
    
    if (!isDuplicate) {
      aiGlossary.push({ misread: oldText, corrected: newText })
      
      // Keep only the last 20 corrections so the prompt doesn't get too large
      if (aiGlossary.length > 20) {
        aiGlossary.shift()
      }

      preferences.ai_glossary = aiGlossary

      await adminSupabase
        .from('profiles')
        .update({ preferences })
        .eq('id', user.id)
    }

    return NextResponse.json({ success: true, aiGlossary })
  } catch (err: any) {
    console.error('Learn API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminSupabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  
  try {
    const { misread } = await req.json()
    const { data: profile } = await adminSupabase.from('profiles').select('preferences').eq('id', user.id).single()
    const preferences = profile?.preferences || {}
    let aiGlossary = preferences.ai_glossary || []
    
    aiGlossary = aiGlossary.filter((g: any) => g.misread !== misread)
    preferences.ai_glossary = aiGlossary
    
    await adminSupabase.from('profiles').update({ preferences }).eq('id', user.id)
    return NextResponse.json({ success: true, aiGlossary })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
