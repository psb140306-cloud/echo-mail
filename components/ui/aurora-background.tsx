'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface AuroraBackgroundProps {
  children: ReactNode
  className?: string
}

export function AuroraBackground({ children, className = '' }: AuroraBackgroundProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Animated Aurora Gradients */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-1/2 -left-1/2 w-[150%] h-[150%] opacity-30"
          animate={{
            background: [
              'radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3), transparent 50%)',
              'radial-gradient(circle at 80% 80%, rgba(120, 119, 198, 0.3), transparent 50%)',
              'radial-gradient(circle at 40% 20%, rgba(120, 119, 198, 0.3), transparent 50%)',
              'radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3), transparent 50%)',
            ],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
        <motion.div
          className="absolute -top-1/2 -right-1/2 w-[150%] h-[150%] opacity-30"
          animate={{
            background: [
              'radial-gradient(circle at 80% 50%, rgba(58, 134, 255, 0.4), transparent 50%)',
              'radial-gradient(circle at 20% 20%, rgba(58, 134, 255, 0.4), transparent 50%)',
              'radial-gradient(circle at 60% 80%, rgba(58, 134, 255, 0.4), transparent 50%)',
              'radial-gradient(circle at 80% 50%, rgba(58, 134, 255, 0.4), transparent 50%)',
            ],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
        <motion.div
          className="absolute -bottom-1/2 -left-1/2 w-[150%] h-[150%] opacity-20"
          animate={{
            background: [
              'radial-gradient(circle at 30% 80%, rgba(99, 102, 241, 0.3), transparent 50%)',
              'radial-gradient(circle at 70% 30%, rgba(99, 102, 241, 0.3), transparent 50%)',
              'radial-gradient(circle at 30% 80%, rgba(99, 102, 241, 0.3), transparent 50%)',
            ],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </div>

      {/* Mesh Grid Overlay */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(rgba(99, 102, 241, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99, 102, 241, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  )
}
