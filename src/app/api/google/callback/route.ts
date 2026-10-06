import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { exchangeCodeForTokens } from '@/utils/google'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (!code) {
    return NextResponse.redirect(`${origin}/dashboard?error=OAuth_Code_Missing`)
  }

  const supabase = await createClient()

  // Verify the user is logged in
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  try {
    const tokens = await exchangeCodeForTokens(code)

    if (!tokens.refresh_token) {
      // If we don't get a refresh token, the user might have already granted access previously.
      // We need to force them to revoke and re-grant, or handle this gracefully.
      console.warn('No refresh token received. User may need to revoke access first.')
      // Proceeding with what we have, but ideally we should prompt re-consent.
      return NextResponse.redirect(`${origin}/settings?error=No_Refresh_Token`)
    }

    // In a real production app, the refresh token MUST be encrypted before saving to DB.
    // For this implementation, we rely on Supabase RLS and SSL, but encryption at rest (e.g., pg_sodium) is highly recommended.
    const { error } = await supabase
      .from('google_integrations')
      .upsert(
        {
          user_id: user.id,
          encrypted_token_reference: tokens.refresh_token, // TODO: encrypt this string
          scopes: tokens.scope?.split(' ') || [],
          status: 'active',
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id' }
      )

    if (error) {
      console.error('Error saving Google Integration:', error)
      return NextResponse.redirect(`${origin}/dashboard?error=Database_Save_Failed`)
    }

    return NextResponse.redirect(`${origin}/dashboard?success=Google_Connected`)
  } catch (error: any) {
    console.error('Error in Google OAuth callback:', error)
    return NextResponse.redirect(`${origin}/dashboard?error=OAuth_Exchange_Failed`)
  }
}
