'use client'

import { useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function CreateDocButton({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleCreate = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/google/docs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      })
      const data = await res.json()
      if (res.ok) {
        router.refresh()
      } else {
        if (data.code === 'TOKEN_EXPIRED') {
          if (confirm('Google Docs authorization expired. Would you like to reconnect now?')) {
            window.location.href = `/api/google/connect?return_to=/studio/${projectId}`
          }
        } else {
          alert(data.error || 'Failed to create Google Doc')
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button 
      onClick={handleCreate}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
      {loading ? 'Creating...' : 'Create Google Doc'}
    </button>
  )
}
