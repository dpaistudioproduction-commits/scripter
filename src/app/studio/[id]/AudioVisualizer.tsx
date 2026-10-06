'use client'

import { useEffect, useRef, useState } from 'react'

interface AudioVisualizerProps {
  stream: MediaStream | null
}

export default function AudioVisualizer({ stream }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const requestRef = useRef<number>(0)
  const [seconds, setSeconds] = useState(0)

  // Timer effect
  useEffect(() => {
    if (!stream) return
    const interval = setInterval(() => {
      setSeconds(s => s + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [stream])

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
    const s = (totalSeconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  useEffect(() => {
    if (!stream || !canvasRef.current) return

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const analyser = audioContext.createAnalyser()
    const source = audioContext.createMediaStreamSource(stream)
    
    source.connect(analyser)
    analyser.fftSize = 64 // Use a smaller FFT size for fewer, thicker bars
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const canvas = canvasRef.current
    const canvasCtx = canvas.getContext('2d')
    if (!canvasCtx) return

    const draw = () => {
      requestRef.current = requestAnimationFrame(draw)
      
      analyser.getByteFrequencyData(dataArray)
      
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height)
      
      // We will only draw the first half of the frequencies as voice doesn't hit the highest registers much
      const renderLength = Math.floor(bufferLength * 0.7)
      const barWidth = (canvas.width / renderLength) - 2
      let x = 0
      
      for (let i = 0; i < renderLength; i++) {
        // Smooth out the height and ensure a minimum height of 2px
        const normalizedHeight = dataArray[i] / 255
        const barHeight = Math.max(normalizedHeight * canvas.height, 2)
        
        // Draw rounded pill shape (simplification via rects/arcs)
        const y = (canvas.height - barHeight) / 2 // Center vertically
        
        canvasCtx.fillStyle = 'rgba(239, 68, 68, 0.8)' // Tailwind destructive/red-500
        canvasCtx.beginPath()
        canvasCtx.roundRect(x, y, barWidth, barHeight, 4)
        canvasCtx.fill()
        
        x += barWidth + 2
      }
    }

    draw()

    return () => {
      cancelAnimationFrame(requestRef.current)
      source.disconnect()
      analyser.disconnect()
      audioContext.close().catch(() => {})
    }
  }, [stream])

  if (!stream) return null

  return (
    <div className="flex w-full flex-col items-center justify-center gap-2 rounded-md bg-destructive/10 p-4">
      <div className="flex w-full items-center justify-between text-xs font-semibold text-destructive uppercase tracking-wider">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
          Recording Live
        </span>
        <span className="tabular-nums">{formatTime(seconds)}</span>
      </div>
      <canvas 
        ref={canvasRef} 
        width={300} 
        height={40} 
        className="h-10 w-full"
      />
    </div>
  )
}
