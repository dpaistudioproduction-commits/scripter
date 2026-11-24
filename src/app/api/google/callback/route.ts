import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { exchangeCodeForTokens } from '@/utils/google'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  
  const redirectTarget = (pathAndQuery: string) => {
    if (state && state.startsWith('/')) {
      const sep = state.includes('?') ? '&' : '?'
      return `${origin}${state}${sep}${pathAndQuery}`
    }
    return `${origin}/dashboard?${pathAndQuery}`
  }
  
  if (!code) {
    return NextResponse.redirect(redirectTarget('error=OAuth_Code_Missing'))
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
      // Check if user already has an existing refresh token in db
      const { data: existing } = await supabase
        .from('google_integrations')
        .select('encrypted_token_reference')
        .eq('user_id', user.id)
        .single()

      if (!existing?.encrypted_token_reference) {
        console.warn('No refresh token received and none existing.')
        return NextResponse.redirect(redirectTarget('error=No_Refresh_Token'))
      }
    }

    const updatePayload: any = {
      user_id: user.id,
      scopes: tokens.scope?.split(' ') || [],
      status: 'active',
      updated_at: new Date().toISOString()
    }
    if (tokens.refresh_token) {
      updatePayload.encrypted_token_reference = tokens.refresh_token
    }

    const { error } = await supabase
      .from('google_integrations')
      .upsert(updatePayload, { onConflict: 'user_id' })

    if (error) {
      console.error('Error saving Google Integration:', error)
      return NextResponse.redirect(redirectTarget('error=Database_Save_Failed'))
    }

    return NextResponse.redirect(redirectTarget('success=Google_Connected'))
  } catch (error: any) {
    console.error('Error in Google OAuth callback:', error)
    return NextResponse.redirect(redirectTarget('error=OAuth_Exchange_Failed'))
  }
}
