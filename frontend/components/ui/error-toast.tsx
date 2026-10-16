"use client"

import { AlertTriangle, X } from "lucide-react"
import { useEffect } from "react"

interface ErrorToastProps {
  message: string
  onClose: () => void
  duration?: number
}

export function ErrorToast({ message, onClose, duration = 4000 }: ErrorToastProps) {
  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(onClose, duration)
    return () => window.clearTimeout(timer)
  }, [message, onClose, duration])

  if (!message) return null

  return (
    <div className="fixed right-4 top-20 z-[60] w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-red-200 bg-white text-red-700 shadow-lg" role="alert" aria-live="assertive">
      <div className="flex items-start gap-3 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="flex-1 text-sm font-medium">{message}</p>
        <button type="button" onClick={onClose} className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-red-200 text-red-600 hover:bg-red-50" aria-label="Cerrar mensaje de error">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="h-1 bg-red-100" aria-hidden="true">
        <div className="h-full origin-left bg-red-500" style={{ animation: `error-toast-progress ${duration}ms linear forwards` }} />
      </div>
      <style jsx>{`
        @keyframes error-toast-progress {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `}</style>
    </div>
  )
}
