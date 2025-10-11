'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface BentoGridProps {
  children: ReactNode
  className?: string
}

interface BentoCardProps {
  children: ReactNode
  className?: string
  colSpan?: 1 | 2 | 3
  rowSpan?: 1 | 2
  delay?: number
}

export function BentoGrid({ children, className = '' }: BentoGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 auto-rows-[minmax(200px,auto)]',
        className
      )}
    >
      {children}
    </div>
  )
}

export function BentoCard({
  children,
  className = '',
  colSpan = 1,
  rowSpan = 1,
  delay = 0,
}: BentoCardProps) {
  const colSpanClass = {
    1: 'md:col-span-1',
    2: 'md:col-span-2',
    3: 'md:col-span-3',
  }

  const rowSpanClass = {
    1: 'md:row-span-1',
    2: 'md:row-span-2',
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className={cn(
        'group relative overflow-hidden rounded-3xl border border-gray-200/50 bg-white p-6 md:p-8 transition-all duration-300',
        'dark:border-gray-800/50 dark:bg-gray-900/50',
        'hover:border-gray-300 hover:shadow-2xl',
        'dark:hover:border-gray-700',
        colSpanClass[colSpan],
        rowSpanClass[rowSpan],
        className
      )}
    >
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-purple-500/0 opacity-0 transition-opacity duration-500 group-hover:from-blue-500/10 group-hover:to-purple-500/10 group-hover:opacity-100" />

      {/* Content */}
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  )
}
