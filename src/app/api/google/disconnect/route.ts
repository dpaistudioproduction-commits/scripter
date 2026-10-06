import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getGoogleOAuthClient } from '@/utils/google'

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
    // 1. Fetch Google Integration details
    const { data: integration } = await supabase
      .from('google_integrations')
      .select('encrypted_token_reference')
      .eq('user_id', user.id)
      .single()

    if (integration?.encrypted_token_reference) {
      // 2. Revoke the token at Google
      try {
        const oauth2Client = getGoogleOAuthClient()
        await oauth2Client.revokeToken(integration.encrypted_token_reference)
      } catch (revokeError) {
        console.warn('Could not revoke token at Google (might already be invalid):', revokeError)
      }
    }

    // 3. Remove from database
    const { error } = await supabase
      .from('google_integrations')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, message: 'Google account disconnected' })
  } catch (error: any) {
    console.error('Error disconnecting Google account:', error)
    return NextResponse.json({ error: 'Failed to disconnect account' }, { status: 500 })
  }
}
