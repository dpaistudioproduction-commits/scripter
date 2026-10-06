'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function createProject(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const script_type = formData.get('script_type') as string
  const language_mode = formData.get('language_mode') as string
  const screenplay_style = formData.get('screenplay_style') as string
  const google_docs_sync = formData.get('google_docs_sync') === 'true'

  // Insert into script_projects
  const { data: project, error } = await supabase
    .from('script_projects')
    .insert([
      {
        user_id: user.id,
        title,
        description,
        script_type,
        language: language_mode,
        screenplay_style,
        status: 'draft'
      },
    ])
    .select('id')
    .single()

  if (error || !project) {
    console.error('Error creating project:', error)
    // You could redirect back to new page with error message, but for simplicity:
    redirect('/dashboard/new?error=Creation_Failed')
  }

  // TODO: If google_docs_sync is true, we should initiate doc creation here or in the studio route.
  // For now, redirect to the studio page.
  
  redirect(`/studio/${project.id}`)
}
