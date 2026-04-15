'use client'

import { useState } from 'react'
import { Input } from '@citybeat/ui'
import { Button } from '@citybeat/ui'
import { AuthError } from '@citybeat/ui/auth'
import { resetPassword } from '@citybeat/lib/supabase/auth'
import Link from 'next/link'
import { useLocale } from '@/components/TranslationProvider'

const copy = {
  en: {
    title: 'Reset Password',
    subtitle: 'Enter your email address and we will send you a link to reset your password',
    emailRequired: 'Email is required',
    invalidEmail: 'Please enter a valid email',
    success: 'Check your email for password reset instructions',
    label: 'Email Address',
    placeholder: 'you@example.com',
    submitting: 'Sending...',
    submit: 'Send Reset Link',
    rememberPassword: 'Remember your password?',
    signIn: 'Sign in',
  },
  es: {
    title: 'Restablecer Contraseña',
    subtitle: 'Ingresa tu dirección de correo y te enviaremos un enlace para restablecer tu contraseña',
    emailRequired: 'El correo electrónico es requerido',
    invalidEmail: 'Por favor ingresa un correo válido',
    success: 'Revisa tu correo para las instrucciones de restablecimiento de contraseña',
    label: 'Correo Electrónico',
    placeholder: 'tú@ejemplo.com',
    submitting: 'Enviando...',
    submit: 'Enviar enlace',
    rememberPassword: '¿Recuerdas tu contraseña?',
    signIn: 'Iniciar sesión',
  },
}

export default function ResetPasswordPage() {
  const locale = useLocale() as 'en' | 'es'
  const localeCopy = copy[locale]
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!email) {
      setError(localeCopy.emailRequired)
      return
    }

    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError(localeCopy.invalidEmail)
      return
    }

    setIsLoading(true)
    try {
      const result = await resetPassword(email)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(result.message || localeCopy.success)
        setEmail('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">{localeCopy.title}</h1>
          <p className="text-gray-600 text-center mb-8">{localeCopy.subtitle}</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <AuthError message={error} />}

            {success && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800">{success}</p>
              </div>
            )}

            <Input
              type="email"
              label={localeCopy.label}
              placeholder={localeCopy.placeholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? localeCopy.submitting : localeCopy.submit}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              {localeCopy.rememberPassword}{' '}
              <Link href="/login" className="text-red-600 hover:text-red-700 font-semibold">
                {localeCopy.signIn}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
