import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-sm font-medium text-white/75">{label}</label>}
      <input
        className={`px-4 py-2 border border-white/15 rounded-md bg-black/40 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-brand-neon focus:border-transparent ${
          error ? 'border-red-500' : ''
        } ${className}`}
        {...props}
      />
      {error && <span className="text-sm text-red-400">{error}</span>}
    </div>
  )
}
