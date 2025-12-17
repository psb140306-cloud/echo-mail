import { NotificationType } from '@prisma/client'
import { logger } from '@/lib/utils/logger'
import { prisma } from '@/lib/db'

export interface NotificationTemplate {
  id: string
  name: string
  type: NotificationType
  subject?: string
  content: string
  variables: string[]
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export interface TemplateRenderOptions {
  templateName: string
  variables: Record<string, string>
  type?: NotificationType
  tenantId?: string
}

export interface RenderedTemplate {
  subject?: string
  content: string
  variables: string[]
}

export class TemplateManager {
  private templateCache: Map<string, NotificationTemplate> = new Map()

  constructor() {}

  /**
   * 템플릿 렌더링
   */
  async renderTemplate(options: TemplateRenderOptions): Promise<RenderedTemplate> {
    try {
      const template = await this.getTemplate(options.templateName, options.type, options.tenantId)

      if (!template) {
        throw new Error(`템플릿을 찾을 수 없습니다: ${options.templateName}`)
      }

      // 변수 치환
      const renderedContent = this.replaceVariables(template.content, options.variables)
      const renderedSubject = template.subject
        ? this.replaceVariables(template.subject, options.variables)
        : undefined

      // 누락된 변수 확인
      const missingVariables = this.findMissingVariables(renderedContent, template.variables)
      if (missingVariables.length > 0) {
        logger.warn('템플릿에 누락된 변수가 있습니다', {
          templateName: options.templateName,
          missingVariables,
        })
      }

      logger.info('템플릿 렌더링 완료', {
        templateName: options.templateName,
        type: template.type,
        variablesUsed: Object.keys(options.variables).length,
      })

      return {
        subject: renderedSubject,
        content: renderedContent,
        variables: template.variables,
      }
    } catch (error) {
      logger.error('템플릿 렌더링 실패:', error)
      throw error
    }
  }

  /**
   * 템플릿 조회 (캐싱)
   */
  async getTemplate(name: string, type?: NotificationType, tenantId?: string): Promise<NotificationTemplate | null> {
    const cacheKey = `${tenantId || 'no-tenant'}_${name}_${type || 'any'}`

    logger.info('[TemplateManager] getTemplate 호출', {
      name,
      type,
      tenantId,
      cacheKey,
      cacheHit: this.templateCache.has(cacheKey),
    })

    if (this.templateCache.has(cacheKey)) {
      logger.info('[TemplateManager] 캐시에서 템플릿 반환')
      return this.templateCache.get(cacheKey)!
    }

    try {
      const where: any = { name }
      if (type) {
        where.type = type
      }
      if (tenantId) {
        where.tenantId = tenantId
      }

      logger.info('[TemplateManager] DB 쿼리 실행', { where })

      const template = await prisma.messageTemplate.findFirst({
        where,
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      })

      logger.info('[TemplateManager] DB 쿼리 결과', {
        found: !!template,
        templateId: template?.id,
        templateName: template?.name,
      })

      // 템플릿이 없으면 하드코딩된 기본 템플릿 사용
      let templateToUse = template
      if (!templateToUse) {
        logger.warn('[TemplateManager] DB에 템플릿 없음, 하드코딩된 기본 템플릿 사용', {
          name,
          type,
          tenantId,
        })

        // 하드코딩된 기본 템플릿
        const defaultTemplates: Record<string, { content: string; variables: string[]; type: NotificationType; subject?: string }> = {
          'ORDER_RECEIVED_SMS': {
            type: 'SMS' as NotificationType,
            content: '[발주접수] {{companyName}} 납품:{{shortDate}}{{deliveryTime}}',
            variables: ['companyName', 'shortDate', 'deliveryTime'],
          },
          'ORDER_RECEIVED_KAKAO': {
            type: 'KAKAO_ALIMTALK' as NotificationType,
            subject: '발주 접수 확인',
            content: '{{companyName}}님의 발주가 정상적으로 접수되었습니다.\n\n📦 납품 예정일: {{deliveryDate}}{{deliveryTime}}\n\n문의사항이 있으시면 언제든 연락 주세요.\n감사합니다.',
            variables: ['companyName', 'deliveryDate', 'deliveryTime'],
          },
        }

        const fallbackTemplate = defaultTemplates[name]
        if (fallbackTemplate) {
          templateToUse = {
            id: 'fallback-' + name,
            name,
            type: fallbackTemplate.type,
            subject: fallbackTemplate.subject || null,
            content: fallbackTemplate.content,
            variables: fallbackTemplate.variables,
            tenantId: tenantId || 'fallback',
            isActive: true,
            isDefault: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any

          logger.info('[TemplateManager] Fallback 템플릿 사용', { name })
        }
      }

      if (templateToUse) {
        // variables가 배열이 아니면 객체의 키 배열로 변환 (방어 로직)
        const variables = Array.isArray(templateToUse.variables)
          ? templateToUse.variables
          : Object.keys(templateToUse.variables || {})

        if (!Array.isArray(templateToUse.variables)) {
          logger.warn('[TemplateManager] variables가 배열이 아닙니다. 객체 키로 변환', {
            templateName: templateToUse.name,
            originalType: typeof templateToUse.variables,
            converted: variables,
          })
        }

        const templateData: NotificationTemplate = {
          id: templateToUse.id,
          name: templateToUse.name,
          type: templateToUse.type,
          subject: templateToUse.subject || undefined,
          content: templateToUse.content,
          variables: variables as string[],
          isDefault: templateToUse.isDefault,
          createdAt: templateToUse.createdAt,
          updatedAt: templateToUse.updatedAt,
        }

        this.templateCache.set(cacheKey, templateData)
        return templateData
      }

      return null
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined

      logger.error(`[TemplateManager] 템플릿 조회 실패 - name=${name}, type=${type}, tenantId=${tenantId}`)
      logger.error(`[TemplateManager] 에러: ${errorMsg}`)
      if (errorStack) {
        logger.error(`[TemplateManager] 스택: ${errorStack}`)
      }
      return null
    }
  }

  /**
   * 모든 템플릿 목록 조회
   */
  async getAllTemplates(type?: NotificationType): Promise<NotificationTemplate[]> {
    try {
      const where: any = {}
      if (type) {
        where.type = type
      }

      const templates = await prisma.messageTemplate.findMany({
        where,
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      })

      return templates.map((template) => ({
        id: template.id,
        name: template.name,
        type: template.type,
        subject: template.subject || undefined,
        content: template.content,
        variables: template.variables as string[],
        isDefault: template.isDefault,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      }))
    } catch (error) {
      logger.error('템플릿 목록 조회 실패:', error)
      return []
    }
  }

  /**
   * 변수 치환
   */
  private replaceVariables(content: string, variables: Record<string, string>): string {
    let result = content

    // variables가 객체가 아니면 빈 객체로 처리
    if (!variables || typeof variables !== 'object' || Array.isArray(variables)) {
      logger.warn('[TemplateManager] variables가 올바른 객체가 아닙니다', {
        variables,
        type: typeof variables,
        isArray: Array.isArray(variables),
      })
      return result
    }

    // {{variable}} 형태의 변수 치환
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      result = result.replace(regex, String(value))
    })

    return result
  }

  /**
   * 누락된 변수 찾기
   */
  private findMissingVariables(content: string, requiredVariables: string[]): string[] {
    const missing: string[] = []

    requiredVariables.forEach((variable) => {
      const regex = new RegExp(`\\{\\{${variable}\\}\\}`, 'g')
      if (regex.test(content)) {
        missing.push(variable)
      }
    })

    return missing
  }

  /**
   * 테넌트용 기본 템플릿 생성
   */
  async createDefaultTemplatesForTenant(tenantId: string): Promise<void> {
    try {
      const defaultTemplates = [
        {
          name: 'ORDER_RECEIVED_SMS',
          type: NotificationType.SMS,
          content: '[발주접수] {{companyName}} 납품:{{shortDate}}{{deliveryTime}}',
          variables: ['companyName', 'shortDate', 'deliveryTime'],
          isDefault: true,
          tenantId,
        },
        {
          name: 'ORDER_RECEIVED_KAKAO',
          type: NotificationType.KAKAO_ALIMTALK,
          subject: '발주 접수 확인',
          content:
            '{{companyName}}님의 발주가 정상적으로 접수되었습니다.\n\n📦 납품 예정일: {{deliveryDate}}{{deliveryTime}}\n\n문의사항이 있으시면 언제든 연락 주세요.\n감사합니다.',
          variables: ['companyName', 'deliveryDate', 'deliveryTime'],
          isDefault: true,
          tenantId,
        },
        {
          name: 'DELIVERY_REMINDER_SMS',
          type: NotificationType.SMS,
          content:
            '[배송 안내]\n{{companyName}}님께 오늘 {{deliveryTime}} 배송 예정입니다.\n문의: {{contactNumber}}',
          variables: ['companyName', 'deliveryTime', 'contactNumber'],
          isDefault: true,
          tenantId,
        },
        {
          name: 'URGENT_NOTICE_SMS',
          type: NotificationType.SMS,
          content: '[긴급 공지]\n{{message}}\n문의: {{contactNumber}}',
          variables: ['message', 'contactNumber'],
          isDefault: false,
          tenantId,
        },
      ]

      for (const templateData of defaultTemplates) {
        const existing = await prisma.messageTemplate.findFirst({
          where: {
            name: templateData.name,
            tenantId,
          },
        })

        if (!existing) {
          await prisma.messageTemplate.create({
            data: templateData,
          })

          logger.info(`테넌트 ${tenantId} 기본 템플릿 생성: ${templateData.name}`)
        }
      }

      logger.info(`테넌트 ${tenantId}에 기본 템플릿 생성 완료`)
    } catch (error) {
      logger.error(`테넌트 ${tenantId} 기본 템플릿 생성 실패:`, error)
      throw error
    }
  }

  /**
   * @deprecated Use createDefaultTemplatesForTenant instead
   * 기본 템플릿 생성 (tenantId 없이 생성하므로 사용 불가)
   */
  async createDefaultTemplates(): Promise<void> {
    logger.warn('createDefaultTemplates는 deprecated되었습니다. createDefaultTemplatesForTenant를 사용하세요.')
  }

  /**
   * 템플릿 검증
   */
  validateTemplate(content: string, variables: string[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // 필수 변수 확인
    variables.forEach((variable) => {
      const regex = new RegExp(`\\{\\{${variable}\\}\\}`, 'g')
      if (!regex.test(content)) {
        errors.push(`필수 변수가 없습니다: {{${variable}}}`)
      }
    })

    // 정의되지 않은 변수 확인
    const usedVariables = this.extractVariablesFromContent(content)
    const undefinedVariables = usedVariables.filter((variable) => !variables.includes(variable))

    if (undefinedVariables.length > 0) {
      errors.push(`정의되지 않은 변수: ${undefinedVariables.map((v) => `{{${v}}}`).join(', ')}`)
    }

    // SMS 길이 제한 확인 (한글 기준 90자, 영문 160자)
    if (content.length > 90) {
      errors.push('SMS 내용이 너무 깁니다 (최대 90자)')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * 콘텐츠에서 변수 추출
   */
  private extractVariablesFromContent(content: string): string[] {
    const variableRegex = /\{\{([^}]+)\}\}/g
    const variables: string[] = []
    let match

    while ((match = variableRegex.exec(content)) !== null) {
      variables.push(match[1])
    }

    return [...new Set(variables)] // 중복 제거
  }

  /**
   * 템플릿 미리보기
   */
  async previewTemplate(
    templateName: string,
    sampleVariables: Record<string, string>
  ): Promise<RenderedTemplate> {
    try {
      const template = await this.getTemplate(templateName)

      if (!template) {
        throw new Error(`템플릿을 찾을 수 없습니다: ${templateName}`)
      }

      // 샘플 변수로 렌더링
      const rendered = await this.renderTemplate({
        templateName,
        variables: sampleVariables,
      })

      return rendered
    } catch (error) {
      logger.error('템플릿 미리보기 실패:', error)
      throw error
    }
  }

  /**
   * 캐시 초기화
   */
  clearCache(): void {
    this.templateCache.clear()
    logger.info('템플릿 캐시 초기화 완료')
  }

  /**
   * 변수별 샘플 데이터 제공
   */
  getSampleVariables(): Record<string, string> {
    return {
      companyName: '대한상사',
      deliveryDate: '2025년 1월 20일',
      deliveryTime: '오전',
      contactNumber: '010-1234-5678',
      message: '긴급 공지사항입니다.',
      orderNumber: 'ORDER-20250115-001',
      productName: '사무용품 세트',
      quantity: '10개',
      totalAmount: '150,000원',
    }
  }
}

// 싱글톤 인스턴스
export const templateManager = new TemplateManager()

// 편의 함수
export async function renderNotificationTemplate(
  templateName: string,
  variables: Record<string, string>,
  type?: NotificationType,
  tenantId?: string
): Promise<RenderedTemplate> {
  return templateManager.renderTemplate({ templateName, variables, type, tenantId })
}

export async function getNotificationTemplate(
  name: string,
  type?: NotificationType,
  tenantId?: string
): Promise<NotificationTemplate | null> {
  return templateManager.getTemplate(name, type, tenantId)
}
