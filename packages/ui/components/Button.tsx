import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  asChild?: boolean
  children: React.ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  asChild = false,
  children,
  ...props
}: ButtonProps) {
  const baseStyles = 'font-semibold rounded-md transition-colors inline-flex items-center justify-center uppercase tracking-wider'

  const variantStyles = {
    primary: 'bg-brand-neon text-black hover:bg-cyan-300 shadow-[0_0_18px_rgba(0,240,255,0.24)]',
    secondary: 'border border-white/20 bg-transparent text-white hover:bg-white/10',
    ghost: 'text-white hover:bg-white/10',
  }

  const sizeStyles = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-base',
  }

  const finalClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`

  if (asChild) {
    return React.cloneElement(children as React.ReactElement, {
      className: finalClassName,
      ...props,
    })
  }

  return (
    <button
      className={finalClassName}
      {...props}
    >
      {children}
    </button>
  )
}
