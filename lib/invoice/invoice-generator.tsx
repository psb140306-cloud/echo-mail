import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer'
import { formatCurrency } from '@/lib/utils'

// PDF 스타일 정의
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottom: 2,
    borderBottomColor: '#112233',
    paddingBottom: 10,
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#112233',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#112233',
    textAlign: 'right',
  },
  section: {
    margin: 10,
    padding: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333333',
  },
  text: {
    fontSize: 12,
    color: '#666666',
  },
  table: {
    marginTop: 20,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: 1,
    borderBottomColor: '#EEEEEE',
    paddingVertical: 8,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderBottom: 2,
    borderBottomColor: '#112233',
    paddingVertical: 10,
  },
  tableCol: {
    width: '25%',
    paddingHorizontal: 5,
  },
  tableHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#112233',
  },
  tableCell: {
    fontSize: 11,
    color: '#333333',
  },
  footer: {
    marginTop: 30,
    borderTop: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 15,
  },
  total: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#112233',
    textAlign: 'right',
  },
})

// 인보이스 데이터 타입
export interface InvoiceData {
  invoiceNumber: string
  issueDate: string
  dueDate: string
  status: 'PAID' | 'PENDING' | 'OVERDUE'

  // 공급자 (Echo Mail)
  supplier: {
    name: string
    address: string
    phone: string
    email: string
    businessNumber: string
  }

  // 고객 (테넌트)
  customer: {
    name: string
    address: string
    phone: string
    email: string
    businessNumber?: string
  }

  // 품목
  items: Array<{
    description: string
    period: string
    quantity: number
    unitPrice: number
    amount: number
  }>

  // 합계
  subtotal: number
  vatRate: number
  vatAmount: number
  total: number
}

// PDF 문서 컴포넌트
export const InvoicePDF = ({ invoice }: { invoice: InvoiceData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>Echo Mail</Text>
          <Text style={styles.text}>발주 확인 자동 알림 서비스</Text>
        </View>
        <View>
          <Text style={styles.title}>인보이스</Text>
          <Text style={styles.text}>#{invoice.invoiceNumber}</Text>
        </View>
      </View>

      {/* 인보이스 정보 */}
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.label}>발행일:</Text>
          <Text style={styles.text}>{invoice.issueDate}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>만료일:</Text>
          <Text style={styles.text}>{invoice.dueDate}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>상태:</Text>
          <Text style={styles.text}>
            {invoice.status === 'PAID' ? '결제완료' :
             invoice.status === 'PENDING' ? '결제대기' : '연체'}
          </Text>
        </View>
      </View>

      {/* 공급자/고객 정보 */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={[styles.section, { width: '48%' }]}>
          <Text style={styles.label}>공급자</Text>
          <Text style={styles.text}>{invoice.supplier.name}</Text>
          <Text style={styles.text}>{invoice.supplier.address}</Text>
          <Text style={styles.text}>전화: {invoice.supplier.phone}</Text>
          <Text style={styles.text}>이메일: {invoice.supplier.email}</Text>
          <Text style={styles.text}>사업자번호: {invoice.supplier.businessNumber}</Text>
        </View>

        <View style={[styles.section, { width: '48%' }]}>
          <Text style={styles.label}>고객</Text>
          <Text style={styles.text}>{invoice.customer.name}</Text>
          <Text style={styles.text}>{invoice.customer.address}</Text>
          <Text style={styles.text}>전화: {invoice.customer.phone}</Text>
          <Text style={styles.text}>이메일: {invoice.customer.email}</Text>
          {invoice.customer.businessNumber && (
            <Text style={styles.text}>사업자번호: {invoice.customer.businessNumber}</Text>
          )}
        </View>
      </View>

      {/* 품목 테이블 */}
      <View style={styles.table}>
        <View style={styles.tableHeaderRow}>
          <View style={styles.tableCol}>
            <Text style={styles.tableHeader}>서비스</Text>
          </View>
          <View style={styles.tableCol}>
            <Text style={styles.tableHeader}>이용기간</Text>
          </View>
          <View style={styles.tableCol}>
            <Text style={styles.tableHeader}>단가</Text>
          </View>
          <View style={styles.tableCol}>
            <Text style={styles.tableHeader}>금액</Text>
          </View>
        </View>

        {invoice.items.map((item, index) => (
          <View key={index} style={styles.tableRow}>
            <View style={styles.tableCol}>
              <Text style={styles.tableCell}>{item.description}</Text>
            </View>
            <View style={styles.tableCol}>
              <Text style={styles.tableCell}>{item.period}</Text>
            </View>
            <View style={styles.tableCol}>
              <Text style={styles.tableCell}>{formatCurrency(item.unitPrice)}</Text>
            </View>
            <View style={styles.tableCol}>
              <Text style={styles.tableCell}>{formatCurrency(item.amount)}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* 합계 */}
      <View style={styles.footer}>
        <View style={styles.row}>
          <Text style={styles.label}>소계:</Text>
          <Text style={styles.text}>{formatCurrency(invoice.subtotal)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>부가세({invoice.vatRate}%):</Text>
          <Text style={styles.text}>{formatCurrency(invoice.vatAmount)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.total}>총 금액: {formatCurrency(invoice.total)}</Text>
        </View>
      </View>

      {/* 하단 정보 */}
      <View style={[styles.footer, { marginTop: 50 }]}>
        <Text style={styles.text}>
          이 인보이스는 Echo Mail 시스템에서 자동 생성되었습니다.
        </Text>
        <Text style={styles.text}>
          문의사항이 있으시면 support@echomail.co.kr로 연락주세요.
        </Text>
      </View>
    </Page>
  </Document>
)

// 인보이스 PDF 생성 및 다운로드 함수
export const generateInvoicePDF = async (invoice: InvoiceData): Promise<Blob> => {
  const { pdf } = await import('@react-pdf/renderer')

  return new Promise((resolve, reject) => {
    try {
      const pdfDocument = <InvoicePDF invoice={invoice} />
      pdf(pdfDocument).toBlob().then(resolve).catch(reject)
    } catch (error) {
      reject(error)
    }
  })
}

// 기본 Echo Mail 공급자 정보
export const DEFAULT_SUPPLIER = {
  name: 'Echo Mail Co., Ltd.',
  address: '서울특별시 강남구 테헤란로 123, 12층',
  phone: '02-1234-5678',
  email: 'billing@echomail.co.kr',
  businessNumber: '123-45-67890',
}