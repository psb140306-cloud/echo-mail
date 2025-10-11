'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface KineticTextProps {
  children: ReactNode
  className?: string
  delay?: number
}

export function KineticText({ children, className = '', delay = 0 }: KineticTextProps) {
  // children이 문자열인지 확인
  const text = typeof children === 'string' ? children : String(children)
  const words = text.split(' ')

  const container = {
    hidden: { opacity: 0 },
    visible: (i = 1) => ({
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: delay },
    }),
  }

  const child = {
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        damping: 12,
        stiffness: 100,
      },
    },
    hidden: {
      opacity: 0,
      y: 20,
    },
  }

  return (
    <motion.div
      className={className}
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      {words.map((word, index) => (
        <motion.span key={index} variants={child} className="inline-block mr-[0.25em]">
          {word}
        </motion.span>
      ))}
    </motion.div>
  )
}

interface FloatingTextProps {
  children: ReactNode
  className?: string
}

export function FloatingText({ children, className = '' }: FloatingTextProps) {
  return (
    <motion.div
      className={className}
      animate={{
        y: [0, -10, 0],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  )
}

interface GradientTextProps {
  children: ReactNode
  className?: string
  from?: string
  to?: string
}

export function GradientText({
  children,
  className = '',
  from = 'from-blue-600',
  to = 'to-purple-600',
}: GradientTextProps) {
  return (
    <span
      className={`bg-gradient-to-r ${from} ${to} bg-clip-text text-transparent ${className}`}
    >
      {children}
    </span>
  )
}
