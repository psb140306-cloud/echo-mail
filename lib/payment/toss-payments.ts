/**
 * 토스페이먼츠 API 통합
 * - 정기 결제 (빌링키)
 * - 일반 결제
 * - 웹훅 처리
 */

import { logger } from '@/lib/utils/logger'

// 토스페이먼츠 API 설정
const TOSS_API_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.tosspayments.com'
    : 'https://api.tosspayments.com' // 테스트 환경도 동일한 URL

const TOSS_CLIENT_KEY = process.env.TOSS_CLIENT_KEY || ''
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || ''

function checkApiKeys() {
  if (!TOSS_CLIENT_KEY || !TOSS_SECRET_KEY) {
    throw new Error('토스페이먼츠 API 키가 설정되지 않았습니다.')
  }
}

// 토스페이먼츠 API 요청 헤더
const getHeaders = () => ({
  Authorization: `Basic ${Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64')}`,
  'Content-Type': 'application/json',
})

// 공통 API 요청 함수
async function tossApiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  checkApiKeys()
  const url = `${TOSS_API_BASE_URL}${endpoint}`

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getHeaders(),
        ...options.headers,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      logger.error('토스페이먼츠 API 오류', {
        status: response.status,
        statusText: response.statusText,
        error: data,
        endpoint,
      })
      throw new TossPaymentError(
        data.message || '결제 처리 중 오류가 발생했습니다.',
        data.code,
        data
      )
    }

    return data as T
  } catch (error) {
    if (error instanceof TossPaymentError) {
      throw error
    }

    logger.error('토스페이먼츠 API 요청 실패', {
      endpoint,
      error: error instanceof Error ? error.message : String(error),
    })

    throw new TossPaymentError('결제 서비스에 연결할 수 없습니다.')
  }
}

// 토스페이먼츠 에러 클래스
export class TossPaymentError extends Error {
  public code?: string
  public details?: any

  constructor(message: string, code?: string, details?: any) {
    super(message)
    this.name = 'TossPaymentError'
    this.code = code
    this.details = details
  }
}

// 빌링키 발급 인터페이스
export interface IssueBillingKeyRequest {
  customerKey: string // 고객 고유 ID
  cardNumber: string // 카드 번호
  cardExpirationYear: string // 카드 만료 연도 (YY)
  cardExpirationMonth: string // 카드 만료 월 (MM)
  cardPassword?: string // 카드 비밀번호 앞 2자리
  customerBirthday?: string // 생년월일 (YYMMDD) 또는 사업자 번호
  consents?: Array<{
    // 개인정보 처리 동의
    agreementId: string
    agreedAt: string
  }>
}

export interface BillingKeyInfo {
  mId: string
  customerKey: string
  billingKey: string
  billingKeyStatus: 'ACTIVE' | 'INACTIVE' | 'DELETED'
  cardCompany: string
  cardNumber: string
  cardType: 'CREDIT' | 'DEBIT' | 'GIFT'
  authenticatedAt: string
  method: 'CARD'
}

// 자동 결제 요청 인터페이스
export interface AutoPaymentRequest {
  billingKey: string
  customerKey: string
  amount: number
  orderId: string
  orderName: string
  customerEmail?: string
  customerName?: string
  taxFreeAmount?: number
}

export interface PaymentInfo {
  mId: string
  version: string
  paymentKey: string
  orderId: string
  orderName: string
  currency: string
  method: 'BILLING'
  totalAmount: number
  balanceAmount: number
  suppliedAmount: number
  vat: number
  status:
    | 'READY'
    | 'IN_PROGRESS'
    | 'WAITING_FOR_DEPOSIT'
    | 'DONE'
    | 'CANCELED'
    | 'PARTIAL_CANCELED'
    | 'ABORTED'
    | 'EXPIRED'
  requestedAt: string
  approvedAt?: string
  useEscrow: boolean
  cultureExpense: boolean
  card?: {
    issuerCode: string
    acquirerCode: string
    number: string
    installmentPlanMonths: number
    isInterestFree: boolean
    interestPayer: string
    approveNo: string
    useCardPoint: boolean
    cardType: 'CREDIT' | 'DEBIT' | 'GIFT'
    ownerType: 'PERSONAL' | 'CORPORATE'
    acquireStatus: 'READY' | 'REQUESTED' | 'COMPLETED' | 'CANCEL_REQUESTED' | 'CANCELED'
    receiptUrl: string
  }
  customerKey: string
  billingKey: string
}

// 환불 요청 인터페이스
export interface RefundRequest {
  paymentKey: string
  cancelReason: string
  cancelAmount?: number // 부분 환불시
  refundReceiveAccount?: {
    bank: string
    accountNumber: string
    holderName: string
  }
}

export interface RefundInfo {
  paymentKey: string
  orderId: string
  status: string
  totalAmount: number
  cancelAmount: number
  cancelReason: string
  canceledAt: string
  cancelHistory: Array<{
    cancelAmount: number
    cancelReason: string
    canceledAt: string
    receiptKey: string
  }>
}

/**
 * 토스페이먼츠 서비스 클래스
 */
export class TossPaymentService {
  /**
   * 빌링키 발급
   */
  static async issueBillingKey(request: IssueBillingKeyRequest): Promise<BillingKeyInfo> {
    logger.info('빌링키 발급 요청', {
      customerKey: request.customerKey,
      cardNumber: request.cardNumber.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1-****-****-$4'),
    })

    return await tossApiRequest<BillingKeyInfo>('/v1/billing/authorizations/card', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  /**
   * 빌링키 조회
   */
  static async getBillingKey(billingKey: string, customerKey: string): Promise<BillingKeyInfo> {
    return await tossApiRequest<BillingKeyInfo>(
      `/v1/billing/authorizations/${billingKey}?customerKey=${customerKey}`
    )
  }

  /**
   * 빌링키 삭제
   */
  static async deleteBillingKey(billingKey: string, customerKey: string): Promise<void> {
    await tossApiRequest(`/v1/billing/authorizations/${billingKey}`, {
      method: 'DELETE',
      body: JSON.stringify({ customerKey }),
    })

    logger.info('빌링키 삭제 완료', { billingKey, customerKey })
  }

  /**
   * 자동 결제 (빌링키 사용)
   */
  static async createAutoPayment(request: AutoPaymentRequest): Promise<PaymentInfo> {
    logger.info('자동 결제 요청', {
      customerKey: request.customerKey,
      amount: request.amount,
      orderId: request.orderId,
      orderName: request.orderName,
    })

    return await tossApiRequest<PaymentInfo>(`/v1/billing/${request.billingKey}`, {
      method: 'POST',
      body: JSON.stringify({
        customerKey: request.customerKey,
        amount: request.amount,
        orderId: request.orderId,
        orderName: request.orderName,
        customerEmail: request.customerEmail,
        customerName: request.customerName,
        taxFreeAmount: request.taxFreeAmount || 0,
      }),
    })
  }

  /**
   * 결제 조회
   */
  static async getPayment(paymentKey: string): Promise<PaymentInfo> {
    return await tossApiRequest<PaymentInfo>(`/v1/payments/${paymentKey}`)
  }

  /**
   * 결제 승인 (일반 결제)
   */
  static async confirmPayment(
    paymentKey: string,
    orderId: string,
    amount: number
  ): Promise<PaymentInfo> {
    logger.info('결제 승인 요청', { paymentKey, orderId, amount })

    return await tossApiRequest<PaymentInfo>(`/v1/payments/confirm`, {
      method: 'POST',
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount,
      }),
    })
  }

  /**
   * 결제 취소/환불
   */
  static async cancelPayment(request: RefundRequest): Promise<RefundInfo> {
    logger.info('결제 취소 요청', {
      paymentKey: request.paymentKey,
      cancelAmount: request.cancelAmount,
      cancelReason: request.cancelReason,
    })

    return await tossApiRequest<RefundInfo>(`/v1/payments/${request.paymentKey}/cancel`, {
      method: 'POST',
      body: JSON.stringify({
        cancelReason: request.cancelReason,
        cancelAmount: request.cancelAmount,
        refundReceiveAccount: request.refundReceiveAccount,
      }),
    })
  }

  /**
   * 주문 ID 생성
   */
  static generateOrderId(
    tenantId: string,
    type: 'subscription' | 'addon' = 'subscription'
  ): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 6).toUpperCase()
    return `ECHO_${type.toUpperCase()}_${tenantId}_${timestamp}_${random}`
  }

  /**
   * 고객 키 생성
   */
  static generateCustomerKey(tenantId: string): string {
    return `tenant_${tenantId}`
  }

  /**
   * 웹훅 검증
   */
  static verifyWebhook(payload: string, signature: string): boolean {
    // 토스페이먼츠 웹훅 서명 검증 로직
    // TODO: 실제 서명 검증 구현 필요
    return true
  }
}

// 결제 상태 한글 변환
export function getPaymentStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    READY: '결제 준비',
    IN_PROGRESS: '결제 진행 중',
    WAITING_FOR_DEPOSIT: '입금 대기',
    DONE: '결제 완료',
    CANCELED: '결제 취소',
    PARTIAL_CANCELED: '부분 취소',
    ABORTED: '결제 중단',
    EXPIRED: '결제 만료',
  }
  return statusMap[status] || status
}

// 카드사 코드 한글 변환
export function getCardCompanyName(code: string): string {
  const cardMap: Record<string, string> = {
    '3K': 'KB국민카드',
    '46': '광주은행',
    '71': '롯데카드',
    '30': '산업은행',
    '31': '신한카드',
    '51': '삼성카드',
    '38': '새마을금고',
    '41': '우리카드',
    '62': '신협',
    '36': '씨티카드',
    '33': '우체국예금보험',
    '37': '전북은행',
    '39': '저축은행중앙회',
    '35': '제주은행',
    '42': '하나카드',
    '24': '현대카드',
  }
  return cardMap[code] || code
}

export default TossPaymentService
