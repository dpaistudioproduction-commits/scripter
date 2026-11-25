import { login, signup, guestLogin } from './actions'
import { Film, Sparkles } from 'lucide-react'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string; success?: string }>
}) {
  const params = await searchParams
  const errorMessage = params.error || params.message
  const successMessage = params.success

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-card p-10 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-4">
            <Film size={24} />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Welcome to DP VoiceScript
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to access your AI Malayalam Voice-to-Screenplay Studio.
          </p>
        </div>

        {errorMessage && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-center text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-sm text-emerald-600 dark:text-emerald-400">
            {successMessage === 'Google_Connected' ? 'Google account connected successfully!' : successMessage}
          </div>
        )}

        <form className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="director@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="••••••••"
              />
            </div>
          </div>
          <div className="flex flex-col space-y-3">
            <button
              formAction={login}
              className="flex w-full justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Sign in
            </button>
            <button
              formAction={signup}
              className="flex w-full justify-center rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Sign up
            </button>
          </div>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <button
            formAction={guestLogin}
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-primary/20"
          >
            <Sparkles size={16} />
            Continue as Guest (Free Instant Access)
          </button>
        </form>
      </div>
    </div>
  )
}
