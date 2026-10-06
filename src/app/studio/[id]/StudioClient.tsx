'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, Square, Save, Play, CheckCircle2, AlertCircle, Loader2, Edit2, Trash2, Download, Image as ImageIcon, Book, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import AudioVisualizer from './AudioVisualizer'

interface StudioClientProps {
  project: any
  initialBlocks?: { type: string, content: string }[]
}

export default function StudioClient({ project, initialBlocks = [] }: StudioClientProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [transcript, setTranscript] = useState<{id: string, text: string, status: 'pending'|'confirmed'}[]>([])
  const [interimText, setInterimText] = useState('')
  const [screenplayBlocks, setScreenplayBlocks] = useState<any[]>(initialBlocks)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string>('Saved')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const [activeSceneIndex, setActiveSceneIndex] = useState<number | null>(null)
  const [aiDictionary, setAiDictionary] = useState<any[]>([])
  const [showDictionaryModal, setShowDictionaryModal] = useState(false)
  const recognitionRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isRecordingRef = useRef(false)
  
  useEffect(() => {
    fetch('/api/ai/learn')
      .then(res => res.json())
      .then(data => {
        if (data.aiGlossary) setAiDictionary(data.aiGlossary)
      })
      .catch(console.error)
  }, [])
  
  // ... (Keep the rest of the functions identical until the return statement)

  const startRecording = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setStream(mediaStream)
      setIsRecording(true)
      isRecordingRef.current = true

      // Initialize Web Speech API for real-time transcription
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'ml-IN' // Malayalam

        recognition.onresult = (event: any) => {
          let finalTranscript = ''
          let currentInterim = ''
          
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript
            } else {
              currentInterim += event.results[i][0].transcript
            }
          }
          
          setInterimText(currentInterim)

          if (finalTranscript.trim()) {
            const text = finalTranscript.trim()
            setTranscript(prev => [...prev, { id: Date.now().toString(), text, status: 'confirmed' }])
            
            // Call the AI Parser to intelligently format the script
            fetch('/api/ai/parse-script', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text })
            }).then(async (res) => {
              const data = await res.json()
              if (!res.ok) {
                if (data.error?.includes('GEMINI_API_KEY')) {
                  alert("Please add GEMINI_API_KEY to your .env.local file to enable intelligent formatting!")
                } else {
                  console.error("AI Error:", data.error)
                }
                
                // Fallback basic logic
                let blockType = 'dialogue'
                let newDocTitle = undefined
                if (
                  text.startsWith('സീൻ') || 
                  text.toUpperCase().startsWith('EXT') || 
                  text.toUpperCase().startsWith('INT')
                ) {
                  blockType = 'scene_heading'
                  document.title = `${text} - DP AI Studios`
                  newDocTitle = text // Completely override the Google Doc title with just the Scene name
                }
                setScreenplayBlocks(prev => {
                  const newBlocks = [...prev, { type: blockType, content: text }]
                  // If we are appending a new scene heading and currently filtered, switch to it?
                  // Better to let them see it if they are on "All Scenes"
                  return newBlocks
                })
                syncToGoogleDocs([{ type: blockType, content: text }], newDocTitle)
                return
              }

              const parsedBlocks = data.blocks || []
              const blocksWithOriginal = parsedBlocks.map((b: any) => ({ ...b, originalContent: b.content }))
              let newDocTitle = undefined
              const sceneBlock = blocksWithOriginal.find((b: any) => b.type === 'scene_heading')
              if (sceneBlock) {
                document.title = `${sceneBlock.content} - DP AI Studios`
                newDocTitle = sceneBlock.content
              }

              setScreenplayBlocks(prev => [...prev, ...blocksWithOriginal])
              syncToGoogleDocs(blocksWithOriginal, newDocTitle)

            }).catch(e => {
              console.error("Failed to call AI", e)
            })
          }
        }

        recognition.onerror = (event: any) => {
          if (event.error === 'no-speech') {
            // Ignore no-speech errors (happens during silence)
            return
          }
          console.error('Speech recognition error', event.error)
          alert('Speech recognition error: ' + event.error)
        }

        recognition.onend = () => {
          // Restart automatically if still supposed to be recording
          if (isRecordingRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start()
            } catch (e) {
              // Ignore already started errors
            }
          }
        }

        recognition.start()
        recognitionRef.current = recognition
      } else {
        alert("Your browser doesn't support real-time speech recognition. Please use Google Chrome.")
      }
    } catch (err) {
      console.error('Error accessing microphone:', err)
      alert('Could not access microphone. Please allow permissions.')
    }
  }

  const stopRecording = () => {
    isRecordingRef.current = false
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsRecording(false)
    setInterimText('')
  }

  const syncToGoogleDocs = async (blocksToSync: any[], newTitle?: string) => {
    if (!project.google_doc_id) {
      alert("Missing Google Doc! Please click 'Create Google Doc' at the top right first.")
      return
    }
    try {
      await fetch('/api/google/docs/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId: project.id, 
          blocks: blocksToSync,
          newTitle
        })
      })
    } catch (e) {
      console.error('Error syncing to Docs:', e)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    setUploadProgress(`Analyzing 1 of ${files.length}...`)

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setUploadProgress(`Analyzing ${i + 1} of ${files.length}...`)
        
        await new Promise<void>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = async () => {
            const img = new window.Image()
            img.onload = async () => {
              const canvas = document.createElement('canvas')
              const MAX_WIDTH = 2000
              const MAX_HEIGHT = 2400
              let width = img.width
              let height = img.height

              if (width > height) {
                if (width > MAX_WIDTH) {
                  height *= MAX_WIDTH / width
                  width = MAX_WIDTH
                }
              } else {
                if (height > MAX_HEIGHT) {
                  width *= MAX_HEIGHT / height
                  height = MAX_HEIGHT
                }
              }
              canvas.width = width
              canvas.height = height
              
              const ctx = canvas.getContext('2d')
              ctx?.drawImage(img, 0, 0, width, height)
              
              const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.9)
              const base64String = compressedDataUrl.split(',')[1]
              
              try {
                const res = await fetch('/api/ai/parse-image', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ imageBase64: base64String })
                })
                const data = await res.json()
                
                if (!res.ok) {
                  console.error("Error parsing image:", data.error)
                  alert("Error parsing image " + (i + 1) + ": " + (data.error || 'Unknown error'))
                  resolve()
                  return
                }

                const parsedBlocks = data.blocks || []
                if (parsedBlocks.length > 0) {
                  const blocksWithOriginal = parsedBlocks.map((b: any) => ({ ...b, originalContent: b.content }))

                  let newDocTitle = undefined
                  const sceneBlock = blocksWithOriginal.find((b: any) => b.type === 'scene_heading')
                  if (sceneBlock) {
                    document.title = `${sceneBlock.content} - DP AI Studios`
                    newDocTitle = sceneBlock.content
                  }

                  setScreenplayBlocks(prev => [...prev, ...blocksWithOriginal])
                  syncToGoogleDocs(blocksWithOriginal, newDocTitle)
                }
                resolve()
              } catch (err) {
                console.error(err)
                alert("Failed to process image " + (i + 1))
                resolve()
              }
            }
            img.src = reader.result as string
          }
          reader.readAsDataURL(file)
        })
      }
    } catch (err) {
      console.error(err)
    }
    
    setIsUploading(false)
    setUploadProgress('')
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Three panel layout
  return (
    <div className="flex h-full w-full divide-x divide-border">
      
      {/* LEFT PANEL: Navigator & Controls */}
      <aside className="flex w-64 flex-col bg-muted/20 md:w-80">
        <div className="flex shrink-0 flex-col gap-4 border-b border-border p-4">
          <h2 className="font-semibold">Recording Controls</h2>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              {!isRecording ? (
                <button 
                  onClick={startRecording}
                  className="flex flex-1 items-center justify-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
                >
                  <Mic size={16} /> Record
                </button>
              ) : (
                <button 
                  onClick={stopRecording}
                  className="flex flex-1 items-center justify-center gap-2 rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-200 dark:text-black dark:hover:bg-zinc-300"
                >
                  <Square size={16} /> Stop
                </button>
              )}
              <button className="flex items-center justify-center rounded-md border border-border bg-background p-2 text-foreground transition-colors hover:bg-muted">
                <Save size={16} />
              </button>
            </div>
            
            <input 
              type="file" 
              accept="image/*" 
              multiple
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
            >
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
              {isUploading ? uploadProgress || 'Analyzing Image...' : 'Upload Page Image'}
            </button>
            <button 
              onClick={() => setShowDictionaryModal(true)}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted mt-2 shadow-sm"
            >
              <Book size={16} className="text-primary" />
              My AI Dictionary
            </button>
          </div>
          {isRecording && stream && (
            <div className="mt-2 w-full">
              <AudioVisualizer stream={stream} />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Scene Navigator</h3>
            {activeSceneIndex !== null && (
              <button 
                onClick={() => setActiveSceneIndex(null)}
                className="text-[10px] uppercase font-bold text-primary hover:underline"
              >
                View All
              </button>
            )}
          </div>
          <div className="space-y-1">
            {activeSceneIndex === null && screenplayBlocks.filter(b => b.type === 'scene_heading').length > 0 && (
              <div 
                onClick={() => setActiveSceneIndex(null)}
                className="cursor-pointer mb-2 rounded bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
              >
                Show All Scenes
              </div>
            )}
            
            {screenplayBlocks.map((scene, idx) => {
              if (scene.type !== 'scene_heading') return null
              const isActive = activeSceneIndex === idx
              
              return (
                <div 
                  key={idx} 
                  onClick={() => setActiveSceneIndex(idx)}
                  className={cn(
                    "flex items-center rounded-md px-3 py-2 text-sm font-medium focus-within:ring-2 focus-within:ring-primary cursor-pointer transition-colors",
                    isActive ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted hover:bg-muted/80 text-foreground"
                  )}
                >
                  <span className="mr-2 opacity-50">{screenplayBlocks.filter(b => b.type === 'scene_heading').indexOf(scene) + 1}.</span>
                  <input
                    value={scene.content}
                    onChange={(e) => {
                      const newBlocks = [...screenplayBlocks]
                      newBlocks[idx].content = e.target.value
                      setScreenplayBlocks(newBlocks)
                    }}
                    className={cn(
                      "w-full bg-transparent border-none p-0 focus:ring-0 focus:outline-none",
                      isActive ? "text-primary-foreground placeholder:text-primary-foreground/50" : "text-foreground"
                    )}
                  />
                </div>
              )
            })}
            {screenplayBlocks.filter(b => b.type === 'scene_heading').length === 0 && (
              <div className="text-xs text-muted-foreground italic">No scenes yet.</div>
            )}
          </div>
        </div>
      </aside>

      {/* CENTER PANEL: Screenplay Editor */}
      <section className="flex flex-1 flex-col bg-card">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-6">
          <h2 className="text-sm font-medium text-muted-foreground">
            {activeSceneIndex !== null ? 'Screenplay Editor (Scene View)' : 'Screenplay Editor'}
          </h2>
          <div className="flex gap-2">
            <button 
              onClick={async () => {
                setIsSaving(true)
                setSaveStatus('Saving...')
                try {
                  await fetch('/api/projects/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId: project.id, blocks: screenplayBlocks })
                  })
                  setSaveStatus('Saved')
                } catch(e) {
                  alert("Failed to save.")
                  setSaveStatus('Error')
                }
                setIsSaving(false)
                setTimeout(() => setSaveStatus('Saved'), 3000)
              }}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {saveStatus}
            </button>
            <button 
              onClick={() => {
                if (confirm("Clear the entire editor?")) {
                  setScreenplayBlocks([])
                  setActiveSceneIndex(null)
                }
              }}
              className="flex items-center gap-1.5 rounded bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/80"
            >
              <Trash2 size={14} /> Clear
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="mx-auto max-w-3xl rounded-sm border border-border bg-background p-12 shadow-sm min-h-full font-serif text-lg leading-snug">
            {activeSceneIndex === null && (
              <div className="text-center font-bold mb-8 text-2xl">
                {project.title.toUpperCase()}
              </div>
            )}
            
            {screenplayBlocks.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center gap-4 text-muted-foreground opacity-50">
                <Edit2 size={32} />
                <span className="italic">( The screenplay is currently empty. Start dictating to generate editable script blocks. )</span>
              </div>
            ) : (
              screenplayBlocks.map((block, idx) => {
                // Determine which scene this block belongs to
                let mySceneIndex = -1
                for (let i = idx; i >= 0; i--) {
                  if (screenplayBlocks[i].type === 'scene_heading') {
                    mySceneIndex = i
                    break
                  }
                }
                
                // Filter by active scene if selected
                if (activeSceneIndex !== null && mySceneIndex !== activeSceneIndex) {
                  return null
                }
                let textAlignment = 'text-left'
                let indentClass = ''
                let fontWeight = 'font-normal'
                
                if (block.type === 'scene_heading') {
                  fontWeight = 'font-bold'
                } else if (block.type === 'character') {
                  fontWeight = 'font-bold'
                  indentClass = 'pl-[2.5in]' // Roughly 2.5 inches in web pixels (usually ~240px)
                } else if (block.type === 'parenthetical') {
                  indentClass = 'pl-[1.5in] pr-[1.5in]'
                } else if (block.type === 'dialogue') {
                  indentClass = 'pl-[1in] pr-[1in]'
                } else if (block.type === 'action') {
                  // normal
                }

                return (
                  <div key={idx} className={cn("group relative mb-1 -mx-2 rounded border border-transparent px-2 py-1 transition-colors hover:border-border hover:bg-muted/30", indentClass)}>
                    <textarea
                      value={block.content}
                      onBlur={(e) => {
                        const newContent = e.target.value.trim()
                        if (block.originalContent && newContent !== block.originalContent && newContent !== block.content) {
                          // User corrected the AI! Send this to the ML learning engine
                          fetch('/api/ai/learn', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ oldText: block.originalContent, newText: newContent })
                          })
                          .then(res => res.json())
                          .then(data => {
                            if (data.aiGlossary) setAiDictionary(data.aiGlossary)
                          })
                          .catch(console.error)
                        }
                      }}
                      onChange={(e) => {
                        const newBlocks = [...screenplayBlocks]
                        newBlocks[idx].content = e.target.value
                        setScreenplayBlocks(newBlocks)
                      }}
                      className={cn("w-full resize-none border-none bg-transparent p-0 focus:outline-none focus:ring-0", textAlignment, fontWeight)}
                      rows={Math.max(1, block.content.split('\n').length)}
                      style={{ overflow: 'hidden' }}
                    />
                    <div className="absolute -left-10 top-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">
                        {idx + 1}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            
            {isRecording && (
              <div className="mt-12 border-l-4 border-destructive pl-4 text-muted-foreground italic">
                Listening to microphone...
              </div>
            )}
          </div>
        </div>
      </section>

      {/* RIGHT PANEL: AI Assistant & Sync */}
      <aside className="flex w-64 flex-col bg-muted/10 md:w-80">
        <div className="flex h-12 shrink-0 items-center border-b border-border px-4">
          <h2 className="text-sm font-medium">Live Transcript & AI</h2>
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {transcript.length === 0 && (
              <div className="text-center text-sm text-muted-foreground pt-10">
                Speak into the microphone...
              </div>
            )}
            {transcript.map(t => (
              <div key={t.id} className="rounded-lg border border-border bg-card p-3 shadow-sm transition-all animate-in slide-in-from-right-2">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Raw Transcript</span>
                  <CheckCircle2 size={14} className="text-green-500" />
                </div>
                <p className="text-sm">{t.text}</p>
              </div>
            ))}
            
            {isRecording && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-primary">Listening...</span>
                  <Loader2 size={14} className="text-primary animate-spin" />
                </div>
                {interimText && <p className="text-sm text-muted-foreground italic">{interimText}</p>}
              </div>
            )}
          </div>
          
          <div className="shrink-0 border-t border-border p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Sync Status</h3>
            {project.google_doc_id ? (
              <div className="flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 size={16} />
                Synced to Google Docs
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                <AlertCircle size={16} className="text-yellow-500" />
                Google Docs not connected
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* AI Dictionary Modal */}
      {showDictionaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="font-semibold flex items-center gap-2"><Book size={18} className="text-primary" /> My AI Dictionary</h3>
              <button onClick={() => setShowDictionaryModal(false)} className="rounded p-1 hover:bg-muted"><X size={18} /></button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {aiDictionary.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 italic">
                  Your dictionary is empty.<br/>Correct the AI's mistakes in the editor to teach it your handwriting!
                </div>
              ) : (
                <ul className="space-y-3">
                  {aiDictionary.map((entry: any, i: number) => (
                    <li key={i} className="flex items-center justify-between bg-muted/30 p-3 rounded border border-border group/dict">
                      <div className="flex flex-col text-sm">
                        <span className="text-destructive line-through opacity-70 text-xs">{entry.misread}</span>
                        <span className="font-medium text-primary">{entry.corrected}</span>
                      </div>
                      <button 
                        onClick={() => {
                          fetch('/api/ai/learn', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ misread: entry.misread })
                          }).then(res => res.json()).then(data => {
                            if (data.aiGlossary) setAiDictionary(data.aiGlossary)
                          })
                        }}
                        className="text-muted-foreground hover:text-destructive p-2 opacity-0 group-hover/dict:opacity-100 transition-opacity"
                        title="Delete learned word"
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
