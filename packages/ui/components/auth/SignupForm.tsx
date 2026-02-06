'use client'

import React, { useState } from 'react'
import { Button } from '../Button'
import { Input } from '../Input'
import { AuthError } from './AuthError'

interface SignupFormProps {
  onSubmit: (data: {
    email: string
    password: string
    fullName: string
    companyName?: string
    phoneNumber?: string
    isAdvertiser?: boolean
  }) => Promise<{ error?: string }>
  onSuccess?: () => void
  isLoading?: boolean
  className?: string
  isAdvertiser?: boolean
}

export function SignupForm({
  onSubmit,
  onSuccess,
  isLoading = false,
  className = '',
  isAdvertiser = false,
}: SignupFormProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    companyName: '',
    phoneNumber: '',
    isAdvertiser: isAdvertiser,
  })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.email) {
      errors.email = 'Email is required'
    } else if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      errors.email = 'Please enter a valid email'
    }

    if (!formData.password) {
      errors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }

    if (!formData.fullName) {
      errors.fullName = 'Full name is required'
    }

    if (formData.isAdvertiser && !formData.companyName) {
      errors.companyName = 'Company name is required for advertisers'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) return

    try {
      const result = await onSubmit({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        companyName: formData.companyName || undefined,
        phoneNumber: formData.phoneNumber || undefined,
        isAdvertiser: formData.isAdvertiser,
      })
      if (result.error) {
        setError(result.error)
      } else {
        onSuccess?.()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleChange = (field: string, value: string | boolean) => {
    setFormData({ ...formData, [field]: value })
    if (fieldErrors[field]) {
      setFieldErrors({ ...fieldErrors, [field]: undefined })
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 ${className}`}>
      {error && <AuthError message={error} />}

      <Input
        type="email"
        label="Email Address"
        placeholder="you@example.com"
        value={formData.email}
        onChange={(e) => handleChange('email', e.target.value)}
        error={fieldErrors.email}
        disabled={isLoading}
        autoComplete="email"
      />

      <Input
        type="text"
        label="Full Name"
        placeholder="John Doe"
        value={formData.fullName}
        onChange={(e) => handleChange('fullName', e.target.value)}
        error={fieldErrors.fullName}
        disabled={isLoading}
        autoComplete="name"
      />

      {formData.isAdvertiser && (
        <Input
          type="text"
          label="Company Name"
          placeholder="Your Company Inc."
          value={formData.companyName}
          onChange={(e) => handleChange('companyName', e.target.value)}
          error={fieldErrors.companyName}
          disabled={isLoading}
          autoComplete="organization"
        />
      )}

      <Input
        type="tel"
        label="Phone Number (Optional)"
        placeholder="+1 (555) 000-0000"
        value={formData.phoneNumber}
        onChange={(e) => handleChange('phoneNumber', e.target.value)}
        disabled={isLoading}
        autoComplete="tel"
      />

      <Input
        type="password"
        label="Password"
        placeholder="••••••••"
        value={formData.password}
        onChange={(e) => handleChange('password', e.target.value)}
        error={fieldErrors.password}
        disabled={isLoading}
        autoComplete="new-password"
      />

      <Input
        type="password"
        label="Confirm Password"
        placeholder="••••••••"
        value={formData.confirmPassword}
        onChange={(e) => handleChange('confirmPassword', e.target.value)}
        error={fieldErrors.confirmPassword}
        disabled={isLoading}
        autoComplete="new-password"
      />

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isAdvertiser"
          checked={formData.isAdvertiser}
          onChange={(e) => handleChange('isAdvertiser', e.target.checked)}
          disabled={isLoading}
          className="w-4 h-4 text-red-600 rounded focus:ring-red-600"
        />
        <label htmlFor="isAdvertiser" className="text-sm text-gray-700">
          I want to advertise with CityBeat
        </label>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Creating Account...' : 'Create Account'}
      </Button>
    </form>
  )
}
