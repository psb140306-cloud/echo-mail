'use client'

import { cn } from '@/lib/utils'

interface ResponsiveGridProps {
  children: React.ReactNode
  className?: string
  cols?: {
    default?: number
    sm?: number
    md?: number
    lg?: number
    xl?: number
  }
  gap?: string
}

export function ResponsiveGrid({
  children,
  className,
  cols = { default: 1, md: 2, lg: 3 },
  gap = 'gap-4'
}: ResponsiveGridProps) {
  const gridClasses = [
    'grid',
    gap,
    cols.default && `grid-cols-${cols.default}`,
    cols.sm && `sm:grid-cols-${cols.sm}`,
    cols.md && `md:grid-cols-${cols.md}`,
    cols.lg && `lg:grid-cols-${cols.lg}`,
    cols.xl && `xl:grid-cols-${cols.xl}`
  ].filter(Boolean).join(' ')

  return (
    <div className={cn(gridClasses, className)}>
      {children}
    </div>
  )
}

interface ResponsiveContainerProps {
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

export function ResponsiveContainer({
  children,
  className,
  size = 'xl'
}: ResponsiveContainerProps) {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-7xl',
    full: 'max-w-full'
  }

  return (
    <div className={cn(
      'mx-auto w-full px-4 sm:px-6 lg:px-8',
      sizeClasses[size],
      className
    )}>
      {children}
    </div>
  )
}

interface ResponsiveStackProps {
  children: React.ReactNode
  className?: string
  direction?: 'vertical' | 'horizontal'
  breakpoint?: 'sm' | 'md' | 'lg'
  gap?: string
}

export function ResponsiveStack({
  children,
  className,
  direction = 'vertical',
  breakpoint = 'md',
  gap = 'gap-4'
}: ResponsiveStackProps) {
  const stackClasses = [
    'flex',
    gap,
    direction === 'vertical' ? 'flex-col' : 'flex-row',
    breakpoint === 'sm' && direction === 'vertical' ? 'sm:flex-row' : '',
    breakpoint === 'md' && direction === 'vertical' ? 'md:flex-row' : '',
    breakpoint === 'lg' && direction === 'vertical' ? 'lg:flex-row' : '',
    breakpoint === 'sm' && direction === 'horizontal' ? 'sm:flex-col' : '',
    breakpoint === 'md' && direction === 'horizontal' ? 'md:flex-col' : '',
    breakpoint === 'lg' && direction === 'horizontal' ? 'lg:flex-col' : ''
  ].filter(Boolean).join(' ')

  return (
    <div className={cn(stackClasses, className)}>
      {children}
    </div>
  )
}