'use client'

import React, { useState } from 'react'
import { Button } from '../Button'
import { Input } from '../Input'
import { AuthError } from './AuthError'

interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<{ error?: string }>
  onSuccess?: () => void
  isLoading?: boolean
  className?: string
}

export function LoginForm({ onSubmit, onSuccess, isLoading = false, className = '' }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

  const validateForm = (): boolean => {
    const errors: typeof fieldErrors = {}

    if (!email) {
      errors.email = 'Email is required'
    } else if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      errors.email = 'Please enter a valid email'
    }

    if (!password) {
      errors.password = 'Password is required'
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) return

    try {
      const result = await onSubmit(email, password)
      if (result.error) {
        setError(result.error)
      } else {
        onSuccess?.()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 ${className}`}>
      {error && <AuthError message={error} />}

      <Input
        type="email"
        label="Email Address"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value)
          if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined })
        }}
        error={fieldErrors.email}
        disabled={isLoading}
        autoComplete="email"
      />

      <div className="relative">
        <Input
          type={showPassword ? 'text' : 'password'}
          label="Password"
          placeholder="Password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined })
          }}
          error={fieldErrors.password}
          disabled={isLoading}
          autoComplete="current-password"
          className="pr-20"
        />
        <button
          type="button"
          className="absolute right-3 top-9 rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide text-brand-neon transition hover:text-white disabled:cursor-not-allowed disabled:text-white/35"
          onClick={() => setShowPassword((value) => !value)}
          aria-pressed={showPassword}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          disabled={isLoading || !password}
        >
          {showPassword ? 'Hide' : 'Show'}
        </button>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign In'}
      </Button>
    </form>
  )
}
