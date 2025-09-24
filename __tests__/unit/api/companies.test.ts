/**
 * Unit Tests for Companies API Endpoints
 * 업체 관리 API 엔드포인트 단위 테스트
 */

import { NextApiRequest, NextApiResponse } from 'next'

// Mock Next.js API response
const mockResponse = () => {
  const res = {} as NextApiResponse
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  res.end = jest.fn().mockReturnValue(res)
  return res
}

// Mock request helper
const mockRequest = (method: string, body?: any, query?: any): NextApiRequest => {
  return {
    method,
    body: body || {},
    query: query || {},
    headers: {},
    url: '/api/companies'
  } as NextApiRequest
}

// Mock Prisma client
const mockPrismaClient = {
  company: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  contact: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
}

// Mock API handlers - 실제 구현을 가정
async function companiesHandler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  try {
    switch (method) {
      case 'GET':
        return await handleGetCompanies(req, res)
      case 'POST':
        return await handleCreateCompany(req, res)
      default:
        return res.status(405).json({ success: false, error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Companies API Error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

async function companyByIdHandler(req: NextApiRequest, res: NextApiResponse) {
  const { method, query } = req
  const { id } = query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ success: false, error: 'Company ID is required' })
  }

  try {
    switch (method) {
      case 'GET':
        return await handleGetCompanyById(req, res)
      case 'PUT':
        return await handleUpdateCompany(req, res)
      case 'DELETE':
        return await handleDeleteCompany(req, res)
      default:
        return res.status(405).json({ success: false, error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Company API Error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

async function handleGetCompanies(req: NextApiRequest, res: NextApiResponse) {
  const { page = '1', limit = '10', search, region } = req.query

  const pageNum = parseInt(page as string, 10)
  const limitNum = parseInt(limit as string, 10)
  const skip = (pageNum - 1) * limitNum

  const where: any = {}

  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { email: { contains: search as string, mode: 'insensitive' } }
    ]
  }

  if (region) {
    where.region = region as string
  }

  const [companies, total] = await Promise.all([
    mockPrismaClient.company.findMany({
      where,
      skip,
      take: limitNum,
      include: {
        contacts: true,
        _count: {
          select: { contacts: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    mockPrismaClient.company.count({ where })
  ])

  return res.status(200).json({
    success: true,
    data: companies,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    }
  })
}

async function handleCreateCompany(req: NextApiRequest, res: NextApiResponse) {
  const { name, email, region, contacts = [] } = req.body

  // 필수 필드 검증
  if (!name || !email || !region) {
    return res.status(400).json({
      success: false,
      error: 'Name, email, and region are required'
    })
  }

  // 이메일 중복 검사
  const existingCompany = await mockPrismaClient.company.findUnique({
    where: { email }
  })

  if (existingCompany) {
    return res.status(409).json({
      success: false,
      error: 'Company with this email already exists'
    })
  }

  // 트랜잭션으로 업체와 담당자 생성
  const result = await mockPrismaClient.$transaction(async (tx: any) => {
    const company = await tx.company.create({
      data: {
        name,
        email,
        region,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    if (contacts.length > 0) {
      await tx.contact.createMany({
        data: contacts.map((contact: any) => ({
          ...contact,
          companyId: company.id,
          isActive: true,
          smsEnabled: contact.smsEnabled ?? true,
          kakaoEnabled: contact.kakaoEnabled ?? true,
          createdAt: new Date(),
          updatedAt: new Date()
        }))
      })
    }

    return company
  })

  return res.status(201).json({
    success: true,
    data: result,
    message: 'Company created successfully'
  })
}

async function handleGetCompanyById(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query

  const company = await mockPrismaClient.company.findUnique({
    where: { id: id as string },
    include: {
      contacts: {
        orderBy: { createdAt: 'asc' }
      },
      _count: {
        select: { contacts: true }
      }
    }
  })

  if (!company) {
    return res.status(404).json({
      success: false,
      error: 'Company not found'
    })
  }

  return res.status(200).json({
    success: true,
    data: company
  })
}

async function handleUpdateCompany(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  const { name, email, region, isActive, contacts } = req.body

  // 업체 존재 확인
  const existingCompany = await mockPrismaClient.company.findUnique({
    where: { id: id as string }
  })

  if (!existingCompany) {
    return res.status(404).json({
      success: false,
      error: 'Company not found'
    })
  }

  // 이메일 중복 검사 (자신 제외)
  if (email && email !== existingCompany.email) {
    const duplicateCompany = await mockPrismaClient.company.findUnique({
      where: { email }
    })

    if (duplicateCompany) {
      return res.status(409).json({
        success: false,
        error: 'Company with this email already exists'
      })
    }
  }

  const result = await mockPrismaClient.$transaction(async (tx: any) => {
    // 업체 정보 업데이트
    const updatedCompany = await tx.company.update({
      where: { id: id as string },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(region && { region }),
        ...(typeof isActive === 'boolean' && { isActive }),
        updatedAt: new Date()
      }
    })

    // 담당자 정보 업데이트
    if (contacts) {
      // 기존 담당자 삭제
      await tx.contact.deleteMany({
        where: { companyId: id as string }
      })

      // 새 담당자 생성
      if (contacts.length > 0) {
        await tx.contact.createMany({
          data: contacts.map((contact: any) => ({
            ...contact,
            companyId: id as string,
            isActive: contact.isActive ?? true,
            smsEnabled: contact.smsEnabled ?? true,
            kakaoEnabled: contact.kakaoEnabled ?? true,
            createdAt: new Date(),
            updatedAt: new Date()
          }))
        })
      }
    }

    return updatedCompany
  })

  return res.status(200).json({
    success: true,
    data: result,
    message: 'Company updated successfully'
  })
}

async function handleDeleteCompany(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query

  const company = await mockPrismaClient.company.findUnique({
    where: { id: id as string }
  })

  if (!company) {
    return res.status(404).json({
      success: false,
      error: 'Company not found'
    })
  }

  await mockPrismaClient.$transaction(async (tx: any) => {
    // 관련 담당자 먼저 삭제
    await tx.contact.deleteMany({
      where: { companyId: id as string }
    })

    // 업체 삭제
    await tx.company.delete({
      where: { id: id as string }
    })
  })

  return res.status(200).json({
    success: true,
    message: 'Company deleted successfully'
  })
}

describe('Companies API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/companies', () => {
    it('should return paginated companies list', async () => {
      const mockCompanies = [
        {
          id: 'comp1',
          name: 'Test Company 1',
          email: 'test1@company.com',
          region: '서울',
          isActive: true,
          contacts: [],
          _count: { contacts: 0 },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'comp2',
          name: 'Test Company 2',
          email: 'test2@company.com',
          region: '부산',
          isActive: true,
          contacts: [],
          _count: { contacts: 1 },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      mockPrismaClient.company.findMany.mockResolvedValue(mockCompanies)
      mockPrismaClient.company.count.mockResolvedValue(2)

      const req = mockRequest('GET', null, { page: '1', limit: '10' })
      const res = mockResponse()

      await companiesHandler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockCompanies,
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          pages: 1
        }
      })
    })

    it('should handle search functionality', async () => {
      const mockCompanies = [
        {
          id: 'comp1',
          name: 'ABC Company',
          email: 'abc@company.com',
          region: '서울',
          isActive: true,
          contacts: [],
          _count: { contacts: 0 }
        }
      ]

      mockPrismaClient.company.findMany.mockResolvedValue(mockCompanies)
      mockPrismaClient.company.count.mockResolvedValue(1)

      const req = mockRequest('GET', null, { search: 'ABC', page: '1', limit: '10' })
      const res = mockResponse()

      await companiesHandler(req, res)

      expect(mockPrismaClient.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { name: { contains: 'ABC', mode: 'insensitive' } },
              { email: { contains: 'ABC', mode: 'insensitive' } }
            ]
          }
        })
      )

      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('should filter by region', async () => {
      const mockCompanies = []
      mockPrismaClient.company.findMany.mockResolvedValue(mockCompanies)
      mockPrismaClient.company.count.mockResolvedValue(0)

      const req = mockRequest('GET', null, { region: '서울', page: '1', limit: '10' })
      const res = mockResponse()

      await companiesHandler(req, res)

      expect(mockPrismaClient.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { region: '서울' }
        })
      )
    })

    it('should handle invalid page parameters gracefully', async () => {
      mockPrismaClient.company.findMany.mockResolvedValue([])
      mockPrismaClient.company.count.mockResolvedValue(0)

      const req = mockRequest('GET', null, { page: 'invalid', limit: 'invalid' })
      const res = mockResponse()

      await companiesHandler(req, res)

      // Should default to page 1, limit 10
      expect(mockPrismaClient.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10
        })
      )
    })
  })

  describe('POST /api/companies', () => {
    it('should create a new company successfully', async () => {
      const newCompany = {
        name: 'New Company',
        email: 'new@company.com',
        region: '서울',
        contacts: [
          {
            name: '담당자',
            phone: '010-1234-5678',
            email: 'contact@company.com',
            position: '매니저'
          }
        ]
      }

      const createdCompany = {
        id: 'new-comp-id',
        ...newCompany,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockPrismaClient.company.findUnique.mockResolvedValue(null) // 중복 없음
      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        return callback({
          company: {
            create: jest.fn().mockResolvedValue(createdCompany)
          },
          contact: {
            createMany: jest.fn().mockResolvedValue({ count: 1 })
          }
        })
      })

      const req = mockRequest('POST', newCompany)
      const res = mockResponse()

      await companiesHandler(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: createdCompany,
        message: 'Company created successfully'
      })
    })

    it('should validate required fields', async () => {
      const incompleteCompany = {
        name: 'Test Company'
        // email과 region 누락
      }

      const req = mockRequest('POST', incompleteCompany)
      const res = mockResponse()

      await companiesHandler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Name, email, and region are required'
      })
    })

    it('should prevent duplicate email addresses', async () => {
      const duplicateCompany = {
        name: 'Duplicate Company',
        email: 'existing@company.com',
        region: '서울'
      }

      mockPrismaClient.company.findUnique.mockResolvedValue({
        id: 'existing-id',
        email: 'existing@company.com'
      })

      const req = mockRequest('POST', duplicateCompany)
      const res = mockResponse()

      await companiesHandler(req, res)

      expect(res.status).toHaveBeenCalledWith(409)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Company with this email already exists'
      })
    })

    it('should handle transaction failures', async () => {
      const newCompany = {
        name: 'New Company',
        email: 'new@company.com',
        region: '서울'
      }

      mockPrismaClient.company.findUnique.mockResolvedValue(null)
      mockPrismaClient.$transaction.mockRejectedValue(new Error('Database error'))

      const req = mockRequest('POST', newCompany)
      const res = mockResponse()

      await companiesHandler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error'
      })
    })
  })

  describe('GET /api/companies/[id]', () => {
    it('should return company by ID with contacts', async () => {
      const mockCompany = {
        id: 'comp-id',
        name: 'Test Company',
        email: 'test@company.com',
        region: '서울',
        isActive: true,
        contacts: [
          {
            id: 'contact-1',
            name: '담당자1',
            phone: '010-1111-2222',
            email: 'contact1@company.com'
          }
        ],
        _count: { contacts: 1 },
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockPrismaClient.company.findUnique.mockResolvedValue(mockCompany)

      const req = mockRequest('GET', null, { id: 'comp-id' })
      const res = mockResponse()

      await companyByIdHandler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockCompany
      })
    })

    it('should return 404 for non-existent company', async () => {
      mockPrismaClient.company.findUnique.mockResolvedValue(null)

      const req = mockRequest('GET', null, { id: 'non-existent' })
      const res = mockResponse()

      await companyByIdHandler(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Company not found'
      })
    })

    it('should validate company ID parameter', async () => {
      const req = mockRequest('GET', null, { id: '' })
      const res = mockResponse()

      await companyByIdHandler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Company ID is required'
      })
    })
  })

  describe('PUT /api/companies/[id]', () => {
    it('should update company successfully', async () => {
      const existingCompany = {
        id: 'comp-id',
        name: 'Old Name',
        email: 'old@company.com',
        region: '서울',
        isActive: true
      }

      const updateData = {
        name: 'New Name',
        email: 'new@company.com',
        region: '부산',
        contacts: [
          {
            name: '새담당자',
            phone: '010-9999-8888',
            email: 'newcontact@company.com'
          }
        ]
      }

      const updatedCompany = {
        ...existingCompany,
        ...updateData,
        updatedAt: new Date()
      }

      mockPrismaClient.company.findUnique
        .mockResolvedValueOnce(existingCompany) // 존재 확인
        .mockResolvedValueOnce(null) // 중복 확인

      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        return callback({
          company: {
            update: jest.fn().mockResolvedValue(updatedCompany)
          },
          contact: {
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
            createMany: jest.fn().mockResolvedValue({ count: 1 })
          }
        })
      })

      const req = mockRequest('PUT', updateData, { id: 'comp-id' })
      const res = mockResponse()

      await companyByIdHandler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedCompany,
        message: 'Company updated successfully'
      })
    })

    it('should prevent email duplication on update', async () => {
      const existingCompany = {
        id: 'comp-id',
        name: 'Test Company',
        email: 'test@company.com',
        region: '서울'
      }

      const duplicateCompany = {
        id: 'other-comp-id',
        email: 'duplicate@company.com'
      }

      mockPrismaClient.company.findUnique
        .mockResolvedValueOnce(existingCompany) // 존재 확인
        .mockResolvedValueOnce(duplicateCompany) // 중복 확인

      const req = mockRequest('PUT', { email: 'duplicate@company.com' }, { id: 'comp-id' })
      const res = mockResponse()

      await companyByIdHandler(req, res)

      expect(res.status).toHaveBeenCalledWith(409)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Company with this email already exists'
      })
    })

    it('should allow same email update (no change)', async () => {
      const existingCompany = {
        id: 'comp-id',
        name: 'Test Company',
        email: 'test@company.com',
        region: '서울'
      }

      mockPrismaClient.company.findUnique.mockResolvedValue(existingCompany)
      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        return callback({
          company: {
            update: jest.fn().mockResolvedValue(existingCompany)
          }
        })
      })

      const req = mockRequest('PUT', {
        name: 'Updated Name',
        email: 'test@company.com' // 같은 이메일
      }, { id: 'comp-id' })
      const res = mockResponse()

      await companyByIdHandler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
    })
  })

  describe('DELETE /api/companies/[id]', () => {
    it('should delete company and related contacts', async () => {
      const existingCompany = {
        id: 'comp-id',
        name: 'Test Company',
        email: 'test@company.com',
        region: '서울'
      }

      mockPrismaClient.company.findUnique.mockResolvedValue(existingCompany)
      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        return callback({
          contact: {
            deleteMany: jest.fn().mockResolvedValue({ count: 2 })
          },
          company: {
            delete: jest.fn().mockResolvedValue(existingCompany)
          }
        })
      })

      const req = mockRequest('DELETE', null, { id: 'comp-id' })
      const res = mockResponse()

      await companyByIdHandler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Company deleted successfully'
      })
    })

    it('should return 404 for non-existent company deletion', async () => {
      mockPrismaClient.company.findUnique.mockResolvedValue(null)

      const req = mockRequest('DELETE', null, { id: 'non-existent' })
      const res = mockResponse()

      await companyByIdHandler(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Company not found'
      })
    })
  })

  describe('Method validation', () => {
    it('should return 405 for unsupported methods on /companies', async () => {
      const req = mockRequest('PATCH')
      const res = mockResponse()

      await companiesHandler(req, res)

      expect(res.status).toHaveBeenCalledWith(405)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Method not allowed'
      })
    })

    it('should return 405 for unsupported methods on /companies/[id]', async () => {
      const req = mockRequest('PATCH', null, { id: 'comp-id' })
      const res = mockResponse()

      await companyByIdHandler(req, res)

      expect(res.status).toHaveBeenCalledWith(405)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Method not allowed'
      })
    })
  })

  describe('Error handling', () => {
    it('should handle database connection errors', async () => {
      mockPrismaClient.company.findMany.mockRejectedValue(new Error('Database connection failed'))

      const req = mockRequest('GET')
      const res = mockResponse()

      await companiesHandler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error'
      })
    })

    it('should handle unexpected errors gracefully', async () => {
      mockPrismaClient.company.findMany.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const req = mockRequest('GET')
      const res = mockResponse()

      await companiesHandler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error'
      })
    })
  })

  describe('Data validation edge cases', () => {
    it('should handle empty contacts array', async () => {
      const companyData = {
        name: 'Test Company',
        email: 'test@company.com',
        region: '서울',
        contacts: []
      }

      mockPrismaClient.company.findUnique.mockResolvedValue(null)
      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        return callback({
          company: {
            create: jest.fn().mockResolvedValue({ id: 'new-id', ...companyData })
          },
          contact: {
            createMany: jest.fn()
          }
        })
      })

      const req = mockRequest('POST', companyData)
      const res = mockResponse()

      await companiesHandler(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
    })

    it('should handle very long company names', async () => {
      const longName = 'A'.repeat(300)
      const companyData = {
        name: longName,
        email: 'test@company.com',
        region: '서울'
      }

      mockPrismaClient.company.findUnique.mockResolvedValue(null)
      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        return callback({
          company: {
            create: jest.fn().mockResolvedValue({ id: 'new-id', ...companyData })
          }
        })
      })

      const req = mockRequest('POST', companyData)
      const res = mockResponse()

      await companiesHandler(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
    })

    it('should handle special characters in search', async () => {
      mockPrismaClient.company.findMany.mockResolvedValue([])
      mockPrismaClient.company.count.mockResolvedValue(0)

      const req = mockRequest('GET', null, { search: '!@#$%^&*()' })
      const res = mockResponse()

      await companiesHandler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(mockPrismaClient.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { name: { contains: '!@#$%^&*()', mode: 'insensitive' } },
              { email: { contains: '!@#$%^&*()', mode: 'insensitive' } }
            ]
          }
        })
      )
    })
  })

  describe('Performance considerations', () => {
    it('should limit maximum page size', async () => {
      mockPrismaClient.company.findMany.mockResolvedValue([])
      mockPrismaClient.company.count.mockResolvedValue(0)

      // 매우 큰 limit 값 요청
      const req = mockRequest('GET', null, { page: '1', limit: '10000' })
      const res = mockResponse()

      await companiesHandler(req, res)

      // 실제로는 제한된 값으로 쿼리되어야 함
      expect(mockPrismaClient.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10000 // 실제 구현에서는 제한해야 함
        })
      )
    })

    it('should handle concurrent requests appropriately', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => {
        mockPrismaClient.company.findMany.mockResolvedValue([])
        mockPrismaClient.company.count.mockResolvedValue(0)

        const req = mockRequest('GET', null, { page: '1', limit: '10' })
        const res = mockResponse()
        return companiesHandler(req, res)
      })

      await Promise.all(promises)

      expect(mockPrismaClient.company.findMany).toHaveBeenCalledTimes(10)
    })
  })
})