"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react"
import { api } from "@/lib/api"
import type { Usuario } from "@/types"

interface AuthContextType {
  user: Usuario | null
  token: string | null
  loading: boolean
  login: (identificador: string, password: string, recordar: boolean) => Promise<Usuario>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    sessionStorage.removeItem("token")
    sessionStorage.removeItem("user")
  }, [])

  useEffect(() => {
    const savedToken = localStorage.getItem("token") || sessionStorage.getItem("token")
    const savedUser = localStorage.getItem("user") || sessionStorage.getItem("user")
    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser)
        if (!parsedUser || typeof parsedUser !== "object") throw new Error("Invalid user data")
        setToken(savedToken)
        setUser(parsedUser)
        api.auth.verificar(savedToken).then((u) => {
          setUser(u)
          const storage = localStorage.getItem("token") ? localStorage : sessionStorage
          storage.setItem("user", JSON.stringify(u))
        }).catch(() => {
          logout()
        }).finally(() => setLoading(false))
      } catch {
        logout()
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }, [logout])

  const login = async (identificador: string, password: string, recordar: boolean) => {
    const result = await api.auth.login(identificador, password)
    const storage = recordar ? localStorage : sessionStorage
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    sessionStorage.removeItem("token")
    sessionStorage.removeItem("user")
    setToken(result.access_token)
    setUser(result.usuario)
    storage.setItem("token", result.access_token)
    storage.setItem("user", JSON.stringify(result.usuario))
    return result.usuario
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
