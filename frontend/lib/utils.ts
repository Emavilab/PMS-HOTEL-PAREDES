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

const HOTEL_TIME_ZONE = "America/Tegucigalpa"

function parseDateValue(value: string | Date): Date {
  if (value instanceof Date) return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`)
  return new Date(value)
}

function formatInHotelTime(date: string | Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("es-HN", { ...options, timeZone: HOTEL_TIME_ZONE }).format(parseDateValue(date))
}

export function getHotelDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HOTEL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parseDateValue(date))
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function hotelDateTimeToISOString(dateKey: string, time: string): string {
  const [year, month, day] = dateKey.split("-").map(Number)
  const [hour, minute, second = 0] = time.split(":").map(Number)
  return new Date(Date.UTC(year, month - 1, day, hour + 6, minute, second)).toISOString()
}

export function formatDate(date: string | Date): string {
  return formatInHotelTime(date, {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function formatDateTime(date: string | Date): string {
  return formatInHotelTime(date, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

export function formatDateTimeMinute(date: string | Date): string {
  return formatInHotelTime(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export function formatDateShort(date: string | Date): string {
  return formatInHotelTime(date, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}
