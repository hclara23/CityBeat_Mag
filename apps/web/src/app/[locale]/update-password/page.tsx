'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@citybeat/ui'
import { Button } from '@citybeat/ui'
import { AuthError } from '@citybeat/ui/auth'
import { updatePassword } from '@citybeat/lib/supabase/auth'
import Link from 'next/link'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!password) {
      setError('Password is required')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)
    try {
      const result = await updatePassword(password)
      if (result.error) {
        setError(result.error)
      } else {
        // Redirect to login after successful password update
        router.push('/login')
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">Update Password</h1>
          <p className="text-gray-600 text-center mb-8">
            Enter your new password
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <AuthError message={error} />}

            <Input
              type="password"
              label="New Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="new-password"
            />

            <Input
              type="password"
              label="Confirm Password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="new-password"
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
