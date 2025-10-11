'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GlassmorphismCardProps {
  children: ReactNode
  className?: string
  delay?: number
  hover?: boolean
}

export function GlassmorphismCard({
  children,
  className = '',
  delay = 0,
  hover = true,
}: GlassmorphismCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      whileHover={hover ? { y: -5, scale: 1.02 } : {}}
      className={cn(
        'group relative overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-8 backdrop-blur-xl transition-all duration-300',
        'dark:border-white/10 dark:bg-white/5',
        'shadow-[0_8px_32px_0_rgba(31,38,135,0.15)]',
        'hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.25)]',
        className
      )}
    >
      {/* Shine effect on hover */}
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  )
}
