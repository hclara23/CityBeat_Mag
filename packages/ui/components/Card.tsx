import React from 'react'

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-4 border-b border-gray-200 ${className}`}>{children}</div>
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-lg font-bold ${className}`}>{children}</h3>
}

export function CardDescription({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <p className={`text-gray-600 text-sm ${className}`}>{children}</p>
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-4 ${className}`}>{children}</div>
}

export function CardFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-4 border-t border-gray-200 flex gap-2 ${className}`}>{children}</div>
}
