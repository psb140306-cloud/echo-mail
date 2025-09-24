'use client'

import { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface MobileTableItem {
  id: string
  title: string
  subtitle?: string
  description?: string
  status?: {
    label: string
    variant?: 'default' | 'secondary' | 'destructive' | 'outline'
    className?: string
  }
  metadata?: Array<{
    label: string
    value: string | ReactNode
    icon?: ReactNode
  }>
  actions?: ReactNode
  onClick?: () => void
  className?: string
}

interface MobileTableProps {
  items: MobileTableItem[]
  loading?: boolean
  emptyMessage?: string
  className?: string
}

export function MobileTable({
  items,
  loading,
  emptyMessage = '데이터가 없습니다.',
  className
}: MobileTableProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-muted-foreground">
            {emptyMessage}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {items.map((item) => (
        <Card
          key={item.id}
          className={cn(
            'transition-colors',
            item.onClick && 'cursor-pointer hover:bg-accent',
            item.className
          )}
          onClick={item.onClick}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm leading-none mb-1 truncate">
                  {item.title}
                </h3>
                {item.subtitle && (
                  <p className="text-sm text-muted-foreground truncate">
                    {item.subtitle}
                  </p>
                )}
              </div>
              {item.status && (
                <Badge
                  variant={item.status.variant || 'default'}
                  className={cn('ml-2 shrink-0', item.status.className)}
                >
                  {item.status.label}
                </Badge>
              )}
            </div>

            {item.description && (
              <>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {item.description}
                </p>
                <Separator className="mb-3" />
              </>
            )}

            {item.metadata && item.metadata.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                {item.metadata.map((meta, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    {meta.icon && (
                      <span className="text-muted-foreground shrink-0">
                        {meta.icon}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="text-muted-foreground block">
                        {meta.label}
                      </span>
                      <span className="font-medium block truncate">
                        {meta.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {item.actions && (
              <div className="flex items-center justify-end space-x-2 pt-2">
                {item.actions}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

interface MobileCardListProps {
  children: ReactNode
  className?: string
}

export function MobileCardList({ children, className }: MobileCardListProps) {
  return (
    <div className={cn('space-y-3 md:hidden', className)}>
      {children}
    </div>
  )
}

interface MobileCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  actions?: ReactNode
  className?: string
}

export function MobileCard({
  title,
  subtitle,
  children,
  actions,
  className
}: MobileCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base leading-none">{title}</CardTitle>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center space-x-2">
              {actions}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {children}
      </CardContent>
    </Card>
  )
}