import React from 'react'

interface AuthErrorProps {
  message?: string
  className?: string
}

export function AuthError({ message, className = '' }: AuthErrorProps) {
  if (!message) return null

  return (
    <div
      className={`p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 items-start ${className}`}
      role="alert"
    >
      <div className="text-red-600 mt-0.5">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-red-800">{message}</p>
      </div>
    </div>
  )
}
