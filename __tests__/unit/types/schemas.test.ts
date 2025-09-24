/**
 * Unit Tests for Type Definitions and Schema Validation
 * 타입 정의 및 스키마 검증 단위 테스트
 */

import { z } from 'zod'
import {
  Company,
  Contact,
  CreateCompanyDto,
  CreateContactDto,
  DeliveryRule,
  Holiday,
  EmailLog,
  EmailAttachment,
  NotificationLog,
  MessageTemplate,
  User,
  DashboardStats,
  ValidationError,
  FormState,
  EmailStatus,
  NotificationType,
  NotificationStatus,
  UserRole
} from '@/types'

describe('Type Definitions Validation', () => {
  describe('Company and Contact Types', () => {
    it('should validate Company type structure', () => {
      const companySchema = z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().email(),
        region: z.string(),
        isActive: z.boolean(),
        createdAt: z.date(),
        updatedAt: z.date(),
        contacts: z.array(z.any()).optional()
      })

      const validCompany: Company = {
        id: '1',
        name: '테스트 회사',
        email: 'test@company.com',
        region: '서울',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      expect(() => companySchema.parse(validCompany)).not.toThrow()
    })

    it('should validate Contact type structure', () => {
      const contactSchema = z.object({
        id: z.string(),
        name: z.string(),
        phone: z.string(),
        email: z.string().email().optional(),
        position: z.string().optional(),
        isActive: z.boolean(),
        smsEnabled: z.boolean(),
        kakaoEnabled: z.boolean(),
        companyId: z.string(),
        company: z.any().optional(),
        createdAt: z.date(),
        updatedAt: z.date()
      })

      const validContact: Contact = {
        id: '1',
        name: '김철수',
        phone: '010-1234-5678',
        email: 'kim@company.com',
        position: '매니저',
        isActive: true,
        smsEnabled: true,
        kakaoEnabled: false,
        companyId: 'comp1',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      expect(() => contactSchema.parse(validContact)).not.toThrow()
    })

    it('should validate CreateCompanyDto structure', () => {
      const createCompanySchema = z.object({
        name: z.string().min(1).max(100),
        email: z.string().email(),
        region: z.string().min(1).max(50),
        contacts: z.array(z.any()).optional()
      })

      const validCreateCompanyDto: CreateCompanyDto = {
        name: '새로운 회사',
        email: 'new@company.com',
        region: '부산',
        contacts: [
          {
            name: '담당자',
            phone: '010-9999-8888',
            position: '대리'
          }
        ]
      }

      expect(() => createCompanySchema.parse(validCreateCompanyDto)).not.toThrow()
    })

    it('should validate CreateContactDto structure', () => {
      const createContactSchema = z.object({
        name: z.string().min(1).max(50),
        phone: z.string().regex(/^010-\d{4}-\d{4}$/),
        email: z.string().email().optional(),
        position: z.string().optional(),
        smsEnabled: z.boolean().optional(),
        kakaoEnabled: z.boolean().optional()
      })

      const validCreateContactDto: CreateContactDto = {
        name: '새 담당자',
        phone: '010-5555-5555',
        email: 'contact@company.com',
        position: '과장',
        smsEnabled: true,
        kakaoEnabled: true
      }

      expect(() => createContactSchema.parse(validCreateContactDto)).not.toThrow()
    })
  })

  describe('Delivery Rule Types', () => {
    it('should validate DeliveryRule type structure', () => {
      const deliveryRuleSchema = z.object({
        id: z.string(),
        region: z.string(),
        morningCutoff: z.string(),
        afternoonCutoff: z.string(),
        morningDeliveryDays: z.number().int().min(0),
        afternoonDeliveryDays: z.number().int().min(0),
        excludeWeekends: z.boolean(),
        excludeHolidays: z.boolean(),
        isActive: z.boolean(),
        createdAt: z.date(),
        updatedAt: z.date()
      })

      const validDeliveryRule: DeliveryRule = {
        id: 'rule1',
        region: '서울',
        morningCutoff: '11:00',
        afternoonCutoff: '15:00',
        morningDeliveryDays: 1,
        afternoonDeliveryDays: 2,
        excludeWeekends: true,
        excludeHolidays: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      expect(() => deliveryRuleSchema.parse(validDeliveryRule)).not.toThrow()
    })

    it('should validate Holiday type structure', () => {
      const holidaySchema = z.object({
        id: z.string(),
        date: z.date(),
        name: z.string(),
        isRecurring: z.boolean(),
        createdAt: z.date(),
        updatedAt: z.date()
      })

      const validHoliday: Holiday = {
        id: 'holiday1',
        date: new Date('2024-01-01'),
        name: '신정',
        isRecurring: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      expect(() => holidaySchema.parse(validHoliday)).not.toThrow()
    })
  })

  describe('Email Types', () => {
    it('should validate EmailStatus enum values', () => {
      const validStatuses: EmailStatus[] = [
        'RECEIVED',
        'PROCESSED',
        'MATCHED',
        'FAILED',
        'IGNORED'
      ]

      const emailStatusSchema = z.enum(['RECEIVED', 'PROCESSED', 'MATCHED', 'FAILED', 'IGNORED'])

      validStatuses.forEach(status => {
        expect(() => emailStatusSchema.parse(status)).not.toThrow()
      })
    })

    it('should validate EmailLog type structure', () => {
      const emailLogSchema = z.object({
        id: z.string(),
        messageId: z.string(),
        subject: z.string(),
        sender: z.string().email(),
        recipient: z.string().email(),
        receivedAt: z.date(),
        hasAttachment: z.boolean(),
        attachments: z.array(z.any()).optional(),
        status: z.enum(['RECEIVED', 'PROCESSED', 'MATCHED', 'FAILED', 'IGNORED']),
        processedAt: z.date().optional(),
        companyId: z.string().optional(),
        company: z.any().optional(),
        errorMessage: z.string().optional(),
        createdAt: z.date(),
        updatedAt: z.date()
      })

      const validEmailLog: EmailLog = {
        id: 'email1',
        messageId: 'msg123',
        subject: '발주 요청',
        sender: 'sender@company.com',
        recipient: 'system@echomail.com',
        receivedAt: new Date(),
        hasAttachment: true,
        status: 'PROCESSED',
        processedAt: new Date(),
        companyId: 'comp1',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      expect(() => emailLogSchema.parse(validEmailLog)).not.toThrow()
    })

    it('should validate EmailAttachment type structure', () => {
      const emailAttachmentSchema = z.object({
        filename: z.string(),
        contentType: z.string(),
        size: z.number().min(0),
        url: z.string().optional()
      })

      const validEmailAttachment: EmailAttachment = {
        filename: 'order.pdf',
        contentType: 'application/pdf',
        size: 1024000,
        url: 'https://storage.example.com/files/order.pdf'
      }

      expect(() => emailAttachmentSchema.parse(validEmailAttachment)).not.toThrow()
    })
  })

  describe('Notification Types', () => {
    it('should validate NotificationType enum values', () => {
      const validTypes: NotificationType[] = [
        'SMS',
        'KAKAO_ALIMTALK',
        'KAKAO_FRIENDTALK'
      ]

      const notificationTypeSchema = z.enum(['SMS', 'KAKAO_ALIMTALK', 'KAKAO_FRIENDTALK'])

      validTypes.forEach(type => {
        expect(() => notificationTypeSchema.parse(type)).not.toThrow()
      })
    })

    it('should validate NotificationStatus enum values', () => {
      const validStatuses: NotificationStatus[] = [
        'PENDING',
        'SENDING',
        'SENT',
        'DELIVERED',
        'FAILED',
        'CANCELLED'
      ]

      const notificationStatusSchema = z.enum([
        'PENDING',
        'SENDING',
        'SENT',
        'DELIVERED',
        'FAILED',
        'CANCELLED'
      ])

      validStatuses.forEach(status => {
        expect(() => notificationStatusSchema.parse(status)).not.toThrow()
      })
    })

    it('should validate NotificationLog type structure', () => {
      const notificationLogSchema = z.object({
        id: z.string(),
        type: z.enum(['SMS', 'KAKAO_ALIMTALK', 'KAKAO_FRIENDTALK']),
        recipient: z.string(),
        message: z.string(),
        status: z.enum(['PENDING', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED']),
        sentAt: z.date().optional(),
        deliveredAt: z.date().optional(),
        retryCount: z.number().int().min(0),
        maxRetries: z.number().int().min(0),
        nextRetryAt: z.date().optional(),
        companyId: z.string().optional(),
        company: z.any().optional(),
        emailLogId: z.string().optional(),
        emailLog: z.any().optional(),
        errorMessage: z.string().optional(),
        cost: z.number().min(0).optional(),
        createdAt: z.date(),
        updatedAt: z.date()
      })

      const validNotificationLog: NotificationLog = {
        id: 'notif1',
        type: 'SMS',
        recipient: '010-1234-5678',
        message: '새로운 발주가 도착했습니다.',
        status: 'SENT',
        sentAt: new Date(),
        deliveredAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
        companyId: 'comp1',
        emailLogId: 'email1',
        cost: 15,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      expect(() => notificationLogSchema.parse(validNotificationLog)).not.toThrow()
    })
  })

  describe('Template Types', () => {
    it('should validate MessageTemplate type structure', () => {
      const messageTemplateSchema = z.object({
        id: z.string(),
        name: z.string(),
        type: z.enum(['SMS', 'KAKAO_ALIMTALK', 'KAKAO_FRIENDTALK']),
        subject: z.string().optional(),
        content: z.string(),
        variables: z.array(z.string()).optional(),
        isActive: z.boolean(),
        isDefault: z.boolean(),
        createdAt: z.date(),
        updatedAt: z.date()
      })

      const validMessageTemplate: MessageTemplate = {
        id: 'template1',
        name: 'SMS 발주 알림',
        type: 'SMS',
        content: '{{company_name}}에서 새로운 발주가 도착했습니다.',
        variables: ['company_name'],
        isActive: true,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      expect(() => messageTemplateSchema.parse(validMessageTemplate)).not.toThrow()
    })
  })

  describe('User Types', () => {
    it('should validate UserRole enum values', () => {
      const validRoles: UserRole[] = ['ADMIN', 'OPERATOR', 'VIEWER']

      const userRoleSchema = z.enum(['ADMIN', 'OPERATOR', 'VIEWER'])

      validRoles.forEach(role => {
        expect(() => userRoleSchema.parse(role)).not.toThrow()
      })
    })

    it('should validate User type structure', () => {
      const userSchema = z.object({
        id: z.string(),
        email: z.string().email(),
        name: z.string().optional(),
        role: z.enum(['ADMIN', 'OPERATOR', 'VIEWER']),
        isActive: z.boolean(),
        lastLoginAt: z.date().optional(),
        emailVerified: z.date().optional(),
        image: z.string().optional(),
        createdAt: z.date(),
        updatedAt: z.date()
      })

      const validUser: User = {
        id: 'user1',
        email: 'admin@echomail.com',
        name: '관리자',
        role: 'ADMIN',
        isActive: true,
        lastLoginAt: new Date(),
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }

      expect(() => userSchema.parse(validUser)).not.toThrow()
    })
  })

  describe('Dashboard Types', () => {
    it('should validate DashboardStats type structure', () => {
      const dashboardStatsSchema = z.object({
        totalCompanies: z.number().int().min(0),
        activeCompanies: z.number().int().min(0),
        totalEmailsToday: z.number().int().min(0),
        totalNotificationsToday: z.number().int().min(0),
        notificationSuccessRate: z.number().min(0).max(100),
        averageProcessingTime: z.number().min(0),
        recentActivities: z.array(z.any())
      })

      const validDashboardStats: DashboardStats = {
        totalCompanies: 150,
        activeCompanies: 145,
        totalEmailsToday: 24,
        totalNotificationsToday: 48,
        notificationSuccessRate: 98.5,
        averageProcessingTime: 1.2,
        recentActivities: [
          {
            id: 'act1',
            type: 'email_received',
            title: '새 이메일 수신',
            timestamp: new Date()
          }
        ]
      }

      expect(() => dashboardStatsSchema.parse(validDashboardStats)).not.toThrow()
    })
  })

  describe('Form Validation Types', () => {
    it('should validate ValidationError type structure', () => {
      const validationErrorSchema = z.object({
        field: z.string(),
        message: z.string()
      })

      const validValidationError: ValidationError = {
        field: 'email',
        message: '올바른 이메일 형식이 아닙니다'
      }

      expect(() => validationErrorSchema.parse(validValidationError)).not.toThrow()
    })

    it('should validate FormState type structure', () => {
      const formStateSchema = z.object({
        data: z.any(),
        errors: z.array(z.object({
          field: z.string(),
          message: z.string()
        })),
        isSubmitting: z.boolean(),
        isValid: z.boolean()
      })

      const validFormState: FormState = {
        data: { name: 'Test', email: 'test@example.com' },
        errors: [],
        isSubmitting: false,
        isValid: true
      }

      expect(() => formStateSchema.parse(validFormState)).not.toThrow()
    })
  })
})

describe('Schema Composition and Relationships', () => {
  describe('Company with Contacts relationship', () => {
    it('should validate company with nested contacts', () => {
      const companyWithContactsSchema = z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().email(),
        region: z.string(),
        isActive: z.boolean(),
        contacts: z.array(z.object({
          id: z.string(),
          name: z.string(),
          phone: z.string().regex(/^010-\d{4}-\d{4}$/),
          email: z.string().email().optional(),
          position: z.string().optional(),
          isActive: z.boolean(),
          smsEnabled: z.boolean(),
          kakaoEnabled: z.boolean()
        })).optional()
      })

      const companyWithContacts = {
        id: '1',
        name: '테스트 회사',
        email: 'test@company.com',
        region: '서울',
        isActive: true,
        contacts: [
          {
            id: '1',
            name: '김철수',
            phone: '010-1234-5678',
            email: 'kim@company.com',
            position: '매니저',
            isActive: true,
            smsEnabled: true,
            kakaoEnabled: false
          },
          {
            id: '2',
            name: '이영희',
            phone: '010-9999-8888',
            position: '대리',
            isActive: true,
            smsEnabled: false,
            kakaoEnabled: true
          }
        ]
      }

      expect(() => companyWithContactsSchema.parse(companyWithContacts)).not.toThrow()
    })
  })

  describe('Email with Notifications relationship', () => {
    it('should validate email log with related notifications', () => {
      const emailWithNotificationsSchema = z.object({
        id: z.string(),
        messageId: z.string(),
        subject: z.string(),
        sender: z.string().email(),
        status: z.enum(['RECEIVED', 'PROCESSED', 'MATCHED', 'FAILED', 'IGNORED']),
        notifications: z.array(z.object({
          id: z.string(),
          type: z.enum(['SMS', 'KAKAO_ALIMTALK', 'KAKAO_FRIENDTALK']),
          recipient: z.string(),
          status: z.enum(['PENDING', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED'])
        })).optional()
      })

      const emailWithNotifications = {
        id: 'email1',
        messageId: 'msg123',
        subject: '발주 요청',
        sender: 'sender@company.com',
        status: 'PROCESSED' as EmailStatus,
        notifications: [
          {
            id: 'notif1',
            type: 'SMS' as NotificationType,
            recipient: '010-1234-5678',
            status: 'SENT' as NotificationStatus
          },
          {
            id: 'notif2',
            type: 'KAKAO_ALIMTALK' as NotificationType,
            recipient: '010-9999-8888',
            status: 'DELIVERED' as NotificationStatus
          }
        ]
      }

      expect(() => emailWithNotificationsSchema.parse(emailWithNotifications)).not.toThrow()
    })
  })
})

describe('Edge Cases and Boundary Testing', () => {
  describe('String length boundaries', () => {
    it('should validate maximum length constraints', () => {
      const schemas = [
        { schema: z.string().max(50), validLength: 50, invalidLength: 51 },
        { schema: z.string().max(100), validLength: 100, invalidLength: 101 },
        { schema: z.string().max(255), validLength: 255, invalidLength: 256 }
      ]

      schemas.forEach(({ schema, validLength, invalidLength }) => {
        expect(() => schema.parse('A'.repeat(validLength))).not.toThrow()
        expect(() => schema.parse('A'.repeat(invalidLength))).toThrow()
      })
    })

    it('should validate minimum length constraints', () => {
      const schemas = [
        { schema: z.string().min(1), validLength: 1, invalidLength: 0 },
        { schema: z.string().min(3), validLength: 3, invalidLength: 2 },
        { schema: z.string().min(10), validLength: 10, invalidLength: 9 }
      ]

      schemas.forEach(({ schema, validLength, invalidLength }) => {
        expect(() => schema.parse('A'.repeat(validLength))).not.toThrow()
        expect(() => schema.parse('A'.repeat(invalidLength))).toThrow()
      })
    })
  })

  describe('Number range boundaries', () => {
    it('should validate integer constraints', () => {
      const integerSchema = z.number().int().min(0).max(100)

      const validValues = [0, 1, 50, 100]
      const invalidValues = [-1, 101, 1.5, NaN, Infinity]

      validValues.forEach(value => {
        expect(() => integerSchema.parse(value)).not.toThrow()
      })

      invalidValues.forEach(value => {
        expect(() => integerSchema.parse(value)).toThrow()
      })
    })
  })

  describe('Date validation', () => {
    it('should validate date objects and ISO strings', () => {
      const dateSchema = z.date()

      const validDates = [
        new Date(),
        new Date('2024-01-01'),
        new Date('2024-12-31T23:59:59Z')
      ]

      const invalidDates = [
        'invalid-date',
        null,
        undefined,
        123456789,
        {}
      ]

      validDates.forEach(date => {
        expect(() => dateSchema.parse(date)).not.toThrow()
      })

      invalidDates.forEach(date => {
        expect(() => dateSchema.parse(date)).toThrow()
      })
    })
  })

  describe('Optional field handling', () => {
    it('should handle optional fields correctly', () => {
      const optionalFieldSchema = z.object({
        required: z.string(),
        optional: z.string().optional(),
        nullable: z.string().nullable().optional(),
        optionalNullable: z.string().optional().nullable()
      })

      const testCases = [
        {
          data: { required: 'test' },
          shouldPass: true
        },
        {
          data: { required: 'test', optional: 'value' },
          shouldPass: true
        },
        {
          data: { required: 'test', nullable: null },
          shouldPass: true
        },
        {
          data: { required: 'test', nullable: 'value' },
          shouldPass: true
        },
        {
          data: { required: 'test', optionalNullable: null },
          shouldPass: true
        },
        {
          data: { required: 'test', optionalNullable: 'value' },
          shouldPass: true
        },
        {
          data: {},
          shouldPass: false // missing required field
        }
      ]

      testCases.forEach(({ data, shouldPass }) => {
        if (shouldPass) {
          expect(() => optionalFieldSchema.parse(data)).not.toThrow()
        } else {
          expect(() => optionalFieldSchema.parse(data)).toThrow()
        }
      })
    })
  })
})