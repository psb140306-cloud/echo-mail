/**
 * 비활성 테넌트 정리 자동화
 * - 장기 미사용 테넌트 탐지
 * - 데이터 보관 또는 삭제
 * - 정리 전 알림 및 백업
 */

import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { TenantBackup } from './tenant-backup'
import { SubscriptionStatus } from '@prisma/client'

export interface CleanupResult {
  tenantId: string
  tenantName: string
  status: 'archived' | 'deleted' | 'notified' | 'skipped'
  reason?: string
  inactiveDays?: number
  lastActivityDate?: Date
  backupPath?: string
}

export class InactiveTenantCleanup {
  // 비활성 기준 (일)
  private static readonly INACTIVE_THRESHOLD_DAYS = 90 // 90일
  private static readonly WARNING_DAYS = 75 // 75일 후 경고
  private static readonly ARCHIVE_DAYS = 90 // 90일 후 아카이브
  private static readonly DELETE_DAYS = 180 // 180일 후 삭제

  /**
   * 비활성 테넌트 정리 처리
   */
  static async processInactiveTenants(): Promise<CleanupResult[]> {
    logger.info('비활성 테넌트 정리 시작')

    try {
      const results: CleanupResult[] = []

      // 1. 삭제 대상 테넌트 (180일 이상 미사용)
      const deleteResults = await this.processTenantsForDeletion()
      results.push(...deleteResults)

      // 2. 아카이브 대상 테넌트 (90일 이상 미사용)
      const archiveResults = await this.processTenantsForArchive()
      results.push(...archiveResults)

      // 3. 경고 대상 테넌트 (75일 이상 미사용)
      const warningResults = await this.processTenantsForWarning()
      results.push(...warningResults)

      logger.info('비활성 테넌트 정리 완료', {
        total: results.length,
        deleted: results.filter((r) => r.status === 'deleted').length,
        archived: results.filter((r) => r.status === 'archived').length,
        notified: results.filter((r) => r.status === 'notified').length,
        skipped: results.filter((r) => r.status === 'skipped').length,
      })

      return results
    } catch (error) {
      logger.error('비활성 테넌트 정리 중 오류 발생', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * 삭제 대상 테넌트 처리 (180일 이상)
   */
  private static async processTenantsForDeletion(): Promise<CleanupResult[]> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.DELETE_DAYS)

    logger.info('삭제 대상 테넌트 조회', {
      cutoffDate,
      deleteDays: this.DELETE_DAYS,
    })

    // CANCELLED, UNPAID 상태에서 180일 이상 미사용
    const inactiveTenants = await prisma.tenant.findMany({
      where: {
        subscriptionStatus: {
          in: [SubscriptionStatus.CANCELLED, SubscriptionStatus.UNPAID],
        },
        updatedAt: {
          lt: cutoffDate,
        },
      },
      include: {
        users: {
          where: { isActive: true },
          take: 1,
        },
        subscriptions: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
      take: 20, // 한 번에 최대 20개 처리
    })

    logger.info(`삭제 대상 테넌트 ${inactiveTenants.length}개 발견`)

    const results: CleanupResult[] = []

    for (const tenant of inactiveTenants) {
      try {
        const result = await this.deleteTenant(tenant)
        results.push(result)
      } catch (error) {
        logger.error('테넌트 삭제 실패', {
          tenantId: tenant.id,
          tenantName: tenant.name,
          error: error instanceof Error ? error.message : String(error),
        })

        results.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          status: 'skipped',
          reason: error instanceof Error ? error.message : '삭제 실패',
        })
      }
    }

    return results
  }

  /**
   * 아카이브 대상 테넌트 처리 (90일 이상)
   */
  private static async processTenantsForArchive(): Promise<CleanupResult[]> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.ARCHIVE_DAYS)

    logger.info('아카이브 대상 테넌트 조회', {
      cutoffDate,
      archiveDays: this.ARCHIVE_DAYS,
    })

    // CANCELLED, UNPAID 상태에서 90일 이상 미사용 (180일 미만)
    const deleteThreshold = new Date()
    deleteThreshold.setDate(deleteThreshold.getDate() - this.DELETE_DAYS)

    const inactiveTenants = await prisma.tenant.findMany({
      where: {
        subscriptionStatus: {
          in: [SubscriptionStatus.CANCELLED, SubscriptionStatus.UNPAID],
        },
        updatedAt: {
          lt: cutoffDate,
          gte: deleteThreshold, // 삭제 대상 제외
        },
      },
      include: {
        users: {
          where: { isActive: true },
          take: 1,
        },
      },
      take: 30, // 한 번에 최대 30개 처리
    })

    logger.info(`아카이브 대상 테넌트 ${inactiveTenants.length}개 발견`)

    const results: CleanupResult[] = []

    for (const tenant of inactiveTenants) {
      try {
        const result = await this.archiveTenant(tenant)
        results.push(result)
      } catch (error) {
        logger.error('테넌트 아카이브 실패', {
          tenantId: tenant.id,
          tenantName: tenant.name,
          error: error instanceof Error ? error.message : String(error),
        })

        results.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          status: 'skipped',
          reason: error instanceof Error ? error.message : '아카이브 실패',
        })
      }
    }

    return results
  }

  /**
   * 경고 대상 테넌트 처리 (75일 이상)
   */
  private static async processTenantsForWarning(): Promise<CleanupResult[]> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.WARNING_DAYS)

    const archiveThreshold = new Date()
    archiveThreshold.setDate(archiveThreshold.getDate() - this.ARCHIVE_DAYS)

    logger.info('경고 대상 테넌트 조회', {
      cutoffDate,
      warningDays: this.WARNING_DAYS,
    })

    const inactiveTenants = await prisma.tenant.findMany({
      where: {
        subscriptionStatus: {
          in: [SubscriptionStatus.CANCELLED, SubscriptionStatus.UNPAID],
        },
        updatedAt: {
          lt: cutoffDate,
          gte: archiveThreshold, // 아카이브 대상 제외
        },
      },
      include: {
        users: {
          where: { isActive: true },
          take: 1,
        },
      },
      take: 50, // 한 번에 최대 50개 처리
    })

    logger.info(`경고 대상 테넌트 ${inactiveTenants.length}개 발견`)

    const results: CleanupResult[] = []

    for (const tenant of inactiveTenants) {
      try {
        await this.sendInactivityWarning(tenant)

        const inactiveDays = Math.floor(
          (Date.now() - tenant.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
        )

        results.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          status: 'notified',
          inactiveDays,
          lastActivityDate: tenant.updatedAt,
          reason: '비활성 경고 발송',
        })
      } catch (error) {
        logger.error('경고 발송 실패', {
          tenantId: tenant.id,
          tenantName: tenant.name,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return results
  }

  /**
   * 테넌트 삭제
   */
  private static async deleteTenant(tenant: any): Promise<CleanupResult> {
    logger.info('테넌트 삭제 시작', {
      tenantId: tenant.id,
      tenantName: tenant.name,
    })

    const inactiveDays = Math.floor(
      (Date.now() - tenant.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    )

    // 1. 삭제 전 백업
    let backupPath: string | undefined
    try {
      const backupResult = await TenantBackup.backupSingleTenant(tenant.id)
      backupPath = backupResult.backupPath
      logger.info('삭제 전 백업 완료', { tenantId: tenant.id, backupPath })
    } catch (error) {
      logger.error('백업 실패, 삭제 중단', {
        tenantId: tenant.id,
        error: error instanceof Error ? error.message : String(error),
      })
      throw new Error('백업 실패로 삭제를 중단했습니다')
    }

    // 2. 삭제 알림 발송
    await this.sendDeletionNotification(tenant)

    // 3. 테넛트 삭제 (Cascade로 관련 데이터 모두 삭제)
    await prisma.tenant.delete({
      where: { id: tenant.id },
    })

    logger.info('테넌트 삭제 완료', {
      tenantId: tenant.id,
      tenantName: tenant.name,
      inactiveDays,
    })

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      status: 'deleted',
      inactiveDays,
      lastActivityDate: tenant.updatedAt,
      backupPath,
      reason: `${inactiveDays}일 미사용`,
    }
  }

  /**
   * 테넌트 아카이브 (데이터 보관)
   */
  private static async archiveTenant(tenant: any): Promise<CleanupResult> {
    logger.info('테넌트 아카이브 시작', {
      tenantId: tenant.id,
      tenantName: tenant.name,
    })

    const inactiveDays = Math.floor(
      (Date.now() - tenant.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    )

    // 1. 백업 생성
    let backupPath: string | undefined
    try {
      const backupResult = await TenantBackup.backupSingleTenant(tenant.id)
      backupPath = backupResult.backupPath
      logger.info('아카이브 백업 완료', { tenantId: tenant.id, backupPath })
    } catch (error) {
      logger.error('백업 실패', {
        tenantId: tenant.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    // 2. 아카이브 알림 발송
    await this.sendArchiveNotification(tenant)

    // 3. 로그 데이터 정리 (최근 30일만 유지)
    const retentionDate = new Date()
    retentionDate.setDate(retentionDate.getDate() - 30)

    await prisma.$transaction([
      // 오래된 이메일 로그 삭제
      prisma.emailLog.deleteMany({
        where: {
          tenantId: tenant.id,
          createdAt: { lt: retentionDate },
        },
      }),
      // 오래된 알림 로그 삭제
      prisma.notificationLog.deleteMany({
        where: {
          tenantId: tenant.id,
          createdAt: { lt: retentionDate },
        },
      }),
    ])

    logger.info('테넌트 아카이브 완료', {
      tenantId: tenant.id,
      tenantName: tenant.name,
      inactiveDays,
    })

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      status: 'archived',
      inactiveDays,
      lastActivityDate: tenant.updatedAt,
      backupPath,
      reason: `${inactiveDays}일 미사용, 로그 데이터 정리`,
    }
  }

  /**
   * 비활성 경고 알림
   */
  private static async sendInactivityWarning(tenant: any): Promise<void> {
    if (!tenant.users || tenant.users.length === 0) {
      return
    }

    const user = tenant.users[0]
    const inactiveDays = Math.floor(
      (Date.now() - tenant.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    )
    const daysUntilArchive = this.ARCHIVE_DAYS - inactiveDays

    logger.info('[알림] 비활성 경고', {
      tenantId: tenant.id,
      tenantName: tenant.name,
      userEmail: user.email,
      inactiveDays,
      daysUntilArchive,
      message: `
안녕하세요 ${tenant.name} 관리자님,

Echo Mail 계정이 ${inactiveDays}일 동안 사용되지 않았습니다.

${daysUntilArchive}일 후에도 사용하지 않으실 경우:
- 데이터가 아카이브되고 로그가 정리됩니다
- ${this.DELETE_DAYS}일 후에는 계정이 완전히 삭제됩니다

계정을 유지하시려면 로그인하여 활동해주세요.

로그인: https://echomail.example.com/auth/login

문의사항이 있으시면 고객센터로 연락해주세요.

감사합니다.
Echo Mail 팀
      `.trim(),
    })
  }

  /**
   * 아카이브 알림
   */
  private static async sendArchiveNotification(tenant: any): Promise<void> {
    if (!tenant.users || tenant.users.length === 0) {
      return
    }

    const user = tenant.users[0]

    logger.info('[알림] 아카이브', {
      tenantId: tenant.id,
      tenantName: tenant.name,
      userEmail: user.email,
      message: `
안녕하세요 ${tenant.name} 관리자님,

장기간 미사용으로 인해 Echo Mail 계정이 아카이브되었습니다.

아카이브 조치:
- 데이터 백업 완료
- 오래된 로그 데이터 정리 (최근 30일만 유지)
- 계정은 보관 상태로 유지

계정 복구를 원하시면 고객센터로 문의해주세요.

${this.DELETE_DAYS - this.ARCHIVE_DAYS}일 후에도 활동이 없으면 계정이 완전히 삭제됩니다.

감사합니다.
Echo Mail 팀
      `.trim(),
    })
  }

  /**
   * 삭제 알림
   */
  private static async sendDeletionNotification(tenant: any): Promise<void> {
    if (!tenant.users || tenant.users.length === 0) {
      return
    }

    const user = tenant.users[0]

    logger.info('[알림] 계정 삭제', {
      tenantId: tenant.id,
      tenantName: tenant.name,
      userEmail: user.email,
      message: `
안녕하세요 ${tenant.name} 관리자님,

장기간 미사용으로 인해 Echo Mail 계정이 삭제되었습니다.

삭제된 데이터:
- 모든 업체 및 담당자 정보
- 이메일 및 알림 로그
- 시스템 설정 및 템플릿

백업 데이터는 30일간 보관됩니다.
복구를 원하시면 즉시 고객센터로 문의해주세요.

그동안 Echo Mail을 이용해주셔서 감사합니다.

Echo Mail 팀
      `.trim(),
    })
  }

  /**
   * 비활성 테넌트 통계
   */
  static async getInactiveStats(): Promise<{
    warning: number
    archive: number
    deletion: number
  }> {
    const now = new Date()

    const warningDate = new Date(now)
    warningDate.setDate(warningDate.getDate() - this.WARNING_DAYS)

    const archiveDate = new Date(now)
    archiveDate.setDate(archiveDate.getDate() - this.ARCHIVE_DAYS)

    const deleteDate = new Date(now)
    deleteDate.setDate(deleteDate.getDate() - this.DELETE_DAYS)

    const [warning, archive, deletion] = await Promise.all([
      // 경고 대상
      prisma.tenant.count({
        where: {
          subscriptionStatus: {
            in: [SubscriptionStatus.CANCELLED, SubscriptionStatus.UNPAID],
          },
          updatedAt: {
            lt: warningDate,
            gte: archiveDate,
          },
        },
      }),
      // 아카이브 대상
      prisma.tenant.count({
        where: {
          subscriptionStatus: {
            in: [SubscriptionStatus.CANCELLED, SubscriptionStatus.UNPAID],
          },
          updatedAt: {
            lt: archiveDate,
            gte: deleteDate,
          },
        },
      }),
      // 삭제 대상
      prisma.tenant.count({
        where: {
          subscriptionStatus: {
            in: [SubscriptionStatus.CANCELLED, SubscriptionStatus.UNPAID],
          },
          updatedAt: {
            lt: deleteDate,
          },
        },
      }),
    ])

    return {
      warning,
      archive,
      deletion,
    }
  }
}

export default InactiveTenantCleanup
