/**
 * 테넌트 데이터 백업 자동화
 * - 테넌트별 데이터 백업
 * - JSON 형식으로 내보내기
 * - 백업 이력 관리
 */

import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { SubscriptionStatus } from '@prisma/client'

export interface BackupResult {
  tenantId: string
  tenantName: string
  status: 'success' | 'failed' | 'skipped'
  backupSize?: number
  backupPath?: string
  recordCount?: {
    companies: number
    contacts: number
    emailLogs: number
    notificationLogs: number
    deliveryRules: number
    holidays: number
    messageTemplates: number
  }
  errorMessage?: string
}

export interface TenantBackupData {
  tenant: any
  companies: any[]
  contacts: any[]
  emailLogs: any[]
  notificationLogs: any[]
  deliveryRules: any[]
  holidays: any[]
  messageTemplates: any[]
  systemConfigs: any[]
  backupDate: string
  version: string
}

export class TenantBackup {
  private static readonly BACKUP_DIR = process.env.BACKUP_DIR || './backups'
  private static readonly BACKUP_VERSION = '1.0.0'

  /**
   * 활성 테넌트 전체 백업
   */
  static async backupAllActiveTenants(): Promise<BackupResult[]> {
    logger.info('전체 테넌트 백업 시작')

    try {
      // 활성 상태의 유료 구독 테넌트만 백업
      const activeTenants = await prisma.tenant.findMany({
        where: {
          subscriptionStatus: {
            in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL],
          },
        },
        select: {
          id: true,
          name: true,
        },
        take: 50, // 한 번에 최대 50개 처리
      })

      logger.info(`백업 대상 테넌트 ${activeTenants.length}개 발견`)

      const results: BackupResult[] = []

      for (const tenant of activeTenants) {
        try {
          const result = await this.backupSingleTenant(tenant.id)
          results.push(result)

          // 부하 분산을 위한 딜레이 (500ms)
          await new Promise((resolve) => setTimeout(resolve, 500))
        } catch (error) {
          logger.error('테넌트 백업 실패', {
            tenantId: tenant.id,
            tenantName: tenant.name,
            error: error instanceof Error ? error.message : String(error),
          })

          results.push({
            tenantId: tenant.id,
            tenantName: tenant.name,
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : '백업 실패',
          })
        }
      }

      logger.info('전체 테넌트 백업 완료', {
        total: results.length,
        success: results.filter((r) => r.status === 'success').length,
        failed: results.filter((r) => r.status === 'failed').length,
        skipped: results.filter((r) => r.status === 'skipped').length,
      })

      return results
    } catch (error) {
      logger.error('전체 백업 처리 중 오류 발생', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * 단일 테넌트 백업
   */
  static async backupSingleTenant(tenantId: string): Promise<BackupResult> {
    logger.info('테넌트 백업 시작', { tenantId })

    try {
      // 테넌트 정보 조회
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          subscriptions: {
            where: {
              status: {
                in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL],
              },
            },
            take: 1,
          },
        },
      })

      if (!tenant) {
        throw new Error('테넌트를 찾을 수 없습니다')
      }

      // 백업 데이터 수집
      const backupData = await this.collectTenantData(tenantId)

      // 레코드 수 계산
      const recordCount = {
        companies: backupData.companies.length,
        contacts: backupData.contacts.length,
        emailLogs: backupData.emailLogs.length,
        notificationLogs: backupData.notificationLogs.length,
        deliveryRules: backupData.deliveryRules.length,
        holidays: backupData.holidays.length,
        messageTemplates: backupData.messageTemplates.length,
      }

      logger.info('백업 데이터 수집 완료', {
        tenantId,
        tenantName: tenant.name,
        recordCount,
      })

      // 백업 파일 생성
      const backupPath = await this.saveBackupFile(tenant, backupData)
      const backupSize = Buffer.byteLength(JSON.stringify(backupData), 'utf8')

      logger.info('테넌트 백업 완료', {
        tenantId,
        tenantName: tenant.name,
        backupPath,
        backupSize: `${(backupSize / 1024).toFixed(2)} KB`,
        recordCount,
      })

      return {
        tenantId,
        tenantName: tenant.name,
        status: 'success',
        backupSize,
        backupPath,
        recordCount,
      }
    } catch (error) {
      logger.error('테넌트 백업 실패', {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      })

      throw error
    }
  }

  /**
   * 테넌트 데이터 수집
   */
  private static async collectTenantData(tenantId: string): Promise<TenantBackupData> {
    const [tenant, companies, contacts, emailLogs, notificationLogs, deliveryRules, holidays, messageTemplates, systemConfigs] =
      await Promise.all([
        // 테넌트 기본 정보
        prisma.tenant.findUnique({
          where: { id: tenantId },
          include: {
            subscriptions: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        }),

        // 업체 정보
        prisma.company.findMany({
          where: { tenantId },
          include: {
            contacts: true,
          },
        }),

        // 담당자 정보
        prisma.contact.findMany({
          where: { tenantId },
        }),

        // 이메일 로그 (최근 3개월)
        prisma.emailLog.findMany({
          where: {
            tenantId,
            createdAt: {
              gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90일 전
            },
          },
        }),

        // 알림 로그 (최근 3개월)
        prisma.notificationLog.findMany({
          where: {
            tenantId,
            createdAt: {
              gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90일 전
            },
          },
        }),

        // 납품 규칙
        prisma.deliveryRule.findMany({
          where: { tenantId },
        }),

        // 공휴일
        prisma.holiday.findMany({
          where: { tenantId },
        }),

        // 메시지 템플릿
        prisma.messageTemplate.findMany({
          where: { tenantId },
        }),

        // 시스템 설정
        prisma.systemConfig.findMany({
          where: { tenantId },
        }),
      ])

    return {
      tenant,
      companies,
      contacts,
      emailLogs,
      notificationLogs,
      deliveryRules,
      holidays,
      messageTemplates,
      systemConfigs,
      backupDate: new Date().toISOString(),
      version: this.BACKUP_VERSION,
    }
  }

  /**
   * 백업 파일 저장
   */
  private static async saveBackupFile(
    tenant: any,
    backupData: TenantBackupData
  ): Promise<string> {
    // 백업 디렉토리 생성
    const backupDir = join(this.BACKUP_DIR, tenant.id)

    try {
      await mkdir(backupDir, { recursive: true })
    } catch (error) {
      // 디렉토리가 이미 존재하는 경우 무시
    }

    // 파일명 생성 (날짜 포함)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    const filename = `backup-${tenant.name.replace(/[^a-zA-Z0-9]/g, '_')}-${timestamp}.json`
    const filepath = join(backupDir, filename)

    // JSON 파일로 저장
    await writeFile(filepath, JSON.stringify(backupData, null, 2), 'utf8')

    logger.info('백업 파일 저장 완료', {
      tenantId: tenant.id,
      filepath,
    })

    return filepath
  }

  /**
   * 오래된 백업 삭제
   */
  static async cleanupOldBackups(retentionDays: number = 30): Promise<number> {
    logger.info('오래된 백업 정리 시작', { retentionDays })

    // TODO: 파일 시스템 기반 백업 정리 로직 구현
    // - 백업 디렉토리 스캔
    // - retentionDays보다 오래된 파일 삭제
    // - S3/클라우드 스토리지 사용 시 해당 API 활용

    logger.info('백업 정리는 수동으로 진행하거나 S3 라이프사이클 정책 사용 권장')

    return 0
  }

  /**
   * 백업 통계
   */
  static async getBackupStats(): Promise<{
    totalBackups: number
    totalSize: number
    lastBackupDate: string | null
  }> {
    // TODO: 실제 백업 파일 시스템 스캔하여 통계 계산
    // 현재는 더미 데이터 반환

    return {
      totalBackups: 0,
      totalSize: 0,
      lastBackupDate: null,
    }
  }

  /**
   * 백업 복원 (복구용)
   */
  static async restoreFromBackup(
    tenantId: string,
    backupPath: string
  ): Promise<void> {
    logger.info('백업 복원 시작', { tenantId, backupPath })

    // TODO: 백업 복원 로직 구현
    // - JSON 파일 읽기
    // - 데이터 검증
    // - 트랜잭션으로 데이터 복원
    // - 복원 후 검증

    logger.warn('백업 복원은 수동으로 진행하거나 별도 스크립트 사용 권장')

    throw new Error('백업 복원 기능은 아직 구현되지 않았습니다')
  }
}

export default TenantBackup
