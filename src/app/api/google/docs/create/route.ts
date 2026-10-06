import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getDocsClient } from '@/utils/google'

export async function POST(request: Request) {
  const supabase = await createClient()

  // Verify the user is logged in
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { projectId } = await request.json()

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }

    // 1. Fetch Google Integration details
    const { data: integration } = await supabase
      .from('google_integrations')
      .select('encrypted_token_reference')
      .eq('user_id', user.id)
      .single()

    if (!integration?.encrypted_token_reference) {
      return NextResponse.json({ error: 'Google Docs not connected' }, { status: 403 })
    }

    // 2. Fetch Project details to get the title
    const { data: project } = await supabase
      .from('script_projects')
      .select('title, google_doc_id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()
      
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    
    if (project.google_doc_id) {
      return NextResponse.json({ error: 'Document already exists for this project' }, { status: 400 })
    }

    // 3. Create the Google Doc
    const docs = getDocsClient(integration.encrypted_token_reference)
    
    const docResponse = await docs.documents.create({
      requestBody: {
        title: project.title,
      }
    })

    const documentId = docResponse.data.documentId
    const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`

    // 4. Update the project with the new document ID
    const { error: updateError } = await supabase
      .from('script_projects')
      .update({
        google_doc_id: documentId,
        google_doc_url: documentUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ 
      success: true, 
      documentId,
      documentUrl
    })
  } catch (error: any) {
    console.error('Error creating Google Doc:', error)
    return NextResponse.json({ error: 'Failed to create Google Doc' }, { status: 500 })
  }
}
