import { useEffect, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/endpoints'
import { getSessionVersion, getToken, refreshStoredToken, setToken, setUnauthorizedHandler, TOKEN_KEY } from '../api/client'
import type { AuthUser, RegisterInput, Role } from '../types'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      setIsLoading(false)
      navigate('/login', { replace: true })
    })
    return () => setUnauthorizedHandler(null)
  }, [navigate])

  useEffect(() => {
    let active = true

    async function validateSession() {
      const token = getToken()
      const version = getSessionVersion()
      setUser(null)
      setIsLoading(Boolean(token))
      if (!token) return

      try {
        const currentUser = await authApi.me()
        if (active && getSessionVersion() === version) setUser(currentUser)
      } catch {
        // The protected UI remains cleared until a session can be validated.
      } finally {
        if (active && getSessionVersion() === version) setIsLoading(false)
      }
    }

    function onStorage(event: StorageEvent) {
      if (event.key !== TOKEN_KEY && event.key !== null) return
      // Commit the loading view before the next input event can use the new token.
      flushSync(() => {
        if (refreshStoredToken()) void validateSession()
      })
    }

    window.addEventListener('storage', onStorage)
    refreshStoredToken()
    void validateSession()
    return () => {
      active = false
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  async function login(email: string, password: string) {
    const result = await authApi.login({ email, password })
    setToken(result.token)
    setUser(result.user)
    setIsLoading(false)
  }

  async function register(input: RegisterInput) {
    const result = await authApi.register(input)
    setToken(result.token)
    setUser(result.user)
    setIsLoading(false)
  }

  async function logout() {
    if (getToken()) void authApi.logout().catch(() => {})
    setToken(null)
    setUser(null)
    setIsLoading(false)
  }

  function updateUser(patch: Partial<Pick<AuthUser, 'display_name'>>) {
    setUser((current) => current && current.id === user?.id && patch.display_name !== undefined && current.display_name !== patch.display_name
      ? { ...current, display_name: patch.display_name }
      : current)
  }

  function previewAs(role: Role) {
    setUser({
      id: 'preview-user',
      email: `preview-${role.toLowerCase()}@example.com`,
      display_name: role === 'Candidate' ? 'Preview Candidate' : 'Preview Employer',
      role,
      created_at: new Date().toISOString(),
    })
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, sessionVersion: getSessionVersion(), login, register, logout, previewAs, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}
