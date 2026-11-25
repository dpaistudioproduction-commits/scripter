'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/login?message=Could not authenticate user')
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signUp(data)

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function guestLogin() {
  const supabase = await createClient()

  // 1. Try standard anonymous sign in first
  try {
    const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously()
    if (!anonError && anonData?.session) {
      revalidatePath('/', 'layout')
      redirect('/dashboard')
    }
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err
  }

  // 2. Seamless instant sign in using the provisioned free guest user
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'guest@scripter.app',
      password: 'GuestPassword123!',
    })

    if (!error && data?.session) {
      revalidatePath('/', 'layout')
      redirect('/dashboard')
    }
    if (error) {
      console.error('Guest login fallback error:', error)
      redirect(`/login?error=${encodeURIComponent(error.message)}`)
    }
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err
    redirect(`/login?error=${encodeURIComponent(err.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
