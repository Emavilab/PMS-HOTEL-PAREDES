import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = "HNL"): string {
  return new Intl.NumberFormat("es-HN", {
    style: "currency",
    currency,
  }).format(amount)
}

function toHondurasTime(date: string | Date): Date {
  const d = typeof date === "string" ? new Date(date) : date
  // La BD guarda en UTC; Honduras es UTC-6
  return new Date(d.getTime() - 6 * 60 * 60 * 1000)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("es-HN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(toHondurasTime(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("es-HN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(toHondurasTime(date))
}

export function formatDateTimeMinute(date: string | Date): string {
  return new Intl.DateTimeFormat("es-HN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(toHondurasTime(date))
}

export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat("es-HN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(toHondurasTime(date))
}
