import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getGoogleAuthUrl } from '@/utils/google'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const returnTo = searchParams.get('return_to') || searchParams.get('next')

  const supabase = await createClient()

  // Verify the user is logged in
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/login', request.url)
    if (returnTo) loginUrl.searchParams.set('next', returnTo)
    return NextResponse.redirect(loginUrl)
  }

  try {
    const authUrl = getGoogleAuthUrl(returnTo || undefined)
    return NextResponse.redirect(authUrl)
  } catch (error: any) {
    console.error('Error generating Google Auth URL:', error)
    return NextResponse.redirect(new URL('/dashboard?error=Google_Config_Missing', request.url))
  }
}
