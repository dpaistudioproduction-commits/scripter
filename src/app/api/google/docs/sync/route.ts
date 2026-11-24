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
    const { projectId, blocks, newTitle, fullSync } = await req.json()
    
    if (!projectId || !blocks || !Array.isArray(blocks)) {
      return NextResponse.json({ error: 'Missing or invalid payload data' }, { status: 400 })
    }

    // 1. Fetch Google Integration details
    const { data: integration } = await supabase
      .from('google_integrations')
      .select('encrypted_token_reference, status')
      .eq('user_id', user.id)
      .single()

    if (!integration?.encrypted_token_reference) {
      return NextResponse.json({ 
        error: 'Google Docs not connected. Please connect your Google account.', 
        code: 'NOT_CONNECTED' 
      }, { status: 403 })
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
        operation_type: fullSync ? 'fullSync' : 'batchUpdate',
        payload: { blocks, newTitle, fullSync },
        idempotency_key: idempotencyKey,
        status: 'pending'
      })
      .select()
      .single()

    if (jobError) {
      throw jobError
    }

    // Helper to handle invalid_grant errors
    const handleGoogleError = async (err: any) => {
      const errStr = String(err?.message || '') + ' ' + JSON.stringify(err?.response?.data || '')
      const isInvalidGrant = errStr.includes('invalid_grant') || errStr.includes('invalid_token') || errStr.includes('expired or revoked')

      if (isInvalidGrant) {
        await adminSupabase
          .from('google_integrations')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
      }

      await adminSupabase
        .from('document_sync_jobs')
        .update({ 
          status: 'failed', 
          last_error: isInvalidGrant ? 'Google OAuth token expired (invalid_grant)' : err.message,
          updated_at: new Date().toISOString() 
        })
        .eq('id', job.id)

      if (isInvalidGrant) {
        return NextResponse.json({ 
          error: 'Google Docs authorization has expired. Please reconnect your Google account.', 
          code: 'TOKEN_EXPIRED' 
        }, { status: 401 })
      }

      return NextResponse.json({ 
        error: 'Sync failed: ' + (err.message || 'Google API error'), 
        details: err.message 
      }, { status: 502 })
    }

    try {
      // 4. Execute the update using Google Docs API
      const docs = getDocsClient(integration.encrypted_token_reference)
      
      // Fetch document to get current length for exact styling ranges
      const docInfo = await docs.documents.get({ documentId: project.google_doc_id })
      const bodyContent = docInfo.data.body?.content || []
      const docEndIndex = bodyContent[bodyContent.length - 1]?.endIndex || 2

      // If fullSync is requested, clear existing document body first
      if (fullSync && docEndIndex > 2) {
        await docs.documents.batchUpdate({
          documentId: project.google_doc_id,
          requestBody: {
            requests: [
              {
                deleteContentRange: {
                  range: {
                    startIndex: 1,
                    endIndex: docEndIndex - 1
                  }
                }
              }
            ]
          }
        })
      }

      let currentIndex = fullSync ? 1 : (docEndIndex - 1)
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
                spaceAbove: { magnitude: 24, unit: 'PT' },
                spaceBelow: { magnitude: 12, unit: 'PT' }
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
                indentStart: { magnitude: 158, unit: 'PT' },
                indentFirstLine: { magnitude: 158, unit: 'PT' },
                spaceAbove: { magnitude: 12, unit: 'PT' },
                spaceBelow: { magnitude: 0, unit: 'PT' }
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
                indentStart: { magnitude: 115, unit: 'PT' },
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
                indentStart: { magnitude: 0, unit: 'PT' },
                indentFirstLine: { magnitude: 0, unit: 'PT' },
                spaceAbove: { magnitude: 12, unit: 'PT' },
                spaceBelow: { magnitude: 12, unit: 'PT' }
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
                indentStart: { magnitude: 72, unit: 'PT' },
                indentFirstLine: { magnitude: 72, unit: 'PT' },
                indentEnd: { magnitude: 108, unit: 'PT' },
                spaceAbove: { magnitude: 0, unit: 'PT' },
                spaceBelow: { magnitude: 12, unit: 'PT' }
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

      if (requests.length > 0) {
        await docs.documents.batchUpdate({
          documentId: project.google_doc_id,
          requestBody: { requests }
        })
      }

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
      return handleGoogleError(syncError)
    }
  } catch (err: any) {
    console.error('Error syncing to Google Docs:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
