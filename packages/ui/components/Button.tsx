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
  const baseStyles = 'font-semibold rounded-lg transition-colors inline-flex items-center justify-center'

  const variantStyles = {
    primary: 'bg-red-600 text-white hover:bg-red-700',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
    ghost: 'text-gray-900 hover:bg-gray-100',
  }

  const sizeStyles = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
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
