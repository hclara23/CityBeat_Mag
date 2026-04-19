'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoginForm } from '@citybeat/ui/auth'
import { signIn } from '@citybeat/lib/supabase/auth'
import Link from 'next/link'
import { useLocale } from '@/components/TranslationProvider'

const copy = {
  en: {
    title: 'Sign In',
    subtitle: 'Welcome back to CityBeat Magazine',
    noAccount: 'Do not have an account?',
    signUp: 'Sign up',
    forgotPassword: 'Forgot your password?',
  },
  es: {
    title: 'Iniciar Sesión',
    subtitle: 'Bienvenido de nuevo a CityBeat Magazine',
    noAccount: '¿No tienes una cuenta?',
    signUp: 'Regístrate',
    forgotPassword: '¿Olvidaste tu contraseña?',
  },
}

export default function LoginPage() {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'es'
  const localeCopy = copy[locale]
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const result = await signIn(email, password)
      if (result.error) {
        return { error: result.error }
      }
      // Redirect to dashboard on successful login
      router.push(`/${locale}/dashboard`)
      return {}
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'An error occurred' }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">{localeCopy.title}</h1>
          <p className="text-gray-600 text-center mb-8">
            {localeCopy.subtitle}
          </p>

          <LoginForm onSubmit={handleSubmit} isLoading={isLoading} />

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              {localeCopy.noAccount}{' '}
              <Link href={`/${locale}/signup`} className="text-red-600 hover:text-red-700 font-semibold">
                {localeCopy.signUp}
              </Link>
            </p>
          </div>

          <div className="mt-4 text-center">
            <Link href={`/${locale}/reset-password`} className="text-sm text-gray-500 hover:text-gray-700">
              {localeCopy.forgotPassword}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
