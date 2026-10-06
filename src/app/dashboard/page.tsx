import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, FileText, Settings, LogOut, Clock, PlayCircle } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  // Fetch projects (will be empty until we create one)
  const { data: projects, error } = await supabase
    .from('script_projects')
    .select('*')
    .order('updated_at', { ascending: false })

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background px-6">
        <div className="flex flex-1 items-center gap-2 font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileText size={18} />
          </div>
          <span>DP VoiceScript</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user.email}</span>
          <Link href="/settings" className="text-muted-foreground hover:text-foreground">
            <Settings size={20} />
          </Link>
          <form action="/auth/signout" method="post">
            <button className="text-muted-foreground hover:text-foreground">
              <LogOut size={20} />
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 p-6 md:p-10">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">My Scripts</h1>
              <p className="text-muted-foreground">Manage and continue your Voice-to-Screenplay projects.</p>
            </div>
            <Link 
              href="/dashboard/new" 
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              <Plus size={16} /> New Script
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {!projects || projects.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-12 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">No scripts yet</h3>
                <p className="mb-4 text-sm text-muted-foreground">Start your first Malayalam screenplay project.</p>
                <Link 
                  href="/dashboard/new" 
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Create Project
                </Link>
              </div>
            ) : (
              projects.map((project) => (
                <Link 
                  key={project.id} 
                  href={`/studio/${project.id}`}
                  className="group flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        {project.status}
                      </span>
                      {project.google_doc_id && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                          <FileText size={12} /> Synced
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold group-hover:text-primary transition-colors line-clamp-1">{project.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {project.description || "No description provided."}
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      <span>{new Date(project.updated_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1 font-medium text-foreground">
                      Continue <PlayCircle size={14} />
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
