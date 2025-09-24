/**
 * Echo Mail Admin Notification System
 * 관리자 알림 및 모니터링 시스템
 */

import { EchoMailError, ErrorSeverity, ErrorCategory } from './errors'
import { logger, LogMetadata } from './logger'

export interface AdminNotificationChannel {
  type: 'EMAIL' | 'SLACK' | 'SMS' | 'WEBHOOK' | 'SYSTEM_LOG'
  enabled: boolean
  config: Record<string, any>
  priority: NotificationPriority[]
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum NotificationType {
  SYSTEM_ERROR = 'system_error',
  EMAIL_PROCESSING_ERROR = 'email_processing_error',
  UNREGISTERED_COMPANY = 'unregistered_company',
  NOTIFICATION_FAILURE = 'notification_failure',
  QUOTA_EXCEEDED = 'quota_exceeded',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  PERFORMANCE_ISSUE = 'performance_issue',
  SECURITY_ALERT = 'security_alert',
  CUSTOM_ALERT = 'custom_alert'
}

export interface AdminNotification {
  id: string
  type: NotificationType
  priority: NotificationPriority
  title: string
  message: string
  data?: Record<string, any>
  source: {
    component: string
    function?: string
    error?: EchoMailError
  }
  timestamp: Date
  acknowledged?: {
    at: Date
    by: string
    note?: string
  }
  resolved?: {
    at: Date
    by: string
    solution?: string
  }
  channels: string[]
  retryCount: number
  lastRetry?: Date
}

export interface NotificationTemplate {
  type: NotificationType
  priority: NotificationPriority
  titleTemplate: string
  messageTemplate: string
  channels: AdminNotificationChannel['type'][]
  throttleMinutes?: number
  escalationMinutes?: number
}

export interface NotificationRule {
  id: string
  name: string
  conditions: {
    errorCode?: number
    category?: ErrorCategory
    severity?: ErrorSeverity
    frequency?: {
      count: number
      timeWindowMinutes: number
    }
    customCondition?: (context: any) => boolean
  }
  action: {
    type: NotificationType
    priority: NotificationPriority
    customMessage?: string
    channels?: AdminNotificationChannel['type'][]
    escalateAfterMinutes?: number
  }
  enabled: boolean
}

/**
 * 관리자 알림 시스템
 */
export class AdminNotificationSystem {
  private static instance: AdminNotificationSystem
  private notifications: Map<string, AdminNotification> = new Map()
  private channels: Map<string, AdminNotificationChannel> = new Map()
  private templates: Map<NotificationType, NotificationTemplate> = new Map()
  private rules: Map<string, NotificationRule> = new Map()
  private throttleCache: Map<string, Date> = new Map()

  private constructor() {
    this.initializeDefaultChannels()
    this.initializeDefaultTemplates()
    this.initializeDefaultRules()
  }

  static getInstance(): AdminNotificationSystem {
    if (!AdminNotificationSystem.instance) {
      AdminNotificationSystem.instance = new AdminNotificationSystem()
    }
    return AdminNotificationSystem.instance
  }

  /**
   * 기본 알림 채널 초기화
   */
  private initializeDefaultChannels(): void {
    // 이메일 알림
    this.channels.set('admin-email', {
      type: 'EMAIL',
      enabled: true,
      config: {
        to: process.env.ADMIN_EMAIL || 'admin@company.com',
        from: process.env.SYSTEM_EMAIL || 'system@company.com',
        smtpHost: process.env.SMTP_HOST,
        smtpPort: process.env.SMTP_PORT,
        smtpUser: process.env.SMTP_USER,
        smtpPass: process.env.SMTP_PASS
      },
      priority: [NotificationPriority.HIGH, NotificationPriority.CRITICAL]
    })

    // Slack 알림
    this.channels.set('slack-alerts', {
      type: 'SLACK',
      enabled: !!process.env.SLACK_WEBHOOK_URL,
      config: {
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        channel: process.env.SLACK_CHANNEL || '#echo-mail-alerts',
        username: 'Echo Mail Bot',
        iconEmoji: ':warning:'
      },
      priority: [NotificationPriority.MEDIUM, NotificationPriority.HIGH, NotificationPriority.CRITICAL]
    })

    // SMS 알림 (긴급용)
    this.channels.set('admin-sms', {
      type: 'SMS',
      enabled: !!process.env.ADMIN_SMS_NUMBER,
      config: {
        number: process.env.ADMIN_SMS_NUMBER,
        apiKey: process.env.SMS_API_KEY,
        apiSecret: process.env.SMS_API_SECRET
      },
      priority: [NotificationPriority.CRITICAL]
    })

    // 시스템 로그
    this.channels.set('system-log', {
      type: 'SYSTEM_LOG',
      enabled: true,
      config: {},
      priority: [NotificationPriority.LOW, NotificationPriority.MEDIUM, NotificationPriority.HIGH, NotificationPriority.CRITICAL]
    })

    // 웹훅
    this.channels.set('webhook', {
      type: 'WEBHOOK',
      enabled: !!process.env.ADMIN_WEBHOOK_URL,
      config: {
        url: process.env.ADMIN_WEBHOOK_URL,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ADMIN_WEBHOOK_TOKEN}`
        }
      },
      priority: [NotificationPriority.HIGH, NotificationPriority.CRITICAL]
    })
  }

  /**
   * 기본 알림 템플릿 초기화
   */
  private initializeDefaultTemplates(): void {
    this.templates.set(NotificationType.SYSTEM_ERROR, {
      type: NotificationType.SYSTEM_ERROR,
      priority: NotificationPriority.HIGH,
      titleTemplate: '[Echo Mail] 시스템 오류 발생',
      messageTemplate: `
시스템에서 오류가 발생했습니다.

오류 코드: {{errorCode}}
카테고리: {{category}}
메시지: {{message}}
발생 시간: {{timestamp}}
컴포넌트: {{component}}

{{#if context}}
추가 정보:
{{context}}
{{/if}}

즉시 확인이 필요합니다.
      `,
      channels: ['admin-email', 'slack-alerts', 'system-log'],
      throttleMinutes: 10
    })

    this.templates.set(NotificationType.UNREGISTERED_COMPANY, {
      type: NotificationType.UNREGISTERED_COMPANY,
      priority: NotificationPriority.MEDIUM,
      titleTemplate: '[Echo Mail] 미등록 업체 알림',
      messageTemplate: `
새로운 미등록 업체에서 이메일을 수신했습니다.

발신자: {{email}}
업체명: {{companyName}}
수신 횟수: {{emailCount}}
첫 수신: {{firstSeen}}
마지막 수신: {{lastSeen}}

관리자 대시보드에서 확인 후 승인/거부를 결정해주세요.
      `,
      channels: ['admin-email', 'slack-alerts'],
      throttleMinutes: 60,
      escalationMinutes: 240
    })

    this.templates.set(NotificationType.EMAIL_PROCESSING_ERROR, {
      type: NotificationType.EMAIL_PROCESSING_ERROR,
      priority: NotificationPriority.MEDIUM,
      titleTemplate: '[Echo Mail] 이메일 처리 오류',
      messageTemplate: `
이메일 처리 중 오류가 발생했습니다.

발신자: {{sender}}
제목: {{subject}}
오류: {{error}}
발생 시간: {{timestamp}}

해당 이메일이 정상적으로 처리되지 않았을 수 있습니다.
      `,
      channels: ['system-log', 'slack-alerts'],
      throttleMinutes: 30
    })

    this.templates.set(NotificationType.NOTIFICATION_FAILURE, {
      type: NotificationType.NOTIFICATION_FAILURE,
      priority: NotificationPriority.HIGH,
      titleTemplate: '[Echo Mail] 알림 발송 실패',
      messageTemplate: `
알림 발송에 실패했습니다.

유형: {{notificationType}}
대상: {{recipient}}
실패 사유: {{reason}}
재시도 횟수: {{retryCount}}
발생 시간: {{timestamp}}

SMS/카카오톡 발송 시스템을 점검해주세요.
      `,
      channels: ['admin-email', 'slack-alerts', 'system-log'],
      throttleMinutes: 15
    })

    this.templates.set(NotificationType.QUOTA_EXCEEDED, {
      type: NotificationType.QUOTA_EXCEEDED,
      priority: NotificationPriority.HIGH,
      titleTemplate: '[Echo Mail] 사용량 한도 초과',
      messageTemplate: `
서비스 사용량이 한도를 초과했습니다.

서비스: {{service}}
현재 사용량: {{currentUsage}}
한도: {{limit}}
초과율: {{overagePercent}}%
발생 시간: {{timestamp}}

즉시 한도를 늘리거나 사용량을 제한해주세요.
      `,
      channels: ['admin-email', 'admin-sms', 'slack-alerts'],
      escalationMinutes: 30
    })

    this.templates.set(NotificationType.SERVICE_UNAVAILABLE, {
      type: NotificationType.SERVICE_UNAVAILABLE,
      priority: NotificationPriority.CRITICAL,
      titleTemplate: '[Echo Mail] 서비스 장애',
      messageTemplate: `
주요 서비스에 장애가 발생했습니다.

서비스: {{service}}
상태: {{status}}
오류 메시지: {{error}}
발생 시간: {{timestamp}}
예상 복구 시간: {{estimatedRecovery}}

긴급 조치가 필요합니다.
      `,
      channels: ['admin-email', 'admin-sms', 'slack-alerts', 'webhook'],
      escalationMinutes: 5
    })
  }

  /**
   * 기본 알림 규칙 초기화
   */
  private initializeDefaultRules(): void {
    // 크리티컬 에러 즉시 알림
    this.rules.set('critical-errors', {
      id: 'critical-errors',
      name: '크리티컬 에러 즉시 알림',
      conditions: {
        severity: ErrorSeverity.CRITICAL
      },
      action: {
        type: NotificationType.SYSTEM_ERROR,
        priority: NotificationPriority.CRITICAL,
        escalateAfterMinutes: 5
      },
      enabled: true
    })

    // 이메일 처리 오류 빈발 알림
    this.rules.set('frequent-email-errors', {
      id: 'frequent-email-errors',
      name: '이메일 처리 오류 빈발 알림',
      conditions: {
        category: ErrorCategory.EMAIL,
        frequency: {
          count: 5,
          timeWindowMinutes: 10
        }
      },
      action: {
        type: NotificationType.EMAIL_PROCESSING_ERROR,
        priority: NotificationPriority.HIGH
      },
      enabled: true
    })

    // 미등록 업체 다수 발생
    this.rules.set('multiple-unregistered-companies', {
      id: 'multiple-unregistered-companies',
      name: '미등록 업체 다수 발생',
      conditions: {
        frequency: {
          count: 10,
          timeWindowMinutes: 60
        }
      },
      action: {
        type: NotificationType.UNREGISTERED_COMPANY,
        priority: NotificationPriority.MEDIUM,
        customMessage: '단시간에 많은 미등록 업체에서 이메일이 수신되고 있습니다.'
      },
      enabled: true
    })

    // 알림 발송 실패 연속 발생
    this.rules.set('notification-failure-streak', {
      id: 'notification-failure-streak',
      name: '알림 발송 실패 연속 발생',
      conditions: {
        category: ErrorCategory.NOTIFICATION,
        frequency: {
          count: 3,
          timeWindowMinutes: 5
        }
      },
      action: {
        type: NotificationType.NOTIFICATION_FAILURE,
        priority: NotificationPriority.HIGH,
        escalateAfterMinutes: 10
      },
      enabled: true
    })
  }

  /**
   * 알림 발송
   */
  async sendNotification(
    type: NotificationType,
    data: Record<string, any> = {},
    options: {
      priority?: NotificationPriority
      customTitle?: string
      customMessage?: string
      channels?: AdminNotificationChannel['type'][]
      source?: AdminNotification['source']
    } = {}
  ): Promise<AdminNotification> {
    const template = this.templates.get(type)
    if (!template) {
      throw new Error(`Unknown notification type: ${type}`)
    }

    const notification: AdminNotification = {
      id: this.generateNotificationId(),
      type,
      priority: options.priority || template.priority,
      title: options.customTitle || this.renderTemplate(template.titleTemplate, data),
      message: options.customMessage || this.renderTemplate(template.messageTemplate, data),
      data,
      source: options.source || { component: 'system' },
      timestamp: new Date(),
      channels: options.channels || template.channels,
      retryCount: 0
    }

    // 쓰로틀링 확인
    if (await this.isThrottled(type, data)) {
      logger.debug('Notification throttled', {
        type,
        title: notification.title
      })
      return notification
    }

    // 알림 저장
    this.notifications.set(notification.id, notification)

    try {
      // 각 채널로 알림 발송
      await this.dispatchToChannels(notification)

      logger.info('Admin notification sent', {
        id: notification.id,
        type: notification.type,
        priority: notification.priority,
        channels: notification.channels
      })

    } catch (error) {
      logger.error('Failed to send admin notification', {
        notificationId: notification.id,
        error: error
      })

      notification.retryCount++
      notification.lastRetry = new Date()

      // 재시도 로직
      if (notification.retryCount < 3) {
        setTimeout(() => this.retryNotification(notification.id), 60000 * notification.retryCount)
      }
    }

    return notification
  }

  /**
   * 에러 기반 알림 생성
   */
  async handleError(error: EchoMailError, context: Record<string, any> = {}): Promise<void> {
    // 적용 가능한 규칙 찾기
    const applicableRules = this.findApplicableRules(error, context)

    for (const rule of applicableRules) {
      const data = {
        errorCode: error.code,
        category: error.category,
        severity: error.severity,
        message: error.message,
        timestamp: error.timestamp.toISOString(),
        context: JSON.stringify(context, null, 2),
        component: context.component || 'unknown',
        ...context
      }

      await this.sendNotification(
        rule.action.type,
        data,
        {
          priority: rule.action.priority,
          customMessage: rule.action.customMessage,
          channels: rule.action.channels,
          source: {
            component: context.component || 'error-handler',
            function: context.function,
            error
          }
        }
      )

      // 에스컬레이션 설정
      if (rule.action.escalateAfterMinutes) {
        setTimeout(
          () => this.escalateNotification(error, rule),
          rule.action.escalateAfterMinutes * 60 * 1000
        )
      }
    }
  }

  /**
   * 특정 상황에 대한 사용자 정의 알림
   */
  async sendCustomAlert(
    title: string,
    message: string,
    priority: NotificationPriority = NotificationPriority.MEDIUM,
    channels?: AdminNotificationChannel['type'][],
    data?: Record<string, any>
  ): Promise<AdminNotification> {
    return this.sendNotification(
      NotificationType.CUSTOM_ALERT,
      data,
      {
        priority,
        customTitle: title,
        customMessage: message,
        channels,
        source: { component: 'custom' }
      }
    )
  }

  /**
   * 미등록 업체 알림
   */
  async notifyUnregisteredCompany(companyInfo: {
    email: string
    companyName?: string
    emailCount: number
    firstSeen: Date
    lastSeen: Date
  }): Promise<void> {
    await this.sendNotification(
      NotificationType.UNREGISTERED_COMPANY,
      {
        email: companyInfo.email,
        companyName: companyInfo.companyName || '알 수 없음',
        emailCount: companyInfo.emailCount,
        firstSeen: companyInfo.firstSeen.toISOString(),
        lastSeen: companyInfo.lastSeen.toISOString()
      },
      {
        source: { component: 'unregistered-company-handler' }
      }
    )
  }

  /**
   * 시스템 성능 이슈 알림
   */
  async notifyPerformanceIssue(metric: {
    name: string
    value: number
    threshold: number
    unit: string
  }): Promise<void> {
    await this.sendNotification(
      NotificationType.PERFORMANCE_ISSUE,
      {
        metricName: metric.name,
        currentValue: metric.value,
        threshold: metric.threshold,
        unit: metric.unit,
        overagePercent: Math.round(((metric.value - metric.threshold) / metric.threshold) * 100)
      },
      {
        priority: NotificationPriority.MEDIUM,
        source: { component: 'performance-monitor' }
      }
    )
  }

  /**
   * 채널별 알림 발송
   */
  private async dispatchToChannels(notification: AdminNotification): Promise<void> {
    const promises = notification.channels.map(async (channelId) => {
      const channel = this.channels.get(channelId)
      if (!channel || !channel.enabled) {
        return
      }

      // 우선순위 확인
      if (!channel.priority.includes(notification.priority)) {
        return
      }

      try {
        switch (channel.type) {
          case 'EMAIL':
            await this.sendEmailNotification(notification, channel)
            break
          case 'SLACK':
            await this.sendSlackNotification(notification, channel)
            break
          case 'SMS':
            await this.sendSmsNotification(notification, channel)
            break
          case 'WEBHOOK':
            await this.sendWebhookNotification(notification, channel)
            break
          case 'SYSTEM_LOG':
            await this.sendSystemLogNotification(notification, channel)
            break
        }
      } catch (error) {
        logger.error(`Failed to send notification via ${channel.type}`, {
          notificationId: notification.id,
          channel: channelId,
          error: error
        })
      }
    })

    await Promise.allSettled(promises)
  }

  /**
   * 이메일 알림 발송
   */
  private async sendEmailNotification(
    notification: AdminNotification,
    channel: AdminNotificationChannel
  ): Promise<void> {
    // TODO: 실제 이메일 발송 구현
    logger.info('Email notification sent', {
      notificationId: notification.id,
      to: channel.config.to,
      subject: notification.title
    })
  }

  /**
   * Slack 알림 발송
   */
  private async sendSlackNotification(
    notification: AdminNotification,
    channel: AdminNotificationChannel
  ): Promise<void> {
    if (!channel.config.webhookUrl) {
      throw new Error('Slack webhook URL not configured')
    }

    const payload = {
      channel: channel.config.channel,
      username: channel.config.username,
      icon_emoji: channel.config.iconEmoji,
      text: `*${notification.title}*\n\n${notification.message}`,
      color: this.getPriorityColor(notification.priority)
    }

    // TODO: 실제 Slack 웹훅 호출 구현
    logger.info('Slack notification sent', {
      notificationId: notification.id,
      channel: channel.config.channel
    })
  }

  /**
   * SMS 알림 발송
   */
  private async sendSmsNotification(
    notification: AdminNotification,
    channel: AdminNotificationChannel
  ): Promise<void> {
    const message = `[Echo Mail] ${notification.title}\n\n${notification.message.substring(0, 100)}...`

    // TODO: 실제 SMS 발송 구현
    logger.info('SMS notification sent', {
      notificationId: notification.id,
      to: channel.config.number
    })
  }

  /**
   * 웹훅 알림 발송
   */
  private async sendWebhookNotification(
    notification: AdminNotification,
    channel: AdminNotificationChannel
  ): Promise<void> {
    const payload = {
      id: notification.id,
      type: notification.type,
      priority: notification.priority,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      timestamp: notification.timestamp.toISOString()
    }

    // TODO: 실제 웹훅 호출 구현
    logger.info('Webhook notification sent', {
      notificationId: notification.id,
      url: channel.config.url
    })
  }

  /**
   * 시스템 로그 알림
   */
  private async sendSystemLogNotification(
    notification: AdminNotification,
    channel: AdminNotificationChannel
  ): Promise<void> {
    const logLevel = this.priorityToLogLevel(notification.priority)

    logger[logLevel](`ADMIN ALERT: ${notification.title}`, {
      notificationId: notification.id,
      type: notification.type,
      priority: notification.priority,
      message: notification.message,
      data: notification.data,
      source: notification.source
    })
  }

  /**
   * 유틸리티 메서드들
   */

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private renderTemplate(template: string, data: Record<string, any>): string {
    // 간단한 템플릿 렌더링 (Handlebars 스타일)
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const value = data[key.trim()]
      return value !== undefined ? String(value) : match
    })
  }

  private async isThrottled(type: NotificationType, data: Record<string, any>): Promise<boolean> {
    const template = this.templates.get(type)
    if (!template?.throttleMinutes) {
      return false
    }

    const throttleKey = `${type}_${JSON.stringify(data)}`
    const lastSent = this.throttleCache.get(throttleKey)

    if (lastSent) {
      const minutesSinceLastSent = (Date.now() - lastSent.getTime()) / (1000 * 60)
      if (minutesSinceLastSent < template.throttleMinutes) {
        return true
      }
    }

    this.throttleCache.set(throttleKey, new Date())
    return false
  }

  private findApplicableRules(error: EchoMailError, context: Record<string, any>): NotificationRule[] {
    return Array.from(this.rules.values()).filter(rule => {
      if (!rule.enabled) return false

      const conditions = rule.conditions

      if (conditions.errorCode && conditions.errorCode !== error.code) return false
      if (conditions.category && conditions.category !== error.category) return false
      if (conditions.severity && conditions.severity !== error.severity) return false

      if (conditions.customCondition && !conditions.customCondition(context)) return false

      // 빈도 체크는 별도 구현 필요
      if (conditions.frequency) {
        // TODO: 빈도 기반 조건 체크 구현
      }

      return true
    })
  }

  private async retryNotification(notificationId: string): Promise<void> {
    const notification = this.notifications.get(notificationId)
    if (!notification || notification.retryCount >= 3) {
      return
    }

    try {
      await this.dispatchToChannels(notification)
      logger.info('Notification retry successful', { notificationId })
    } catch (error) {
      notification.retryCount++
      notification.lastRetry = new Date()
      logger.error('Notification retry failed', { notificationId, error })
    }
  }

  private async escalateNotification(error: EchoMailError, rule: NotificationRule): Promise<void> {
    // 에스컬레이션 로직 (더 높은 우선순위 채널로 재발송)
    await this.sendNotification(
      rule.action.type,
      { escalated: true, originalError: error.code },
      {
        priority: NotificationPriority.CRITICAL,
        customTitle: `[ESCALATED] ${error.message}`,
        channels: ['admin-email', 'admin-sms'],
        source: { component: 'escalation' }
      }
    )
  }

  private getPriorityColor(priority: NotificationPriority): string {
    switch (priority) {
      case NotificationPriority.CRITICAL: return 'danger'
      case NotificationPriority.HIGH: return 'warning'
      case NotificationPriority.MEDIUM: return 'good'
      case NotificationPriority.LOW: return '#808080'
      default: return 'good'
    }
  }

  private priorityToLogLevel(priority: NotificationPriority): 'error' | 'warn' | 'info' | 'debug' {
    switch (priority) {
      case NotificationPriority.CRITICAL: return 'error'
      case NotificationPriority.HIGH: return 'error'
      case NotificationPriority.MEDIUM: return 'warn'
      case NotificationPriority.LOW: return 'info'
      default: return 'info'
    }
  }

  /**
   * 알림 관리 메서드들
   */

  async getNotifications(
    options: {
      limit?: number
      offset?: number
      type?: NotificationType
      priority?: NotificationPriority
      acknowledged?: boolean
      resolved?: boolean
    } = {}
  ): Promise<{
    notifications: AdminNotification[]
    total: number
  }> {
    let notifications = Array.from(this.notifications.values())

    // 필터링
    if (options.type) {
      notifications = notifications.filter(n => n.type === options.type)
    }
    if (options.priority) {
      notifications = notifications.filter(n => n.priority === options.priority)
    }
    if (options.acknowledged !== undefined) {
      notifications = notifications.filter(n => !!n.acknowledged === options.acknowledged)
    }
    if (options.resolved !== undefined) {
      notifications = notifications.filter(n => !!n.resolved === options.resolved)
    }

    // 정렬 (최신순)
    notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    // 페이지네이션
    const total = notifications.length
    const start = options.offset || 0
    const end = start + (options.limit || 50)

    return {
      notifications: notifications.slice(start, end),
      total
    }
  }

  async acknowledgeNotification(notificationId: string, acknowledgedBy: string, note?: string): Promise<boolean> {
    const notification = this.notifications.get(notificationId)
    if (!notification) {
      return false
    }

    notification.acknowledged = {
      at: new Date(),
      by: acknowledgedBy,
      note
    }

    logger.info('Notification acknowledged', {
      notificationId,
      acknowledgedBy,
      note
    })

    return true
  }

  async resolveNotification(notificationId: string, resolvedBy: string, solution?: string): Promise<boolean> {
    const notification = this.notifications.get(notificationId)
    if (!notification) {
      return false
    }

    notification.resolved = {
      at: new Date(),
      by: resolvedBy,
      solution
    }

    logger.info('Notification resolved', {
      notificationId,
      resolvedBy,
      solution
    })

    return true
  }

  /**
   * 시스템 상태 헬스체크
   */
  async performHealthCheck(): Promise<{
    healthy: boolean
    checks: Array<{
      name: string
      status: 'healthy' | 'warning' | 'error'
      message: string
      duration: number
    }>
  }> {
    const checks = []
    let overallHealthy = true

    // 채널 상태 확인
    for (const [channelId, channel] of this.channels.entries()) {
      if (!channel.enabled) continue

      const start = Date.now()
      let status: 'healthy' | 'warning' | 'error' = 'healthy'
      let message = 'OK'

      try {
        // TODO: 각 채널별 헬스체크 구현
        switch (channel.type) {
          case 'EMAIL':
            // SMTP 연결 테스트
            break
          case 'SLACK':
            // Slack API 연결 테스트
            break
          case 'SMS':
            // SMS API 연결 테스트
            break
        }
      } catch (error) {
        status = 'error'
        message = error instanceof Error ? error.message : 'Unknown error'
        overallHealthy = false
      }

      checks.push({
        name: `${channel.type} Channel (${channelId})`,
        status,
        message,
        duration: Date.now() - start
      })
    }

    return {
      healthy: overallHealthy,
      checks
    }
  }
}

// 싱글톤 인스턴스 내보내기
export const adminNotificationSystem = AdminNotificationSystem.getInstance()