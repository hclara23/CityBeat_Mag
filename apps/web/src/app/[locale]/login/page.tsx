'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoginForm } from '@citybeat/ui/auth'
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

const LOGIN_TIMEOUT_MS = 45000

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function destFor(profile: any, redirectTo: string | null) {
  if (redirectTo && redirectTo.startsWith('/')) return redirectTo
  if (profile?.is_editor) return '/admin'
  if (profile?.is_writer) return '/creator'
  return '/dashboard'
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = useLocale() as 'en' | 'es'
  const localeCopy = copy[locale]
  const [isLoading, setIsLoading] = useState(false)
  const redirectTo = searchParams.get('redirectTo')

  // 2FA challenge state
  const [mfaToken, setMfaToken] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaError, setMfaError] = useState('')
  // Unverified-email state
  const [unverifiedEmail, setUnverifiedEmail] = useState('')
  const [resendNote, setResendNote] = useState('')

  const go = (profile: any) => {
    router.replace(`/${locale}${destFor(profile, redirectTo)}`)
    router.refresh()
  }

  const handleSubmit = async (email: string, password: string, rememberMe: boolean) => {
    setIsLoading(true)
    setUnverifiedEmail('')
    try {
      let response: Response
      try {
        response = await fetchWithTimeout('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ email, password, rememberMe }),
        })
      } catch {
        return { error: 'Sign-in timed out. Please try again.' }
      }

      const result = (await response.json()) as any

      if (!response.ok) {
        if (result.email_unverified) setUnverifiedEmail(email.trim().toLowerCase())
        return { error: result.error || 'Unable to sign in' }
      }

      if (result.mfa_required) {
        setMfaToken(result.mfa_token)
        return {}
      }

      go(result.profile)
      return {}
    } finally {
      setIsLoading(false)
    }
  }

  const submitMfa = async () => {
    setIsLoading(true)
    setMfaError('')
    try {
      const res = await fetch('/api/auth/login/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ mfa_token: mfaToken, code: mfaCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMfaError(data.error || 'Invalid code')
        if (res.status === 401 && /expired/i.test(data.error || '')) {
          setMfaToken('') // session expired — back to password step
        }
        return
      }
      go(data.profile)
    } catch {
      setMfaError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const resend = async () => {
    setResendNote('')
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: unverifiedEmail }),
      })
      setResendNote('Verification email sent. Check your inbox.')
    } catch {
      setResendNote('Could not send right now. Try again shortly.')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">{localeCopy.title}</h1>
          <p className="text-gray-600 text-center mb-8">{localeCopy.subtitle}</p>

          {mfaToken ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-700 text-center">
                Enter the 6-digit code from your authenticator app.
              </p>
              {mfaError && <p className="text-sm text-red-600 text-center">{mfaError}</p>}
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && mfaCode.length === 6 && submitMfa()}
                placeholder="000000"
                className="w-full text-center tracking-[0.5em] text-2xl font-bold rounded-md border border-gray-300 p-3 text-gray-900 focus:border-red-500 focus:outline-none"
              />
              <button
                onClick={submitMfa}
                disabled={isLoading || mfaCode.length !== 6}
                className="w-full rounded-md bg-red-600 text-white font-semibold py-3 hover:bg-red-700 transition disabled:opacity-50"
              >
                {isLoading ? 'Verifying…' : 'Verify & Sign In'}
              </button>
              <button onClick={() => { setMfaToken(''); setMfaCode(''); setMfaError('') }} className="w-full text-sm text-gray-500 hover:text-gray-700">
                ← Back
              </button>
            </div>
          ) : (
            <>
              <LoginForm onSubmit={handleSubmit} isLoading={isLoading} />

              {unverifiedEmail && (
                <div className="mt-4 p-3 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-800">
                  Your email isn&apos;t verified yet.{' '}
                  <button onClick={resend} className="font-semibold underline">Resend verification email</button>
                  {resendNote && <div className="mt-1 text-amber-700">{resendNote}</div>}
                </div>
              )}

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
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
