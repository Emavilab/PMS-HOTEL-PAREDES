import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-gray-100 text-gray-800",
        success: "bg-green-100 text-green-800",
        warning: "bg-yellow-100 text-yellow-800",
        danger: "bg-red-100 text-red-800",
        info: "bg-blue-100 text-blue-800",
        purple: "bg-purple-100 text-purple-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }

export function statusBadge(status: string) {
  const map: Record<string, { variant: "success" | "warning" | "danger" | "info" | "purple" | "default"; label: string }> = {
    PENDIENTE: { variant: "warning", label: "Reservación sin confirmar" },
    CONFIRMADA: { variant: "info", label: "Reservación confirmada" },
    CHECKED_IN: { variant: "success", label: "Ingreso" },
    CHECKED_OUT: { variant: "default", label: "Hospedaje terminado" },
    CANCELADA: { variant: "danger", label: "Cancelada" },
    NO_SHOW: { variant: "danger", label: "No ingreso" },
    DISPONIBLE: { variant: "success", label: "Disponible" },
    OCUPADA: { variant: "warning", label: "Ocupada" },
    MANTENIMIENTO: { variant: "danger", label: "Mantenimiento" },
    BLOQUEADA: { variant: "purple", label: "Bloqueada" },
    LIMPIA: { variant: "success", label: "Limpia" },
    SUCIA: { variant: "warning", label: "Sucia" },
    EN_PROGRESO: { variant: "info", label: "En Progreso" },
    COMPLETADA: { variant: "success", label: "Completada" },
    INSPECCIONADA: { variant: "purple", label: "Inspeccionada" },
    ABIERTA: { variant: "success", label: "Abierta" },
    CERRADA: { variant: "default", label: "Cerrada" },
    activo: { variant: "success", label: "Activo" },
    inactivo: { variant: "danger", label: "Inactivo" },
  }
  const config = map[status] || { variant: "default" as const, label: status }
  return { variant: config.variant, label: config.label }
}
