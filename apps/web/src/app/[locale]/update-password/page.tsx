'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@citybeat/ui'
import { Button } from '@citybeat/ui'
import { AuthError } from '@citybeat/ui/auth'
import { updatePassword } from '@citybeat/lib/firebase/auth-client'
import Link from 'next/link'
import { useLocale } from '@/components/TranslationProvider'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const locale = useLocale()
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!currentPassword) {
      setError('Please enter your current password')
      return
    }

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
      const result = await updatePassword(password, currentPassword)
      if (result.error) {
        setError(result.error)
      } else {
        // Redirect to login after successful password update
        router.push(`/${locale}/login`)
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

            {/* Proving you know the current password is what makes this a
                decision by the account owner rather than by whoever happens to
                hold a session cookie. */}
            <Input
              type="password"
              label="Current Password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="current-password"
            />

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

            <p className="text-xs text-gray-500">
              Changing your password signs you out on every device, including this one.
            </p>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link href={`/${locale}/login`} className="text-sm text-gray-500 hover:text-gray-700">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
