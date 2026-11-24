import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mic, Square, Save, FileText, Settings, Settings2, PlayCircle, Loader2 } from 'lucide-react'
import StudioClient from './StudioClient'
import CreateDocButton from './CreateDocButton'

export default async function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch project details
  const { data: project, error } = await supabase
    .from('script_projects')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !project) {
    redirect('/dashboard')
  }

  // Fetch google integration status
  const { data: integration } = await supabase
    .from('google_integrations')
    .select('id, status')
    .eq('user_id', user.id)
    .single()
    
  const hasGoogleAuth = !!integration && integration.status !== 'expired'

  // Fetch the latest script revision to load saved blocks
  const { data: latestRevision } = await supabase
    .from('script_revisions')
    .select('content_json')
    .eq('project_id', id)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  const initialBlocks = latestRevision?.content_json || []

  // The actual heavy interactive parts (recording, three panels) need to be client-side.
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2 font-medium">
            <FileText size={18} className="text-primary" />
            <span className="max-w-[200px] truncate md:max-w-[300px]">{project.title}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
              {project.status}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {project.google_doc_id ? (
            <>
              <Link 
                href={project.google_doc_url || '#'} 
                target="_blank"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-muted dark:text-blue-400"
              >
                <FileText size={14} /> Open in Docs
              </Link>
              <Link 
                href={`/api/google/connect?return_to=/studio/${project.id}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Reconnect Google Docs account"
              >
                Reconnect
              </Link>
            </>
          ) : hasGoogleAuth ? (
            <CreateDocButton projectId={project.id} />
          ) : (
            <Link 
              href={`/api/google/connect?return_to=/studio/${project.id}`}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <FileText size={14} /> Connect Docs
            </Link>
          )}
          
          <button className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Settings2 size={18} />
          </button>
        </div>
      </header>

      {/* Main Studio Client Component */}
      <main className="flex min-h-0 flex-1">
        <StudioClient project={project} initialBlocks={initialBlocks} />
      </main>
    </div>
  )
}
