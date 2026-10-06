import Link from 'next/link'
import { Film, Mic, FileText, ArrowRight } from 'lucide-react'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background selection:bg-primary/20">
      <header className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b border-border/50 bg-background/80 px-6 backdrop-blur-md">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Film className="h-5 w-5 text-primary" />
          <span>DP VoiceScript</span>
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Sign In
          </Link>
          <Link 
            href="/login" 
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            Get Started
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="flex flex-col items-center justify-center space-y-8 px-4 py-32 text-center md:py-48">
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary">
            ✨ Malayalam Voice-to-Screenplay Studio
          </div>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Speak your vision. <br />
            <span className="text-muted-foreground">We write the script.</span>
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
            A professional cinematic writing studio that converts spoken Malayalam into perfectly formatted film scripts, synchronized directly with Google Docs.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link 
              href="/login" 
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-base font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              Start Recording <Mic className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="border-t border-border bg-card/50 px-6 py-24">
          <div className="mx-auto grid max-w-5xl gap-12 sm:grid-cols-3">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Mic className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold">Speak Naturally</h3>
              <p className="text-muted-foreground">
                Dictate in Malayalam or mixed Malayalam-English. Our AI understands your accent and intent.
              </p>
            </div>
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FileText className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold">Perfect Formatting</h3>
              <p className="text-muted-foreground">
                Automatically formats scenes, action, and dialogue to industry standards without rewriting your story.
              </p>
            </div>
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
              </div>
              <h3 className="text-xl font-semibold">Live Google Docs Sync</h3>
              <p className="text-muted-foreground">
                Every word you say is processed and synced to a Google Doc in real-time. Full backup and export ready.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        <p>DP AI Studios | Define Perspective</p>
      </footer>
    </div>
  )
}
