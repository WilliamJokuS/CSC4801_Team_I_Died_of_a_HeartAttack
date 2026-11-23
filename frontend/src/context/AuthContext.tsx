import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/endpoints'
import {
  bindSessionToken,
  getToken,
  setToken,
  setUnauthorizedHandler,
  TOKEN_STORAGE_KEY,
} from '../api/client'
import { isPreviewUser } from '../lib/preview'
import type { AuthUser, RegisterInput, Role } from '../types'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      navigate('/login', { replace: true })
    })
    return () => setUnauthorizedHandler(null)
  }, [navigate])

  // Each (re)load gets a number; a slower, older /me response can't overwrite a newer one.
  const loadSeq = useRef(0)

  /** (Re)establish who is signed in from the token currently in localStorage. */
  const loadSession = useCallback(() => {
    const seq = ++loadSeq.current
    const token = getToken()
    bindSessionToken(token)
    if (!token) {
      setUser(null)
      setIsLoading(false)
      return
    }
    // Loading unmounts every protected page, so no half-edited form survives a user switch.
    setUser(null)
    setIsLoading(true)
    authApi
      .me()
      .then((me) => {
        if (seq === loadSeq.current) setUser(me)
      })
      .catch(() => {
        if (seq === loadSeq.current) setUser(null)
      })
      .finally(() => {
        if (seq === loadSeq.current) setIsLoading(false)
      })
  }, [])

  useEffect(() => {
    loadSession()
    return () => bindSessionToken(undefined)
  }, [loadSession])

  // Another tab logged out, or logged in as someone else (localStorage is shared, and the
  // 'storage' event only fires in the *other* tabs). Drop this tab's user immediately.
  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      // key === null means localStorage.clear()
      if (event.key !== null && event.key !== TOKEN_STORAGE_KEY) {
        return
      }
      loadSeq.current += 1 // ignore any /me still in flight for the old session
      if (!getToken()) {
        bindSessionToken(null)
        setUser(null)
        setIsLoading(false)
        navigate('/login', { replace: true })
        return
      }
      loadSession()
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [loadSession, navigate])

  async function login(email: string, password: string) {
    const result = await authApi.login({ email, password })
    loadSeq.current += 1 // a stale /me from before this login must not replace the new user
    setUser(result.user)
  }

  async function register(input: RegisterInput) {
    const result = await authApi.register(input)
    loadSeq.current += 1
    setUser(result.user)
  }

  // Always ends the local session, even if the server call fails, so private data (e.g. the
  // résumé) never stays on screen after the user clicked "Log out".
  async function logout() {
    try {
      if (!isPreviewUser(user?.id)) {
        await authApi.logout()
      }
    } catch {
      // authApi.logout() already swallows errors; this is a second line of defence.
    } finally {
      loadSeq.current += 1
      setToken(null)
      setUser(null)
    }
  }

  /** Keep the header (avatar initials etc.) in sync after the user edits their own profile. */
  function updateUser(patch: Partial<Pick<AuthUser, 'display_name'>>) {
    setUser((current) => (current ? { ...current, ...patch } : current))
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
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, previewAs, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}
