// =============================================================================
// 공통 타입 정의
// =============================================================================

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// =============================================================================
// 업체 관련 타입
// =============================================================================

export interface Company {
  id: string
  name: string
  email: string
  region: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  contacts?: Contact[]
}

export interface Contact {
  id: string
  name: string
  phone: string
  email?: string
  position?: string
  isActive: boolean
  smsEnabled: boolean
  kakaoEnabled: boolean
  companyId: string
  company?: Company
  createdAt: Date
  updatedAt: Date
}

export interface CreateCompanyDto {
  name: string
  email: string
  region: string
  contacts?: CreateContactDto[]
}

export interface CreateContactDto {
  name: string
  phone: string
  email?: string
  position?: string
  smsEnabled?: boolean
  kakaoEnabled?: boolean
}

// =============================================================================
// 납품 규칙 관련 타입
// =============================================================================

export interface DeliveryRule {
  id: string
  region: string
  morningCutoff: string
  afternoonCutoff: string
  morningDeliveryDays: number
  afternoonDeliveryDays: number
  excludeWeekends: boolean
  excludeHolidays: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Holiday {
  id: string
  date: Date
  name: string
  isRecurring: boolean
  createdAt: Date
  updatedAt: Date
}

export interface DeliveryDate {
  date: string
  time: '오전' | '오후'
  estimatedDate: Date
}

// =============================================================================
// 메일 관련 타입
// =============================================================================

export type EmailStatus = 'RECEIVED' | 'PROCESSED' | 'MATCHED' | 'FAILED' | 'IGNORED'

export interface EmailLog {
  id: string
  messageId: string
  subject: string
  sender: string
  recipient: string
  receivedAt: Date
  hasAttachment: boolean
  attachments?: EmailAttachment[]
  status: EmailStatus
  processedAt?: Date
  companyId?: string
  company?: Company
  errorMessage?: string
  createdAt: Date
  updatedAt: Date
}

export interface EmailAttachment {
  filename: string
  contentType: string
  size: number
  url?: string
}

// =============================================================================
// 알림 관련 타입
// =============================================================================

export type NotificationType = 'SMS' | 'KAKAO_ALIMTALK' | 'KAKAO_FRIENDTALK'
export type NotificationStatus =
  | 'PENDING'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED'
  | 'CANCELLED'

export interface NotificationLog {
  id: string
  type: NotificationType
  recipient: string
  message: string
  status: NotificationStatus
  sentAt?: Date
  deliveredAt?: Date
  retryCount: number
  maxRetries: number
  nextRetryAt?: Date
  companyId?: string
  company?: Company
  emailLogId?: string
  emailLog?: EmailLog
  errorMessage?: string
  cost?: number
  createdAt: Date
  updatedAt: Date
}

export interface SendNotificationDto {
  type: NotificationType
  recipient: string
  message: string
  companyId?: string
  emailLogId?: string
  templateData?: Record<string, any>
}

// =============================================================================
// 메시지 템플릿 관련 타입
// =============================================================================

export interface MessageTemplate {
  id: string
  name: string
  type: NotificationType
  subject?: string
  content: string
  variables?: string[]
  isActive: boolean
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CreateTemplateDto {
  name: string
  type: NotificationType
  subject?: string
  content: string
  variables?: string[]
  isDefault?: boolean
}

// =============================================================================
// 시스템 설정 관련 타입
// =============================================================================

export interface SystemConfig {
  id: string
  key: string
  value: string
  description?: string
  category: string
  createdAt: Date
  updatedAt: Date
}

// =============================================================================
// 사용자 관련 타입
// =============================================================================

export type UserRole = 'ADMIN' | 'OPERATOR' | 'VIEWER'

export interface User {
  id: string
  email: string
  name?: string
  role: UserRole
  isActive: boolean
  lastLoginAt?: Date
  emailVerified?: Date
  image?: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateUserDto {
  email: string
  name?: string
  password: string
  role?: UserRole
}

export interface LoginDto {
  email: string
  password: string
}

export interface AuthResponse {
  user: User
  token: string
  refreshToken?: string
}

// =============================================================================
// 대시보드 관련 타입
// =============================================================================

export interface DashboardStats {
  totalCompanies: number
  activeCompanies: number
  totalEmailsToday: number
  totalNotificationsToday: number
  notificationSuccessRate: number
  averageProcessingTime: number
  recentActivities: Activity[]
}

export interface Activity {
  id: string
  type: 'email_received' | 'notification_sent' | 'company_added' | 'error'
  title: string
  description?: string
  timestamp: Date
  metadata?: Record<string, any>
}

// =============================================================================
// 리포트 관련 타입
// =============================================================================

export interface DailyReport {
  date: string
  emails: {
    total: number
    byStatus: Record<EmailStatus, number>
  }
  notifications: {
    total: number
    byType: Record<NotificationType, number>
    byStatus: Record<NotificationStatus, number>
  }
  topCompanies: Array<{
    name: string
    count: number
  }>
  cost: {
    sms: number
    kakao: number
    total: number
  }
}

// =============================================================================
// 폼 검증 관련 타입
// =============================================================================

export interface ValidationError {
  field: string
  message: string
}

export interface FormState<T = any> {
  data: T
  errors: ValidationError[]
  isSubmitting: boolean
  isValid: boolean
}
