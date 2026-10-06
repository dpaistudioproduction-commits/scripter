import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getGoogleAuthUrl } from '@/utils/google'

export async function GET(request: Request) {
  const supabase = await createClient()

  // Verify the user is logged in
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const authUrl = getGoogleAuthUrl()
    return NextResponse.redirect(authUrl)
  } catch (error: any) {
    console.error('Error generating Google Auth URL:', error)
    return NextResponse.redirect(new URL('/dashboard?error=Google_Config_Missing', request.url))
  }
}
