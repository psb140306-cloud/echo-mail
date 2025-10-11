/**
 * 권한 기반 UI 컴포넌트
 * 사용자 권한에 따라 UI 요소를 조건부로 렌더링
 */

'use client'

import { useRBAC, Can, RoleGate, MinRole } from '@/lib/auth/hooks/use-rbac'
import { Permission, TenantUserRole } from '@/lib/auth/rbac'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Lock } from 'lucide-react'

// 권한 부족 알림 컴포넌트
export function NoPermissionAlert({
  message = '이 작업을 수행할 권한이 없습니다.',
}: {
  message?: string
}) {
  return (
    <Alert variant="destructive">
      <Lock className="h-4 w-4" />
      <AlertTitle>권한 없음</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

// 권한 체크 래퍼 컴포넌트
interface PermissionGuardProps {
  permission?: Permission
  permissions?: Permission[]
  requireAll?: boolean
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function PermissionGuard({
  permission,
  permissions = [],
  requireAll = false,
  fallback = <NoPermissionAlert />,
  children,
}: PermissionGuardProps) {
  return (
    <Can permission={permission} permissions={permissions} all={requireAll} fallback={fallback}>
      {children}
    </Can>
  )
}

// 역할 체크 래퍼 컴포넌트
interface RoleGuardProps {
  allowedRoles: TenantUserRole[]
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function RoleGuard({
  allowedRoles,
  fallback = <NoPermissionAlert message="이 페이지에 접근할 권한이 없습니다." />,
  children,
}: RoleGuardProps) {
  return (
    <RoleGate allowedRoles={allowedRoles} fallback={fallback}>
      {children}
    </RoleGate>
  )
}

// 최소 역할 체크 래퍼 컴포넌트
interface MinRoleGuardProps {
  minRole: TenantUserRole
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function MinRoleGuard({
  minRole,
  fallback = <NoPermissionAlert message="더 높은 권한이 필요합니다." />,
  children,
}: MinRoleGuardProps) {
  return (
    <MinRole minRole={minRole} fallback={fallback}>
      {children}
    </MinRole>
  )
}

// 권한에 따른 버튼 비활성화 컴포넌트
interface PermissionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  permission: Permission
  children: React.ReactNode
}

export function PermissionButton({
  permission,
  children,
  disabled,
  ...props
}: PermissionButtonProps) {
  const { can } = useRBAC()
  const hasPermission = can(permission)

  return (
    <button
      disabled={!hasPermission || disabled}
      title={!hasPermission ? '권한이 없습니다' : undefined}
      {...props}
    >
      {children}
    </button>
  )
}

// 권한 정보 표시 컴포넌트
export function PermissionInfo() {
  const { role, loading } = useRBAC()

  if (loading) {
    return <span className="text-sm text-gray-500">권한 확인 중...</span>
  }

  if (!role) {
    return null
  }

  return (
    <div className="text-sm text-gray-600">
      현재 역할: <span className="font-medium">{role}</span>
    </div>
  )
}
