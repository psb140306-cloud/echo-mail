'use client'

import { useEffect, ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { cn } from '@/lib/utils'

interface WordMarkLinkProps {
  children: ReactNode
  className?: string
  ariaLabel?: string
}

export function WordMarkLink({ children, className, ariaLabel = 'Echo Mail 워드마크' }: WordMarkLinkProps) {
  const router = useRouter()
  const { user } = useAuth()
  const target = user ? '/dashboard' : '/'

  useEffect(() => {
    router.prefetch(target)
  }, [router, target])

  return (
    <Link
      href={target}
      aria-label={ariaLabel}
      className={cn(
        'group inline-flex items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
        className
      )}
      data-wordmark
    >
      {children}
    </Link>
  )
}
