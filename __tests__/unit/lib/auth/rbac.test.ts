/**
 * RBAC (역할 기반 접근 제어) 시스템 테스트
 * 테넌트별 사용자 역할 및 권한 관리 검증
 */

import {
  TenantUserRole,
  Permission,
  ROLE_PERMISSIONS,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  isHigherRole,
  isEqualOrHigherRole,
  getRoleDisplayName,
  getRoleDescription,
  getAssignableRoles,
} from '@/lib/auth/rbac'

describe('RBAC 권한 시스템', () => {
  describe('역할별 권한 매핑', () => {
    test('OWNER는 모든 권한을 가짐', () => {
      const ownerPermissions = ROLE_PERMISSIONS[TenantUserRole.OWNER]
      const allPermissions = Object.values(Permission)

      expect(ownerPermissions.length).toBe(allPermissions.length)
      allPermissions.forEach((permission) => {
        expect(ownerPermissions).toContain(permission)
      })
    })

    test('ADMIN은 결제와 테넌트 삭제 권한이 없음', () => {
      const adminPermissions = ROLE_PERMISSIONS[TenantUserRole.ADMIN]

      // ADMIN이 가지지 않아야 할 권한
      expect(adminPermissions).not.toContain(Permission.TENANT_DELETE)
      expect(adminPermissions).not.toContain(Permission.BILLING_MANAGE)

      // ADMIN이 가져야 할 권한
      expect(adminPermissions).toContain(Permission.TENANT_SETTINGS)
      expect(adminPermissions).toContain(Permission.USERS_CREATE)
      expect(adminPermissions).toContain(Permission.COMPANIES_CREATE)
      expect(adminPermissions).toContain(Permission.NOTIFICATIONS_SEND)
    })

    test('MANAGER는 업체/담당자 관리와 알림 발송 권한만 가짐', () => {
      const managerPermissions = ROLE_PERMISSIONS[TenantUserRole.MANAGER]

      // MANAGER가 가져야 할 권한
      expect(managerPermissions).toContain(Permission.COMPANIES_CREATE)
      expect(managerPermissions).toContain(Permission.COMPANIES_UPDATE)
      expect(managerPermissions).toContain(Permission.COMPANIES_DELETE)
      expect(managerPermissions).toContain(Permission.COMPANIES_VIEW)
      expect(managerPermissions).toContain(Permission.CONTACTS_CREATE)
      expect(managerPermissions).toContain(Permission.CONTACTS_UPDATE)
      expect(managerPermissions).toContain(Permission.CONTACTS_DELETE)
      expect(managerPermissions).toContain(Permission.CONTACTS_VIEW)
      expect(managerPermissions).toContain(Permission.NOTIFICATIONS_SEND)
      expect(managerPermissions).toContain(Permission.NOTIFICATIONS_VIEW)

      // MANAGER가 가지지 않아야 할 권한
      expect(managerPermissions).not.toContain(Permission.USERS_CREATE)
      expect(managerPermissions).not.toContain(Permission.SYSTEM_SETTINGS)
      expect(managerPermissions).not.toContain(Permission.MAIL_SETTINGS)
    })

    test('OPERATOR는 알림 발송과 조회 권한만 가짐', () => {
      const operatorPermissions = ROLE_PERMISSIONS[TenantUserRole.OPERATOR]

      // OPERATOR가 가져야 할 권한
      expect(operatorPermissions).toContain(Permission.NOTIFICATIONS_SEND)
      expect(operatorPermissions).toContain(Permission.NOTIFICATIONS_VIEW)
      expect(operatorPermissions).toContain(Permission.COMPANIES_VIEW)
      expect(operatorPermissions).toContain(Permission.CONTACTS_VIEW)

      // OPERATOR가 가지지 않아야 할 권한 (수정/삭제 불가)
      expect(operatorPermissions).not.toContain(Permission.COMPANIES_CREATE)
      expect(operatorPermissions).not.toContain(Permission.COMPANIES_UPDATE)
      expect(operatorPermissions).not.toContain(Permission.COMPANIES_DELETE)
      expect(operatorPermissions).not.toContain(Permission.CONTACTS_CREATE)
      expect(operatorPermissions).not.toContain(Permission.CONTACTS_UPDATE)
      expect(operatorPermissions).not.toContain(Permission.CONTACTS_DELETE)
    })

    test('VIEWER는 읽기 권한만 가짐', () => {
      const viewerPermissions = ROLE_PERMISSIONS[TenantUserRole.VIEWER]

      // VIEWER는 모든 VIEW 권한만 가져야 함
      viewerPermissions.forEach((permission) => {
        expect(permission).toContain(':view')
      })

      // VIEWER가 가지지 않아야 할 권한 (생성/수정/삭제/발송 불가)
      expect(viewerPermissions).not.toContain(Permission.COMPANIES_CREATE)
      expect(viewerPermissions).not.toContain(Permission.COMPANIES_UPDATE)
      expect(viewerPermissions).not.toContain(Permission.COMPANIES_DELETE)
      expect(viewerPermissions).not.toContain(Permission.NOTIFICATIONS_SEND)
      expect(viewerPermissions).not.toContain(Permission.SYSTEM_SETTINGS)
    })
  })

  describe('권한 확인 함수', () => {
    describe('hasPermission', () => {
      test('역할이 권한을 가지고 있으면 true 반환', () => {
        expect(hasPermission(TenantUserRole.OWNER, Permission.BILLING_MANAGE)).toBe(true)
        expect(hasPermission(TenantUserRole.ADMIN, Permission.USERS_CREATE)).toBe(true)
        expect(hasPermission(TenantUserRole.MANAGER, Permission.COMPANIES_CREATE)).toBe(true)
        expect(hasPermission(TenantUserRole.OPERATOR, Permission.NOTIFICATIONS_SEND)).toBe(true)
        expect(hasPermission(TenantUserRole.VIEWER, Permission.COMPANIES_VIEW)).toBe(true)
      })

      test('역할이 권한을 가지고 있지 않으면 false 반환', () => {
        expect(hasPermission(TenantUserRole.ADMIN, Permission.BILLING_MANAGE)).toBe(false)
        expect(hasPermission(TenantUserRole.MANAGER, Permission.USERS_CREATE)).toBe(false)
        expect(hasPermission(TenantUserRole.OPERATOR, Permission.COMPANIES_CREATE)).toBe(false)
        expect(hasPermission(TenantUserRole.VIEWER, Permission.NOTIFICATIONS_SEND)).toBe(false)
      })

      test('null 역할은 항상 false 반환', () => {
        expect(hasPermission(null, Permission.COMPANIES_VIEW)).toBe(false)
        expect(hasPermission(null, Permission.BILLING_MANAGE)).toBe(false)
      })
    })

    describe('hasAnyPermission', () => {
      test('여러 권한 중 하나라도 가지고 있으면 true', () => {
        const permissions = [
          Permission.BILLING_MANAGE,
          Permission.USERS_CREATE,
          Permission.COMPANIES_VIEW,
        ]

        expect(hasAnyPermission(TenantUserRole.OWNER, permissions)).toBe(true)
        expect(hasAnyPermission(TenantUserRole.ADMIN, permissions)).toBe(true)
        expect(hasAnyPermission(TenantUserRole.VIEWER, permissions)).toBe(true)
      })

      test('모든 권한을 가지지 않으면 false', () => {
        const permissions = [Permission.BILLING_MANAGE, Permission.TENANT_DELETE]

        expect(hasAnyPermission(TenantUserRole.ADMIN, permissions)).toBe(false)
        expect(hasAnyPermission(TenantUserRole.MANAGER, permissions)).toBe(false)
        expect(hasAnyPermission(TenantUserRole.VIEWER, permissions)).toBe(false)
      })

      test('null 역할은 항상 false', () => {
        const permissions = [Permission.COMPANIES_VIEW]
        expect(hasAnyPermission(null, permissions)).toBe(false)
      })
    })

    describe('hasAllPermissions', () => {
      test('모든 권한을 가지고 있으면 true', () => {
        const permissions = [
          Permission.COMPANIES_CREATE,
          Permission.COMPANIES_UPDATE,
          Permission.COMPANIES_DELETE,
          Permission.COMPANIES_VIEW,
        ]

        expect(hasAllPermissions(TenantUserRole.OWNER, permissions)).toBe(true)
        expect(hasAllPermissions(TenantUserRole.ADMIN, permissions)).toBe(true)
        expect(hasAllPermissions(TenantUserRole.MANAGER, permissions)).toBe(true)
      })

      test('하나라도 권한이 없으면 false', () => {
        const permissions = [
          Permission.COMPANIES_VIEW,
          Permission.COMPANIES_CREATE, // VIEWER는 CREATE 권한 없음
        ]

        expect(hasAllPermissions(TenantUserRole.VIEWER, permissions)).toBe(false)
        expect(hasAllPermissions(TenantUserRole.OPERATOR, permissions)).toBe(false)
      })

      test('null 역할은 항상 false', () => {
        const permissions = [Permission.COMPANIES_VIEW]
        expect(hasAllPermissions(null, permissions)).toBe(false)
      })

      test('빈 배열은 true 반환', () => {
        expect(hasAllPermissions(TenantUserRole.VIEWER, [])).toBe(true)
      })
    })
  })

  describe('역할 계층 확인', () => {
    describe('isHigherRole', () => {
      test('상위 역할 확인', () => {
        expect(isHigherRole(TenantUserRole.OWNER, TenantUserRole.ADMIN)).toBe(true)
        expect(isHigherRole(TenantUserRole.ADMIN, TenantUserRole.MANAGER)).toBe(true)
        expect(isHigherRole(TenantUserRole.MANAGER, TenantUserRole.OPERATOR)).toBe(true)
        expect(isHigherRole(TenantUserRole.OPERATOR, TenantUserRole.VIEWER)).toBe(true)
      })

      test('하위 역할 확인', () => {
        expect(isHigherRole(TenantUserRole.VIEWER, TenantUserRole.OWNER)).toBe(false)
        expect(isHigherRole(TenantUserRole.OPERATOR, TenantUserRole.ADMIN)).toBe(false)
        expect(isHigherRole(TenantUserRole.MANAGER, TenantUserRole.OWNER)).toBe(false)
      })

      test('같은 역할은 false', () => {
        expect(isHigherRole(TenantUserRole.OWNER, TenantUserRole.OWNER)).toBe(false)
        expect(isHigherRole(TenantUserRole.ADMIN, TenantUserRole.ADMIN)).toBe(false)
      })
    })

    describe('isEqualOrHigherRole', () => {
      test('상위 역할 확인', () => {
        expect(isEqualOrHigherRole(TenantUserRole.OWNER, TenantUserRole.ADMIN)).toBe(true)
        expect(isEqualOrHigherRole(TenantUserRole.ADMIN, TenantUserRole.MANAGER)).toBe(true)
      })

      test('같은 역할은 true', () => {
        expect(isEqualOrHigherRole(TenantUserRole.OWNER, TenantUserRole.OWNER)).toBe(true)
        expect(isEqualOrHigherRole(TenantUserRole.ADMIN, TenantUserRole.ADMIN)).toBe(true)
        expect(isEqualOrHigherRole(TenantUserRole.VIEWER, TenantUserRole.VIEWER)).toBe(true)
      })

      test('하위 역할은 false', () => {
        expect(isEqualOrHigherRole(TenantUserRole.VIEWER, TenantUserRole.OWNER)).toBe(false)
        expect(isEqualOrHigherRole(TenantUserRole.MANAGER, TenantUserRole.ADMIN)).toBe(false)
      })
    })
  })

  describe('역할 정보 함수', () => {
    describe('getRoleDisplayName', () => {
      test('역할 한글 이름 반환', () => {
        expect(getRoleDisplayName(TenantUserRole.OWNER)).toBe('소유자')
        expect(getRoleDisplayName(TenantUserRole.ADMIN)).toBe('관리자')
        expect(getRoleDisplayName(TenantUserRole.MANAGER)).toBe('매니저')
        expect(getRoleDisplayName(TenantUserRole.OPERATOR)).toBe('운영자')
        expect(getRoleDisplayName(TenantUserRole.VIEWER)).toBe('뷰어')
      })

      test('정의되지 않은 역할은 원본 반환', () => {
        expect(getRoleDisplayName('UNKNOWN' as TenantUserRole)).toBe('UNKNOWN')
      })
    })

    describe('getRoleDescription', () => {
      test('역할 설명 반환', () => {
        expect(getRoleDescription(TenantUserRole.OWNER)).toContain('모든 권한')
        expect(getRoleDescription(TenantUserRole.ADMIN)).toContain('결제 외')
        expect(getRoleDescription(TenantUserRole.MANAGER)).toContain('업체/담당자')
        expect(getRoleDescription(TenantUserRole.OPERATOR)).toContain('알림 발송')
        expect(getRoleDescription(TenantUserRole.VIEWER)).toContain('읽기 전용')
      })

      test('정의되지 않은 역할은 빈 문자열 반환', () => {
        expect(getRoleDescription('UNKNOWN' as TenantUserRole)).toBe('')
      })
    })

    describe('getAssignableRoles', () => {
      test('OWNER는 모든 역할 할당 가능', () => {
        const assignable = getAssignableRoles(TenantUserRole.OWNER)
        expect(assignable).toEqual(Object.values(TenantUserRole))
        expect(assignable.length).toBe(5)
      })

      test('ADMIN은 OWNER 역할 할당 불가', () => {
        const assignable = getAssignableRoles(TenantUserRole.ADMIN)
        expect(assignable).not.toContain(TenantUserRole.OWNER)
        expect(assignable).toContain(TenantUserRole.ADMIN)
        expect(assignable).toContain(TenantUserRole.MANAGER)
        expect(assignable).toContain(TenantUserRole.OPERATOR)
        expect(assignable).toContain(TenantUserRole.VIEWER)
      })

      test('MANAGER는 하위 역할만 할당 가능', () => {
        const assignable = getAssignableRoles(TenantUserRole.MANAGER)
        expect(assignable).toEqual([TenantUserRole.OPERATOR, TenantUserRole.VIEWER])
        expect(assignable).not.toContain(TenantUserRole.OWNER)
        expect(assignable).not.toContain(TenantUserRole.ADMIN)
        expect(assignable).not.toContain(TenantUserRole.MANAGER)
      })

      test('OPERATOR는 역할 할당 불가', () => {
        const assignable = getAssignableRoles(TenantUserRole.OPERATOR)
        expect(assignable).toEqual([])
        expect(assignable.length).toBe(0)
      })

      test('VIEWER는 역할 할당 불가', () => {
        const assignable = getAssignableRoles(TenantUserRole.VIEWER)
        expect(assignable).toEqual([])
        expect(assignable.length).toBe(0)
      })
    })
  })

  describe('실제 사용 시나리오', () => {
    test('사용자 생성 권한 체크', () => {
      // 사용자 생성 가능한 역할
      expect(hasPermission(TenantUserRole.OWNER, Permission.USERS_CREATE)).toBe(true)
      expect(hasPermission(TenantUserRole.ADMIN, Permission.USERS_CREATE)).toBe(true)

      // 사용자 생성 불가능한 역할
      expect(hasPermission(TenantUserRole.MANAGER, Permission.USERS_CREATE)).toBe(false)
      expect(hasPermission(TenantUserRole.OPERATOR, Permission.USERS_CREATE)).toBe(false)
      expect(hasPermission(TenantUserRole.VIEWER, Permission.USERS_CREATE)).toBe(false)
    })

    test('결제 관리 권한 체크', () => {
      // OWNER만 결제 관리 가능
      expect(hasPermission(TenantUserRole.OWNER, Permission.BILLING_MANAGE)).toBe(true)

      // 다른 모든 역할은 불가
      expect(hasPermission(TenantUserRole.ADMIN, Permission.BILLING_MANAGE)).toBe(false)
      expect(hasPermission(TenantUserRole.MANAGER, Permission.BILLING_MANAGE)).toBe(false)
      expect(hasPermission(TenantUserRole.OPERATOR, Permission.BILLING_MANAGE)).toBe(false)
      expect(hasPermission(TenantUserRole.VIEWER, Permission.BILLING_MANAGE)).toBe(false)
    })

    test('알림 발송 권한 체크', () => {
      // 알림 발송 가능한 역할
      expect(hasPermission(TenantUserRole.OWNER, Permission.NOTIFICATIONS_SEND)).toBe(true)
      expect(hasPermission(TenantUserRole.ADMIN, Permission.NOTIFICATIONS_SEND)).toBe(true)
      expect(hasPermission(TenantUserRole.MANAGER, Permission.NOTIFICATIONS_SEND)).toBe(true)
      expect(hasPermission(TenantUserRole.OPERATOR, Permission.NOTIFICATIONS_SEND)).toBe(true)

      // VIEWER만 불가
      expect(hasPermission(TenantUserRole.VIEWER, Permission.NOTIFICATIONS_SEND)).toBe(false)
    })

    test('복합 권한 체크 - 업체 관리 전체 권한', () => {
      const companyPermissions = [
        Permission.COMPANIES_CREATE,
        Permission.COMPANIES_UPDATE,
        Permission.COMPANIES_DELETE,
        Permission.COMPANIES_VIEW,
      ]

      // 전체 권한을 가진 역할
      expect(hasAllPermissions(TenantUserRole.OWNER, companyPermissions)).toBe(true)
      expect(hasAllPermissions(TenantUserRole.ADMIN, companyPermissions)).toBe(true)
      expect(hasAllPermissions(TenantUserRole.MANAGER, companyPermissions)).toBe(true)

      // 일부 권한만 가진 역할
      expect(hasAllPermissions(TenantUserRole.OPERATOR, companyPermissions)).toBe(false)
      expect(hasAllPermissions(TenantUserRole.VIEWER, companyPermissions)).toBe(false)
    })

    test('역할 변경 권한 체크', () => {
      // ADMIN이 MANAGER 역할 변경 시도
      const canChangeRole = isHigherRole(TenantUserRole.ADMIN, TenantUserRole.MANAGER)
      expect(canChangeRole).toBe(true)

      // MANAGER가 ADMIN 역할 변경 시도 (실패해야 함)
      const cannotChangeRole = isHigherRole(TenantUserRole.MANAGER, TenantUserRole.ADMIN)
      expect(cannotChangeRole).toBe(false)

      // 같은 레벨 역할 변경
      const canChangeEqualRole = isEqualOrHigherRole(TenantUserRole.ADMIN, TenantUserRole.ADMIN)
      expect(canChangeEqualRole).toBe(true)
    })
  })

  describe('보안 검증', () => {
    test('권한 에스컬레이션 방지', () => {
      // VIEWER가 상위 권한 획득 시도
      const viewer = TenantUserRole.VIEWER
      const attemptedPermissions = [
        Permission.USERS_CREATE,
        Permission.BILLING_MANAGE,
        Permission.TENANT_DELETE,
      ]

      attemptedPermissions.forEach((permission) => {
        expect(hasPermission(viewer, permission)).toBe(false)
      })
    })

    test('역할 할당 제한', () => {
      // MANAGER가 OWNER 역할 할당 시도
      const assignableByManager = getAssignableRoles(TenantUserRole.MANAGER)
      expect(assignableByManager).not.toContain(TenantUserRole.OWNER)
      expect(assignableByManager).not.toContain(TenantUserRole.ADMIN)

      // OPERATOR가 역할 할당 시도
      const assignableByOperator = getAssignableRoles(TenantUserRole.OPERATOR)
      expect(assignableByOperator.length).toBe(0)
    })

    test('중요 권한은 상위 역할만 보유', () => {
      const criticalPermissions = [
        Permission.TENANT_DELETE,
        Permission.BILLING_MANAGE,
        Permission.USERS_DELETE,
        Permission.SYSTEM_SETTINGS,
      ]

      // 하위 역할들이 중요 권한을 가지지 않는지 확인
      const lowerRoles = [TenantUserRole.OPERATOR, TenantUserRole.VIEWER]

      lowerRoles.forEach((role) => {
        criticalPermissions.forEach((permission) => {
          expect(hasPermission(role, permission)).toBe(false)
        })
      })
    })
  })
})
