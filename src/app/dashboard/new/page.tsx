import { createProject } from './actions'
import { ArrowLeft, Film } from 'lucide-react'
import Link from 'next/link'

export default function NewScriptPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background px-6">
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </header>

      <main className="flex-1 p-6 md:p-10">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Create New Script</h1>
            <p className="text-muted-foreground">Set up your new Voice-to-Screenplay project.</p>
          </div>

          <form action={createProject} className="space-y-8 rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Script Title <span className="text-destructive">*</span>
                </label>
                <input
                  id="title"
                  name="title"
                  required
                  placeholder="e.g. Untitled Masterpiece"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Description (Optional)
                </label>
                <textarea
                  id="description"
                  name="description"
                  placeholder="Brief logline or notes about the script..."
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="script_type" className="text-sm font-medium leading-none">Script Type</label>
                  <select
                    id="script_type"
                    name="script_type"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="Feature Film">Feature Film</option>
                    <option value="Short Film">Short Film</option>
                    <option value="Advertisement">Advertisement</option>
                    <option value="Documentary">Documentary</option>
                    <option value="Web Series">Web Series</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="language_mode" className="text-sm font-medium leading-none">Language Mode</label>
                  <select
                    id="language_mode"
                    name="language_mode"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="Malayalam">Malayalam</option>
                    <option value="Malayalam-English Mixed">Malayalam-English Mixed (Manglish)</option>
                    <option value="English">English</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="screenplay_style" className="text-sm font-medium leading-none">Screenplay Style</label>
                <select
                  id="screenplay_style"
                  name="screenplay_style"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="Standard Film Screenplay">Standard Film Screenplay</option>
                  <option value="Indian Film Script">Indian Film Script</option>
                  <option value="Advertising Script">Advertising Script</option>
                </select>
              </div>

              <div className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-border p-4">
                <input
                  type="checkbox"
                  id="google_docs_sync"
                  name="google_docs_sync"
                  value="true"
                  className="h-4 w-4 rounded border-primary text-primary focus:ring-primary mt-1"
                />
                <div className="space-y-1 leading-none">
                  <label htmlFor="google_docs_sync" className="font-medium text-sm">
                    Enable Google Docs Sync
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Automatically create and sync a Google Document as you dictate. Requires linking your Google account.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Create Project
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
