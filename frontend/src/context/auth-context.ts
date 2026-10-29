import { createContext } from 'react'
import type { AuthUser, RegisterInput, Role } from '../types'

export interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
  previewAs: (role: Role) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
