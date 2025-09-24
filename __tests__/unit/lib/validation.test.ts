/**
 * Unit Tests for Data Validation System
 * 데이터 검증 시스템 단위 테스트
 */

import { z } from 'zod'
import { NextResponse } from 'next/server'
import {
  phoneSchema,
  emailSchema,
  nameSchema,
  companyNameSchema,
  regionSchema,
  paginationSchema,
  searchSchema,
  createValidationErrorResponse,
  createErrorResponse,
  createSuccessResponse,
  createPaginatedResponse,
  parseAndValidate,
  parseQueryParams,
  validators,
  sanitizers
} from '@/lib/utils/validation'

// Mock Next.js NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, options) => ({
      data,
      status: options?.status || 200,
      json: () => Promise.resolve(data)
    }))
  }
}))

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn()
  }
}))

describe('Validation Schemas', () => {
  describe('phoneSchema', () => {
    it('should validate correct phone number format', () => {
      const validPhones = ['010-1234-5678', '010-0000-0000', '010-9999-9999']

      validPhones.forEach(phone => {
        expect(() => phoneSchema.parse(phone)).not.toThrow()
      })
    })

    it('should reject invalid phone number formats', () => {
      const invalidPhones = [
        '01012345678',      // No hyphens
        '010-123-5678',     // Wrong format
        '02-1234-5678',     // Not 010
        '010-12345-5678',   // Too many digits
        '010-123-5678',     // Too few digits
        '010-abcd-5678',    // Letters
        '',                 // Empty
        null,               // Null
        undefined           // Undefined
      ]

      invalidPhones.forEach(phone => {
        expect(() => phoneSchema.parse(phone)).toThrow()
      })
    })
  })

  describe('emailSchema', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.kr',
        'admin+tag@company.com',
        'a@b.co'
      ]

      validEmails.forEach(email => {
        expect(() => emailSchema.parse(email)).not.toThrow()
      })
    })

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user@domain',
        'user..double.dot@domain.com',
        '',
        null,
        undefined
      ]

      invalidEmails.forEach(email => {
        expect(() => emailSchema.parse(email)).toThrow()
      })
    })
  })

  describe('nameSchema', () => {
    it('should validate correct names', () => {
      const validNames = ['김철수', 'John Doe', 'a', 'A'.repeat(50)]

      validNames.forEach(name => {
        expect(() => nameSchema.parse(name)).not.toThrow()
      })
    })

    it('should reject invalid names', () => {
      const invalidNames = [
        '',                    // Empty
        'A'.repeat(51),        // Too long
        null,                  // Null
        undefined              // Undefined
      ]

      invalidNames.forEach(name => {
        expect(() => nameSchema.parse(name)).toThrow()
      })
    })
  })

  describe('companyNameSchema', () => {
    it('should validate correct company names', () => {
      const validNames = [
        '주식회사 테스트',
        '(주)테스트',
        'Test Company',
        'a',
        'A'.repeat(100)
      ]

      validNames.forEach(name => {
        expect(() => companyNameSchema.parse(name)).not.toThrow()
      })
    })

    it('should reject invalid company names', () => {
      const invalidNames = [
        '',                    // Empty
        'A'.repeat(101),       // Too long
        null,                  // Null
        undefined              // Undefined
      ]

      invalidNames.forEach(name => {
        expect(() => companyNameSchema.parse(name)).toThrow()
      })
    })
  })

  describe('regionSchema', () => {
    it('should validate correct regions', () => {
      const validRegions = ['서울', '부산', '경기도', 'A'.repeat(50)]

      validRegions.forEach(region => {
        expect(() => regionSchema.parse(region)).not.toThrow()
      })
    })

    it('should reject invalid regions', () => {
      const invalidRegions = [
        '',                    // Empty
        'A'.repeat(51),        // Too long
        null,                  // Null
        undefined              // Undefined
      ]

      invalidRegions.forEach(region => {
        expect(() => regionSchema.parse(region)).toThrow()
      })
    })
  })

  describe('paginationSchema', () => {
    it('should validate correct pagination parameters', () => {
      const validParams = [
        { page: 1, limit: 10 },
        { page: 100, limit: 100 },
        { page: 1, limit: 1 }
      ]

      validParams.forEach(params => {
        expect(() => paginationSchema.parse(params)).not.toThrow()
      })
    })

    it('should apply default values', () => {
      const result = paginationSchema.parse({})
      expect(result.page).toBe(1)
      expect(result.limit).toBe(10)
    })

    it('should reject invalid pagination parameters', () => {
      const invalidParams = [
        { page: 0, limit: 10 },     // Page too small
        { page: 1, limit: 0 },      // Limit too small
        { page: 1, limit: 101 },    // Limit too large
        { page: -1, limit: 10 },    // Negative page
        { page: 1.5, limit: 10 },   // Non-integer page
        { page: 1, limit: 10.5 }    // Non-integer limit
      ]

      invalidParams.forEach(params => {
        expect(() => paginationSchema.parse(params)).toThrow()
      })
    })
  })

  describe('searchSchema', () => {
    it('should validate correct search parameters', () => {
      const validParams = [
        { search: 'test', isActive: 'true' },
        { search: '', isActive: 'false' },
        { search: undefined, isActive: undefined },
        {}
      ]

      validParams.forEach(params => {
        expect(() => searchSchema.parse(params)).not.toThrow()
      })
    })

    it('should reject invalid search parameters', () => {
      const invalidParams = [
        { isActive: 'invalid' },    // Invalid enum value
        { isActive: true },         // Boolean instead of string
        { isActive: 1 }             // Number instead of string
      ]

      invalidParams.forEach(params => {
        expect(() => searchSchema.parse(params)).toThrow()
      })
    })
  })
})

describe('Response Generators', () => {
  describe('createValidationErrorResponse', () => {
    it('should create proper validation error response', () => {
      const schema = z.object({
        name: z.string().min(1),
        age: z.number().min(0)
      })

      let error: z.ZodError
      try {
        schema.parse({ name: '', age: -1 })
      } catch (e) {
        error = e as z.ZodError
      }

      const response = createValidationErrorResponse(error!)

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          success: false,
          error: '입력값이 올바르지 않습니다.',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: expect.any(String),
              message: expect.any(String),
              code: expect.any(String)
            })
          ])
        },
        { status: 400 }
      )
    })
  })

  describe('createErrorResponse', () => {
    it('should create error response with default status', () => {
      const message = 'Test error'

      createErrorResponse(message)

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          success: false,
          error: message
        },
        { status: 500 }
      )
    })

    it('should create error response with custom status and details', () => {
      const message = 'Custom error'
      const statusCode = 404
      const details = { field: 'id', value: '123' }

      createErrorResponse(message, statusCode, details)

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          success: false,
          error: message,
          details
        },
        { status: statusCode }
      )
    })
  })

  describe('createSuccessResponse', () => {
    it('should create success response with defaults', () => {
      createSuccessResponse()

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          success: true
        },
        { status: 200 }
      )
    })

    it('should create success response with data and message', () => {
      const data = { id: '123', name: 'Test' }
      const message = 'Success!'
      const statusCode = 201

      createSuccessResponse(data, message, statusCode)

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          success: true,
          data,
          message
        },
        { status: statusCode }
      )
    })
  })

  describe('createPaginatedResponse', () => {
    it('should create paginated response', () => {
      const data = [{ id: '1' }, { id: '2' }]
      const pagination = { page: 1, limit: 10, total: 25 }

      createPaginatedResponse(data, pagination)

      expect(NextResponse.json).toHaveBeenCalledWith({
        success: true,
        data,
        pagination: {
          page: 1,
          limit: 10,
          total: 25,
          pages: 3
        }
      })
    })
  })
})

describe('Parsing and Validation Helpers', () => {
  describe('parseAndValidate', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      age: z.number().min(0)
    })

    it('should parse and validate valid data', async () => {
      const mockRequest = {
        json: jest.fn().mockResolvedValue({ name: 'Test', age: 25 })
      } as any

      const result = await parseAndValidate(mockRequest, testSchema)

      expect('data' in result).toBe(true)
      if ('data' in result) {
        expect(result.data).toEqual({ name: 'Test', age: 25 })
      }
    })

    it('should handle validation errors', async () => {
      const mockRequest = {
        json: jest.fn().mockResolvedValue({ name: '', age: -1 })
      } as any

      const result = await parseAndValidate(mockRequest, testSchema)

      expect('error' in result).toBe(true)
      expect(result.error).toBeDefined()
    })

    it('should handle JSON parsing errors', async () => {
      const mockRequest = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as any

      const result = await parseAndValidate(mockRequest, testSchema)

      expect('error' in result).toBe(true)
      expect(result.error).toBeDefined()
    })
  })

  describe('parseQueryParams', () => {
    it('should parse valid query parameters', () => {
      const searchParams = new URLSearchParams('page=2&limit=20&search=test&isActive=true')
      const schema = z.object({
        page: z.number(),
        limit: z.number(),
        search: z.string().optional(),
        isActive: z.boolean().optional()
      })

      const result = parseQueryParams(searchParams, schema)

      expect('data' in result).toBe(true)
      if ('data' in result) {
        expect(result.data).toEqual({
          page: 2,
          limit: 20,
          search: 'test',
          isActive: true
        })
      }
    })

    it('should handle type conversion', () => {
      const searchParams = new URLSearchParams('count=10&active=false&name=test')
      const schema = z.object({
        count: z.number(),
        active: z.boolean(),
        name: z.string()
      })

      const result = parseQueryParams(searchParams, schema)

      expect('data' in result).toBe(true)
      if ('data' in result) {
        expect(result.data).toEqual({
          count: 10,
          active: false,
          name: 'test'
        })
      }
    })

    it('should handle validation errors', () => {
      const searchParams = new URLSearchParams('page=invalid')
      const schema = z.object({
        page: z.number()
      })

      const result = parseQueryParams(searchParams, schema)

      expect('error' in result).toBe(true)
      expect(result.error).toBeDefined()
    })
  })
})

describe('Field Validators', () => {
  describe('isValidPhoneNumber', () => {
    it('should validate correct phone numbers', () => {
      const validPhones = ['010-1234-5678', '010-0000-0000', '010-9999-9999']

      validPhones.forEach(phone => {
        expect(validators.isValidPhoneNumber(phone)).toBe(true)
      })
    })

    it('should reject invalid phone numbers', () => {
      const invalidPhones = [
        '01012345678',      // No hyphens
        '010-123-5678',     // Wrong format
        '02-1234-5678',     // Not 010
        '010-12345-5678',   // Too many digits
        '',                 // Empty
        'abc-defg-hijk'     // Letters
      ]

      invalidPhones.forEach(phone => {
        expect(validators.isValidPhoneNumber(phone)).toBe(false)
      })
    })
  })

  describe('isValidEmail', () => {
    it('should validate correct emails', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.kr',
        'admin+tag@company.com'
      ]

      validEmails.forEach(email => {
        expect(validators.isValidEmail(email)).toBe(true)
      })
    })

    it('should reject invalid emails', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user@domain',
        ''
      ]

      invalidEmails.forEach(email => {
        expect(validators.isValidEmail(email)).toBe(false)
      })
    })
  })

  describe('isValidCompanyName', () => {
    it('should validate correct company names', () => {
      const validNames = [
        '주식회사 테스트',
        '(주)테스트컴퍼니',
        'Test Company Ltd.',
        'ABC-123_Company',
        '테스트[주식회사]'
      ]

      validNames.forEach(name => {
        expect(validators.isValidCompanyName(name)).toBe(true)
      })
    })

    it('should reject invalid company names', () => {
      const invalidNames = [
        '',                          // Empty
        'A'.repeat(101),            // Too long
        'Company@#$%',              // Invalid characters
        'Test<>Company'             // Invalid characters
      ]

      invalidNames.forEach(name => {
        expect(validators.isValidCompanyName(name)).toBe(false)
      })
    })
  })

  describe('isValidName', () => {
    it('should validate correct names', () => {
      const validNames = [
        '김철수',
        'John Doe',
        '이 영희',
        'Mary Jane Smith'
      ]

      validNames.forEach(name => {
        expect(validators.isValidName(name)).toBe(true)
      })
    })

    it('should reject invalid names', () => {
      const invalidNames = [
        '',                          // Empty
        'A'.repeat(51),             // Too long
        'John123',                  // Numbers
        'John@Doe',                 // Special characters
        'John_Doe'                  // Underscore
      ]

      invalidNames.forEach(name => {
        expect(validators.isValidName(name)).toBe(false)
      })
    })
  })
})

describe('Data Sanitizers', () => {
  describe('formatPhoneNumber', () => {
    it('should format valid 11-digit phone numbers', () => {
      const testCases = [
        { input: '01012345678', expected: '010-1234-5678' },
        { input: '010 1234 5678', expected: '010-1234-5678' },
        { input: '010.1234.5678', expected: '010-1234-5678' },
        { input: '010-1234-5678', expected: '010-1234-5678' }
      ]

      testCases.forEach(({ input, expected }) => {
        expect(sanitizers.formatPhoneNumber(input)).toBe(expected)
      })
    })

    it('should return original string for invalid formats', () => {
      const invalidInputs = [
        '0212345678',      // Not 010
        '01012345',        // Too short
        '010123456789',    // Too long
        'abc-defg-hijk',   // Letters
        ''                 // Empty
      ]

      invalidInputs.forEach(input => {
        expect(sanitizers.formatPhoneNumber(input)).toBe(input)
      })
    })
  })

  describe('trimString', () => {
    it('should trim whitespace and handle empty strings', () => {
      const testCases = [
        { input: '  test  ', expected: 'test' },
        { input: 'test', expected: 'test' },
        { input: '   ', expected: null },
        { input: '', expected: null },
        { input: null, expected: null },
        { input: undefined, expected: null }
      ]

      testCases.forEach(({ input, expected }) => {
        expect(sanitizers.trimString(input)).toBe(expected)
      })
    })
  })

  describe('formatCompanyName', () => {
    it('should format company names correctly', () => {
      const testCases = [
        { input: '  주식회사   테스트  ', expected: '주식회사 테스트' },
        { input: 'Test    Company   Ltd', expected: 'Test Company Ltd' },
        { input: '   (주)테스트   ', expected: '(주)테스트' }
      ]

      testCases.forEach(({ input, expected }) => {
        expect(sanitizers.formatCompanyName(input)).toBe(expected)
      })
    })
  })
})

describe('Edge Cases and Error Handling', () => {
  describe('Complex validation scenarios', () => {
    it('should handle nested schema validation', () => {
      const nestedSchema = z.object({
        company: z.object({
          name: companyNameSchema,
          contacts: z.array(z.object({
            name: nameSchema,
            phone: phoneSchema,
            email: emailSchema.optional()
          })).min(1)
        }),
        metadata: z.object({
          region: regionSchema,
          active: z.boolean()
        }).optional()
      })

      const validData = {
        company: {
          name: '테스트 회사',
          contacts: [
            {
              name: '김철수',
              phone: '010-1234-5678',
              email: 'kim@test.com'
            }
          ]
        },
        metadata: {
          region: '서울',
          active: true
        }
      }

      expect(() => nestedSchema.parse(validData)).not.toThrow()
    })

    it('should handle array validation with mixed valid/invalid items', () => {
      const arraySchema = z.array(phoneSchema)

      const mixedData = ['010-1234-5678', 'invalid-phone', '010-9999-8888']

      expect(() => arraySchema.parse(mixedData)).toThrow()
    })
  })

  describe('Performance considerations', () => {
    it('should handle large data validation efficiently', () => {
      const largeDataSchema = z.array(z.object({
        name: nameSchema,
        email: emailSchema
      }))

      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        name: `User ${i}`,
        email: `user${i}@test.com`
      }))

      const startTime = Date.now()
      expect(() => largeDataSchema.parse(largeData)).not.toThrow()
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second
    })
  })

  describe('Unicode and special character handling', () => {
    it('should handle Korean characters in validation', () => {
      const koreanNames = [
        '김철수',
        '이영희',
        '박민수',
        '정다은',
        '최준호'
      ]

      koreanNames.forEach(name => {
        expect(() => nameSchema.parse(name)).not.toThrow()
        expect(validators.isValidName(name)).toBe(true)
      })
    })

    it('should handle company names with various Korean formats', () => {
      const koreanCompanyNames = [
        '주식회사 삼성전자',
        '(주)LG전자',
        '현대자동차 주식회사',
        '네이버 (주)',
        'SK텔레콤'
      ]

      koreanCompanyNames.forEach(name => {
        expect(() => companyNameSchema.parse(name)).not.toThrow()
        expect(validators.isValidCompanyName(name)).toBe(true)
      })
    })
  })
})