import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getDocsClient, getDriveClient } from '@/utils/google'

export async function POST(req: Request) {
  const supabase = await createClient()

  // Use admin client for the sync_jobs table to bypass RLS since we only created a SELECT policy
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
    const { projectId, blocks, newTitle } = await req.json()
    
    if (!projectId || !blocks || !Array.isArray(blocks)) {
      return NextResponse.json({ error: 'Missing or invalid payload data' }, { status: 400 })
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

    // 2. Fetch Project Docs Info
    const { data: project } = await supabase
      .from('script_projects')
      .select('google_doc_id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!project?.google_doc_id) {
      return NextResponse.json({ error: 'No Google Doc linked to this project' }, { status: 400 })
    }

    // 3. Queue the jobs in the database to guarantee execution
    const idempotencyKey = `sync_${projectId}_${Date.now()}_${Math.random().toString(36).substring(7)}`
    
    const { data: job, error: jobError } = await adminSupabase
      .from('document_sync_jobs')
      .insert({
        project_id: projectId,
        document_id: project.google_doc_id,
        operation_type: 'batchUpdate',
        payload: { blocks, newTitle },
        idempotency_key: idempotencyKey,
        status: 'pending'
      })
      .select()
      .single()

    if (jobError) {
      throw jobError
    }

    // 4. Execute the update using Google Docs API
    const docs = getDocsClient(integration.encrypted_token_reference)
    
    // Fetch document to get current length for exact styling ranges
    const docInfo = await docs.documents.get({ documentId: project.google_doc_id })
    const bodyContent = docInfo.data.body?.content || []
    let currentIndex = (bodyContent[bodyContent.length - 1]?.endIndex || 2) - 1
    
    const requests: any[] = []
    
    for (const block of blocks) {
      const textToInsert = block.content + '\n'
      const textLength = textToInsert.length
      
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: textToInsert
        }
      })

      const baseFields = 'bold,weightedFontFamily,fontSize'
      const baseTextStyle = {
        weightedFontFamily: { fontFamily: 'Courier New' },
        fontSize: { magnitude: 12, unit: 'PT' }
      }
      
      if (block.type === 'scene_heading') {
        requests.push({
          updateTextStyle: {
            range: { startIndex: currentIndex, endIndex: currentIndex + textLength },
            textStyle: { bold: true, ...baseTextStyle },
            fields: baseFields
          }
        })
        requests.push({
          updateParagraphStyle: {
            range: { startIndex: currentIndex, endIndex: currentIndex + textLength },
            paragraphStyle: { 
              alignment: 'START',
              indentStart: { magnitude: 0, unit: 'PT' },
              indentFirstLine: { magnitude: 0, unit: 'PT' },
              spaceAbove: { magnitude: 24, unit: 'PT' }, // 2 blank lines before scene
              spaceBelow: { magnitude: 12, unit: 'PT' }  // 1 blank line after scene
            },
            fields: 'alignment,indentStart,indentFirstLine,spaceAbove,spaceBelow'
          }
        })
      } else if (block.type === 'character') {
        requests.push({
          updateTextStyle: {
            range: { startIndex: currentIndex, endIndex: currentIndex + textLength },
            textStyle: { bold: true, ...baseTextStyle },
            fields: baseFields
          }
        })
        requests.push({
          updateParagraphStyle: {
            range: { startIndex: currentIndex, endIndex: currentIndex + textLength },
            paragraphStyle: { 
              alignment: 'START',
              indentStart: { magnitude: 158, unit: 'PT' }, // ~2.2 inches from margin
              indentFirstLine: { magnitude: 158, unit: 'PT' },
              spaceAbove: { magnitude: 12, unit: 'PT' }, // 1 blank line before character
              spaceBelow: { magnitude: 0, unit: 'PT' }   // 0 blank lines after (dialogue follows immediately)
            },
            fields: 'alignment,indentStart,indentFirstLine,spaceAbove,spaceBelow'
          }
        })
      } else if (block.type === 'parenthetical') {
        requests.push({
          updateTextStyle: {
            range: { startIndex: currentIndex, endIndex: currentIndex + textLength },
            textStyle: { bold: false, ...baseTextStyle },
            fields: baseFields
          }
        })
        requests.push({
          updateParagraphStyle: {
            range: { startIndex: currentIndex, endIndex: currentIndex + textLength },
            paragraphStyle: { 
              alignment: 'START',
              indentStart: { magnitude: 115, unit: 'PT' }, // ~1.6 inches from margin
              indentFirstLine: { magnitude: 115, unit: 'PT' },
              indentEnd: { magnitude: 144, unit: 'PT' },
              spaceAbove: { magnitude: 0, unit: 'PT' },
              spaceBelow: { magnitude: 0, unit: 'PT' }
            },
            fields: 'alignment,indentStart,indentFirstLine,indentEnd,spaceAbove,spaceBelow'
          }
        })
      } else if (block.type === 'action') {
        requests.push({
          updateTextStyle: {
            range: { startIndex: currentIndex, endIndex: currentIndex + textLength },
            textStyle: { bold: false, ...baseTextStyle },
            fields: baseFields
          }
        })
        requests.push({
          updateParagraphStyle: {
            range: { startIndex: currentIndex, endIndex: currentIndex + textLength },
            paragraphStyle: { 
              alignment: 'START',
              indentStart: { magnitude: 0, unit: 'PT' }, // 0 inches
              indentFirstLine: { magnitude: 0, unit: 'PT' },
              spaceAbove: { magnitude: 12, unit: 'PT' }, // 1 blank line before action
              spaceBelow: { magnitude: 12, unit: 'PT' }  // 1 blank line after action
            },
            fields: 'alignment,indentStart,indentFirstLine,spaceAbove,spaceBelow'
          }
        })
      } else {
        // Dialogue
        requests.push({
          updateParagraphStyle: {
            range: { startIndex: currentIndex, endIndex: currentIndex + textLength },
            paragraphStyle: { 
              alignment: 'START',
              indentStart: { magnitude: 72, unit: 'PT' }, // 1 inch from left margin
              indentFirstLine: { magnitude: 72, unit: 'PT' },
              indentEnd: { magnitude: 108, unit: 'PT' },  // 1.5 inch from right margin
              spaceAbove: { magnitude: 0, unit: 'PT' },   // Dialogue usually tightly follows Character or Parenthetical
              spaceBelow: { magnitude: 12, unit: 'PT' }   // 1 blank line after dialogue
            },
            fields: 'alignment,indentStart,indentFirstLine,indentEnd,spaceAbove,spaceBelow'
          }
        })
        requests.push({
          updateTextStyle: {
            range: { startIndex: currentIndex, endIndex: currentIndex + textLength },
            textStyle: { bold: false, ...baseTextStyle },
            fields: baseFields
          }
        })
      }
      
      currentIndex += textLength
    }

    try {
      // Append text
      await docs.documents.batchUpdate({
        documentId: project.google_doc_id,
        requestBody: { requests }
      })

      // Update Document Title if newTitle is provided
      if (newTitle) {
        const drive = getDriveClient(integration.encrypted_token_reference)
        
        await drive.files.update({
          fileId: project.google_doc_id,
          requestBody: { name: newTitle }
        })
      }

      // 5. Mark job as successful
      await adminSupabase
        .from('document_sync_jobs')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', job.id)

      return NextResponse.json({ success: true, message: 'Successfully synced to Google Docs' })
    } catch (syncError: any) {
      console.error('Google Docs Sync API Error:', syncError)
      await adminSupabase
        .from('document_sync_jobs')
        .update({ 
          status: 'failed', 
          last_error: syncError.message,
          updated_at: new Date().toISOString() 
        })
        .eq('id', job.id)
        
      return NextResponse.json({ error: 'Sync failed, queued for retry', details: syncError.message }, { status: 502 })
    }
  } catch (err: any) {
    console.error('Error syncing to Google Docs:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
