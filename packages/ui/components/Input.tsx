import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', id, ...props }: InputProps) {
  // Programmatically associate the label, and (when present) the error, with the
  // field so screen readers announce the name, invalid state, and the message
  // (WCAG 1.3.1 / 3.3.1 / 4.1.2). A stable generated id is used when the caller
  // doesn't pass one.
  const reactId = React.useId()
  const inputId = id || `input-${reactId}`
  const errorId = `${inputId}-error`
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-white/75">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`px-4 py-2 border border-white/15 rounded-md bg-black/40 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-brand-neon focus:border-transparent ${
          error ? 'border-red-500' : ''
        } ${className}`}
        {...props}
      />
      {error && (
        <span id={errorId} role="alert" className="text-sm text-red-400">
          {error}
        </span>
      )}
    </div>
  )
}
