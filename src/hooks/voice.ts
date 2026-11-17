import { useEffect, useRef, useState } from 'react'

interface RecognitionResultEvent {
  resultIndex: number
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
}

interface Recognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: RecognitionResultEvent) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  start(): void
  stop(): void
}

type RecognitionCtor = new () => Recognition

function getCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const voiceSupported = () => getCtor() !== null

export type VoiceCommand = 'next' | 'back' | 'start' | 'stop'

const COMMANDS: [RegExp, VoiceCommand][] = [
  [/\b(next|plus|add|up|forward|done)\b/, 'next'],
  [/\b(back|minus|undo|down|previous|subtract)\b/, 'back'],
  [/\b(start|resume)\b/, 'start'],
  [/\b(stop|pause)\b/, 'stop'],
]

export function parseVoiceCommand(transcript: string): VoiceCommand | null {
  const t = transcript.toLowerCase()
  for (const [re, cmd] of COMMANDS) if (re.test(t)) return cmd
  return null
}

/**
 * Hands-free control. Say "next" / "plus" to count a row, "back" / "minus" to
 * undo, "start" / "stop" for the timer.
 */
export function useVoiceControl(enabled: boolean, onCommand: (c: VoiceCommand, heard: string) => void) {
  const cb = useRef(onCommand)
  cb.current = onCommand
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    const Ctor = getCtor()
    if (!Ctor) {
      setError('Voice control is not supported in this browser.')
      return
    }
    setError(null)
    let active = true
    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = false
    rec.lang = navigator.language || 'en-US'
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (!r.isFinal) continue
        const heard = r[0].transcript
        const cmd = parseVoiceCommand(heard)
        if (cmd) cb.current(cmd, heard)
      }
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        active = false
        setError('Microphone permission was denied.')
      }
    }
    // Browsers end recognition after silence; restart while enabled.
    rec.onend = () => {
      if (active) {
        try {
          rec.start()
        } catch {
          /* already started */
        }
      }
    }
    try {
      rec.start()
    } catch {
      /* ignore */
    }
    return () => {
      active = false
      rec.onend = null
      rec.stop()
    }
  }, [enabled])

  return error
}
