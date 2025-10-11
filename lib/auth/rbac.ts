/**
 * 역할 기반 접근 제어 (RBAC) 시스템
 * 테넌트별 사용자 역할 및 권한 관리
 */

import { logger } from '@/lib/utils/logger'

// 테넌트 내 사용자 역할
export enum TenantUserRole {
  OWNER = 'OWNER', // 소유자: 결제 관리, 테넌트 삭제 가능
  ADMIN = 'ADMIN', // 관리자: 모든 설정 가능
  MANAGER = 'MANAGER', // 매니저: 업체/담당자 관리
  OPERATOR = 'OPERATOR', // 운영자: 알림 발송만
  VIEWER = 'VIEWER', // 뷰어: 읽기 전용
}

// 권한 종류
export enum Permission {
  // 테넌트 관리
  TENANT_DELETE = 'tenant:delete',
  TENANT_SETTINGS = 'tenant:settings',
  BILLING_MANAGE = 'billing:manage',

  // 사용자 관리
  USERS_CREATE = 'users:create',
  USERS_UPDATE = 'users:update',
  USERS_DELETE = 'users:delete',
  USERS_VIEW = 'users:view',

  // 업체 관리
  COMPANIES_CREATE = 'companies:create',
  COMPANIES_UPDATE = 'companies:update',
  COMPANIES_DELETE = 'companies:delete',
  COMPANIES_VIEW = 'companies:view',

  // 담당자 관리
  CONTACTS_CREATE = 'contacts:create',
  CONTACTS_UPDATE = 'contacts:update',
  CONTACTS_DELETE = 'contacts:delete',
  CONTACTS_VIEW = 'contacts:view',

  // 알림 관리
  NOTIFICATIONS_SEND = 'notifications:send',
  NOTIFICATIONS_VIEW = 'notifications:view',
  NOTIFICATIONS_SETTINGS = 'notifications:settings',

  // 메일 설정
  MAIL_SETTINGS = 'mail:settings',
  MAIL_VIEW = 'mail:view',

  // 시스템 설정
  SYSTEM_SETTINGS = 'system:settings',
  SYSTEM_LOGS_VIEW = 'system:logs:view',
}

// 역할별 권한 매핑
export const ROLE_PERMISSIONS: Record<TenantUserRole, Permission[]> = {
  [TenantUserRole.OWNER]: [
    // 모든 권한
    ...Object.values(Permission),
  ],

  [TenantUserRole.ADMIN]: [
    // 테넌트 삭제와 결제 관리 제외한 모든 권한
    Permission.TENANT_SETTINGS,
    Permission.USERS_CREATE,
    Permission.USERS_UPDATE,
    Permission.USERS_DELETE,
    Permission.USERS_VIEW,
    Permission.COMPANIES_CREATE,
    Permission.COMPANIES_UPDATE,
    Permission.COMPANIES_DELETE,
    Permission.COMPANIES_VIEW,
    Permission.CONTACTS_CREATE,
    Permission.CONTACTS_UPDATE,
    Permission.CONTACTS_DELETE,
    Permission.CONTACTS_VIEW,
    Permission.NOTIFICATIONS_SEND,
    Permission.NOTIFICATIONS_VIEW,
    Permission.NOTIFICATIONS_SETTINGS,
    Permission.MAIL_SETTINGS,
    Permission.MAIL_VIEW,
    Permission.SYSTEM_SETTINGS,
    Permission.SYSTEM_LOGS_VIEW,
  ],

  [TenantUserRole.MANAGER]: [
    // 업체/담당자 관리와 알림 발송
    Permission.COMPANIES_CREATE,
    Permission.COMPANIES_UPDATE,
    Permission.COMPANIES_DELETE,
    Permission.COMPANIES_VIEW,
    Permission.CONTACTS_CREATE,
    Permission.CONTACTS_UPDATE,
    Permission.CONTACTS_DELETE,
    Permission.CONTACTS_VIEW,
    Permission.NOTIFICATIONS_SEND,
    Permission.NOTIFICATIONS_VIEW,
    Permission.MAIL_VIEW,
  ],

  [TenantUserRole.OPERATOR]: [
    // 알림 발송과 조회
    Permission.COMPANIES_VIEW,
    Permission.CONTACTS_VIEW,
    Permission.NOTIFICATIONS_SEND,
    Permission.NOTIFICATIONS_VIEW,
    Permission.MAIL_VIEW,
  ],

  [TenantUserRole.VIEWER]: [
    // 읽기 전용
    Permission.COMPANIES_VIEW,
    Permission.CONTACTS_VIEW,
    Permission.NOTIFICATIONS_VIEW,
    Permission.MAIL_VIEW,
    Permission.USERS_VIEW,
  ],
}

// 사용자가 특정 권한을 가지고 있는지 확인
export function hasPermission(userRole: TenantUserRole | null, permission: Permission): boolean {
  if (!userRole) {
    logger.debug('No user role provided for permission check')
    return false
  }

  const permissions = ROLE_PERMISSIONS[userRole]
  const hasAccess = permissions.includes(permission)

  logger.debug('Permission check', {
    userRole,
    permission,
    hasAccess,
  })

  return hasAccess
}

// 사용자가 여러 권한 중 하나라도 가지고 있는지 확인
export function hasAnyPermission(
  userRole: TenantUserRole | null,
  permissions: Permission[]
): boolean {
  if (!userRole) return false

  return permissions.some((permission) => hasPermission(userRole, permission))
}

// 사용자가 모든 권한을 가지고 있는지 확인
export function hasAllPermissions(
  userRole: TenantUserRole | null,
  permissions: Permission[]
): boolean {
  if (!userRole) return false

  return permissions.every((permission) => hasPermission(userRole, permission))
}

// 역할이 다른 역할보다 높은 권한인지 확인
export function isHigherRole(currentRole: TenantUserRole, targetRole: TenantUserRole): boolean {
  const roleHierarchy = {
    [TenantUserRole.OWNER]: 5,
    [TenantUserRole.ADMIN]: 4,
    [TenantUserRole.MANAGER]: 3,
    [TenantUserRole.OPERATOR]: 2,
    [TenantUserRole.VIEWER]: 1,
  }

  return roleHierarchy[currentRole] > roleHierarchy[targetRole]
}

// 역할이 같거나 높은 권한인지 확인
export function isEqualOrHigherRole(
  currentRole: TenantUserRole,
  targetRole: TenantUserRole
): boolean {
  const roleHierarchy = {
    [TenantUserRole.OWNER]: 5,
    [TenantUserRole.ADMIN]: 4,
    [TenantUserRole.MANAGER]: 3,
    [TenantUserRole.OPERATOR]: 2,
    [TenantUserRole.VIEWER]: 1,
  }

  return roleHierarchy[currentRole] >= roleHierarchy[targetRole]
}

// 역할 이름 한글 변환
export function getRoleDisplayName(role: TenantUserRole): string {
  const roleNames = {
    [TenantUserRole.OWNER]: '소유자',
    [TenantUserRole.ADMIN]: '관리자',
    [TenantUserRole.MANAGER]: '매니저',
    [TenantUserRole.OPERATOR]: '운영자',
    [TenantUserRole.VIEWER]: '뷰어',
  }

  return roleNames[role] || role
}

// 역할 설명
export function getRoleDescription(role: TenantUserRole): string {
  const descriptions = {
    [TenantUserRole.OWNER]: '결제 관리 및 테넌트 삭제 등 모든 권한',
    [TenantUserRole.ADMIN]: '결제 외 모든 설정 및 관리 권한',
    [TenantUserRole.MANAGER]: '업체/담당자 관리 및 알림 발송',
    [TenantUserRole.OPERATOR]: '알림 발송 및 조회만 가능',
    [TenantUserRole.VIEWER]: '데이터 조회만 가능 (읽기 전용)',
  }

  return descriptions[role] || ''
}

// 사용 가능한 역할 목록 (현재 사용자 역할 기준)
export function getAssignableRoles(currentRole: TenantUserRole): TenantUserRole[] {
  // OWNER는 모든 역할 할당 가능
  if (currentRole === TenantUserRole.OWNER) {
    return Object.values(TenantUserRole)
  }

  // ADMIN은 자신보다 낮은 역할만 할당 가능
  if (currentRole === TenantUserRole.ADMIN) {
    return [
      TenantUserRole.ADMIN,
      TenantUserRole.MANAGER,
      TenantUserRole.OPERATOR,
      TenantUserRole.VIEWER,
    ]
  }

  // MANAGER는 OPERATOR와 VIEWER만 할당 가능
  if (currentRole === TenantUserRole.MANAGER) {
    return [TenantUserRole.OPERATOR, TenantUserRole.VIEWER]
  }

  // OPERATOR와 VIEWER는 역할 할당 불가
  return []
}
