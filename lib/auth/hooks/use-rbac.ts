/**
 * RBAC (역할 기반 접근 제어) React Hook
 * 컴포넌트에서 사용자 권한을 체크하고 UI를 조건부로 렌더링
 */

'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { TenantContext } from '@/lib/db'
import {
  TenantUserRole,
  Permission,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  isHigherRole,
  isEqualOrHigherRole,
} from '@/lib/auth/rbac'
import { logger } from '@/lib/utils/logger'

interface UseRBACReturn {
  role: TenantUserRole | null
  loading: boolean
  can: (permission: Permission) => boolean
  canAny: (permissions: Permission[]) => boolean
  canAll: (permissions: Permission[]) => boolean
  isHigherThan: (role: TenantUserRole) => boolean
  isEqualOrHigherThan: (role: TenantUserRole) => boolean
}

export function useRBAC(): UseRBACReturn {
  const { user, loading: authLoading } = useAuth()
  const [role, setRole] = useState<TenantUserRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUserRole() {
      if (!user) {
        setRole(null)
        setLoading(false)
        return
      }

      try {
        const tenantContext = TenantContext.getInstance()
        const tenantId = tenantContext.getTenantId()

        if (!tenantId) {
          // Super Admin 모드 - 최고 권한
          setRole(TenantUserRole.OWNER)
          setLoading(false)
          return
        }

        // 사용자의 테넌트별 역할 조회
        const response = await fetch('/api/auth/user-role')

        if (!response.ok) {
          throw new Error('Failed to fetch user role')
        }

        const data = await response.json()
        setRole((data.role as TenantUserRole) || TenantUserRole.VIEWER)
      } catch (error) {
        logger.error('Failed to fetch user role', { error })
        setRole(TenantUserRole.VIEWER) // 기본값: 최소 권한
      } finally {
        setLoading(false)
      }
    }

    if (!authLoading) {
      fetchUserRole()
    }
  }, [user, authLoading])

  // 권한 체크 함수들
  const can = (permission: Permission): boolean => {
    return hasPermission(role, permission)
  }

  const canAny = (permissions: Permission[]): boolean => {
    return hasAnyPermission(role, permissions)
  }

  const canAll = (permissions: Permission[]): boolean => {
    return hasAllPermissions(role, permissions)
  }

  const isHigherThan = (targetRole: TenantUserRole): boolean => {
    if (!role) return false
    return isHigherRole(role, targetRole)
  }

  const isEqualOrHigherThan = (targetRole: TenantUserRole): boolean => {
    if (!role) return false
    return isEqualOrHigherRole(role, targetRole)
  }

  return {
    role,
    loading: loading || authLoading,
    can,
    canAny,
    canAll,
    isHigherThan,
    isEqualOrHigherThan,
  }
}

// 권한 기반 조건부 렌더링 컴포넌트
interface CanProps {
  permission?: Permission
  permissions?: Permission[]
  any?: boolean // permissions 중 하나라도 있으면 true
  all?: boolean // permissions 모두 있어야 true
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function Can({
  permission,
  permissions = [],
  any = true,
  all = false,
  fallback = null,
  children,
}: CanProps) {
  const { can, canAny, canAll } = useRBAC()

  let hasAccess = false

  if (permission) {
    hasAccess = can(permission)
  } else if (permissions.length > 0) {
    if (all) {
      hasAccess = canAll(permissions)
    } else {
      hasAccess = canAny(permissions)
    }
  }

  return hasAccess ? children : fallback
}

// 역할 기반 조건부 렌더링 컴포넌트
interface RoleGateProps {
  allowedRoles: TenantUserRole[]
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function RoleGate({ allowedRoles, fallback = null, children }: RoleGateProps) {
  const { role } = useRBAC()

  const hasAccess = role && allowedRoles.includes(role)

  return hasAccess ? children : fallback
}

// 최소 역할 요구사항 컴포넌트
interface MinRoleProps {
  minRole: TenantUserRole
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function MinRole({ minRole, fallback = null, children }: MinRoleProps) {
  const { isEqualOrHigherThan } = useRBAC()

  const hasAccess = isEqualOrHigherThan(minRole)

  return hasAccess ? children : fallback
}
