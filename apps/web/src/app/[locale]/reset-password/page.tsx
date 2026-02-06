'use client'

import { useState } from 'react'
import { Input } from '@citybeat/ui'
import { Button } from '@citybeat/ui'
import { AuthError } from '@citybeat/ui/auth'
import { resetPassword } from '@citybeat/lib/supabase/auth'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!email) {
      setError('Email is required')
      return
    }

    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError('Please enter a valid email')
      return
    }

    setIsLoading(true)
    try {
      const result = await resetPassword(email)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(result.message || 'Check your email for password reset instructions')
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">Reset Password</h1>
          <p className="text-gray-600 text-center mb-8">
            Enter your email address and we'll send you a link to reset your password
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <AuthError message={error} />}

            {success && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800">{success}</p>
              </div>
            )}

            <Input
              type="email"
              label="Email Address"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Remember your password?{' '}
              <Link href="/login" className="text-red-600 hover:text-red-700 font-semibold">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
