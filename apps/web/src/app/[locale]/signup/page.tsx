'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SignupForm } from '@citybeat/ui/auth'
import { signUp, createUserProfile } from '@citybeat/lib/firebase/auth-client'
import Link from 'next/link'
import { useLocale } from '@/components/TranslationProvider'

const copy = {
  en: {
    title: 'Create Account',
    subtitle: 'Join CityBeat Magazine today',
    message: 'Check your email for a verification link',
    haveAccount: 'Already have an account?',
    signIn: 'Sign in',
  },
  es: {
    title: 'Crear Cuenta',
    subtitle: 'Únete a CityBeat Magazine hoy',
    message: 'Revisa tu correo para el enlace de verificación',
    haveAccount: '¿Ya tienes una cuenta?',
    signIn: 'Iniciar sesión',
  },
}

export default function SignupPage() {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'es'
  const localeCopy = copy[locale]
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  // US CAN-SPAM opt-out: the newsletter box starts checked; the user can uncheck
  // it, and declining never blocks signup.
  const [newsletter, setNewsletter] = useState(true)

  const handleSubmit = async (data: {
    email: string
    password: string
    fullName: string
    companyName?: string
    phoneNumber?: string
    isAdvertiser?: boolean
  }) => {
    setIsLoading(true)
    try {
      // Sign up user
      const result = await signUp(data.email, data.password, {
        fullName: data.fullName,
        companyName: data.companyName,
        phoneNumber: data.phoneNumber,
        isAdvertiser: data.isAdvertiser,
      })

      if (result.error) {
        return { error: result.error }
      }

      // Create user profile
      if (result.user) {
        const profileResult = await createUserProfile(result.user.id, {
          email: data.email,
          fullName: data.fullName,
          companyName: data.companyName,
          phoneNumber: data.phoneNumber,
          isAdvertiser: data.isAdvertiser,
        })

        if (profileResult.error) {
          return { error: profileResult.error }
        }
      }

      // Promotional newsletter consent (best-effort; never blocks signup).
      if (newsletter) {
        fetch('/api/newsletter/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.email, locale, source: 'signup' }),
        }).catch(() => {})
      }

      setMessage(result.message || localeCopy.message)
      // Redirect to login after a delay
      setTimeout(() => {
        router.push(`/${locale}/login`)
      }, 3000)

      return {}
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'An error occurred' }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">{localeCopy.title}</h1>
          <p className="text-gray-600 text-center mb-8">
            {localeCopy.subtitle}
          </p>

          {message && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">{message}</p>
            </div>
          )}

          <SignupForm onSubmit={handleSubmit} isLoading={isLoading} />

          <label className="mt-4 flex items-start gap-2.5 cursor-pointer text-sm text-gray-600">
            <input
              type="checkbox"
              checked={newsletter}
              onChange={(e) => setNewsletter(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-cyan-600"
            />
            <span>
              {locale === 'es'
                ? 'Envíenme el boletín de CityBeat con historias, eventos y ofertas locales. Puedo cancelar la suscripción en cualquier momento.'
                : 'Email me the CityBeat newsletter with local stories, events, and offers. I can unsubscribe at any time.'}
            </span>
          </label>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              {localeCopy.haveAccount}{' '}
              <Link href={`/${locale}/login`} className="text-red-600 hover:text-red-700 font-semibold">
                {localeCopy.signIn}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
