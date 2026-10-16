"use client"

import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEffect } from "react"

interface ConfirmConfig {
  open: boolean
  onClose: () => void
  title: string
  message: string
  confirmLabel?: string
  variant?: "default" | "destructive"
  action: () => Promise<void>
  loading?: boolean
  helperText?: string
}

export function ConfirmModal({
  open,
  onClose,
  title,
  message,
  confirmLabel = "Confirmar",
  variant = "default",
  action,
  loading = false,
  helperText = "Revisa la información antes de continuar.",
}: ConfirmConfig) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
  }, [open])

  if (!open) return null

  const destructive = variant === "destructive"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-auto",
        )}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-md">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-gray-600">{message}</p>

          {helperText && (
            <p className="mt-2 text-xs text-gray-500">{helperText}</p>
          )}

          <div className="mt-4 flex justify-end gap-2 border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                void action()
              }}
              disabled={loading}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                destructive
                  ? "bg-red-100 text-red-600 border-red-200 hover:bg-red-200"
                  : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
              )}
            >
              {loading ? "Procesando..." : confirmLabel}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}