"use client"

import { CheckCircle2, X } from "lucide-react"
import { useEffect } from "react"

interface SuccessToastProps {
  message: string
  onClose: () => void
  duration?: number
}

export function SuccessToast({ message, onClose, duration = 3200 }: SuccessToastProps) {
  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(onClose, duration)
    return () => window.clearTimeout(timer)
  }, [message, onClose, duration])

  if (!message) return null

  return (
    <div className="fixed right-4 top-20 z-[60] flex w-[min(380px,calc(100vw-2rem))] items-start gap-3 rounded-lg border border-green-200 bg-white p-4 text-green-700 shadow-lg" role="status" aria-live="polite">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button type="button" onClick={onClose} className="rounded p-1 text-green-600 hover:bg-green-50" aria-label="Cerrar mensaje">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
