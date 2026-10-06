import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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
    const { projectId, blocks } = await req.json()
    
    if (!projectId || !blocks) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 })
    }

    // Verify ownership
    const { data: project } = await supabase
      .from('script_projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Update or Insert revision using admin client to bypass RLS UPDATE restrictions
    const { data: latest } = await adminSupabase
      .from('script_revisions')
      .select('id')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single()

    if (latest) {
      await adminSupabase.from('script_revisions').update({ content_json: blocks }).eq('id', latest.id)
    } else {
      await adminSupabase.from('script_revisions').insert({ 
        project_id: projectId, 
        version_number: 1, 
        content_json: blocks, 
        created_by: user.id 
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Save error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
