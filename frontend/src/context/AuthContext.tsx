import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/endpoints'
import { getToken, setUnauthorizedHandler } from '../api/client'
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

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setIsLoading(false)
      return
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const result = await authApi.login({ email, password })
    setUser(result.user)
  }

  async function register(input: RegisterInput) {
    const result = await authApi.register(input)
    setUser(result.user)
  }

  async function logout() {
    await authApi.logout()
    setUser(null)
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
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, previewAs }}>
      {children}
    </AuthContext.Provider>
  )
}
