import * as XLSX from 'xlsx'

export interface ImportedContact {
  name: string
  email: string
  company?: string
  position?: string
  phone?: string
  department?: string
  memo?: string
}

export interface ImportResult {
  success: boolean
  contacts: ImportedContact[]
  errors: string[]
  duplicates: string[]
  totalRows: number
}

// 각 메일 서비스별 컬럼명 매핑
const COLUMN_MAPPINGS: Record<string, Record<string, string>> = {
  // 공통
  common: {
    name: 'name',
    이름: 'name',
    성명: 'name',
    'Name': 'name',
    'Full Name': 'name',
    '이름/별명': 'name',

    email: 'email',
    메일: 'email',  // 다음 메일
    이메일: 'email',
    'E-mail': 'email',
    'Email': 'email',
    'Email Address': 'email',
    '전자 메일': 'email',
    '기본 이메일': 'email',
    '이메일 주소': 'email',

    company: 'company',
    회사: 'company',
    회사명: 'company',
    'Company': 'company',
    'Organization': 'company',
    '조직': 'company',

    position: 'position',
    직책: 'position',
    직위: 'position',
    'Title': 'position',
    'Job Title': 'position',

    phone: 'phone',
    전화: 'phone',
    전화번호: 'phone',
    휴대폰: 'phone',  // 다음 메일
    휴대전화: 'phone',
    '휴대폰 번호': 'phone',
    회사전화: 'phone',  // 다음 메일 (휴대폰이 없을 때 대체)
    집전화: 'phone',
    'Phone': 'phone',
    'Mobile': 'phone',
    'Mobile Phone': 'phone',

    department: 'department',
    부서: 'department',
    'Department': 'department',

    memo: 'memo',
    메모: 'memo',
    비고: 'memo',
    'Notes': 'memo',
    'Memo': 'memo',
  },
}

// 이메일 유효성 검사
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// 컬럼명을 표준 필드명으로 변환
function normalizeColumnName(columnName: string): string | null {
  const trimmed = columnName.trim()

  // 공통 매핑에서 찾기
  const mapping = COLUMN_MAPPINGS.common[trimmed]
  if (mapping) return mapping

  // 대소문자 무시하고 찾기
  const lowerTrimmed = trimmed.toLowerCase()
  for (const [key, value] of Object.entries(COLUMN_MAPPINGS.common)) {
    if (key.toLowerCase() === lowerTrimmed) {
      return value
    }
  }

  return null
}

// 파일 버퍼에서 주소록 파싱
export async function parseAddressBookFile(
  buffer: ArrayBuffer,
  filename: string
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    contacts: [],
    errors: [],
    duplicates: [],
    totalRows: 0,
  }

  try {
    // 파일 읽기
    const workbook = XLSX.read(buffer, { type: 'array' })

    // 첫 번째 시트 사용
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      result.errors.push('파일에 시트가 없습니다.')
      return result
    }

    const worksheet = workbook.Sheets[sheetName]

    // JSON으로 변환
    const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
      defval: '',
    })

    result.totalRows = rawData.length

    if (rawData.length === 0) {
      result.errors.push('파일에 데이터가 없습니다.')
      return result
    }

    // 첫 번째 행의 컬럼명 확인
    const firstRow = rawData[0]
    const columnNames = Object.keys(firstRow)

    // 컬럼 매핑 생성
    const columnMap: Record<string, string> = {}
    let hasEmailColumn = false

    for (const col of columnNames) {
      const normalized = normalizeColumnName(col)
      if (normalized) {
        columnMap[col] = normalized
        if (normalized === 'email') hasEmailColumn = true
      }
    }

    if (!hasEmailColumn) {
      result.errors.push(`이메일 컬럼을 찾을 수 없습니다. 발견된 컬럼: ${columnNames.join(', ')}`)
      return result
    }

    // 중복 체크용 Set
    const seenEmails = new Set<string>()

    // 데이터 파싱
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i]
      const rowNum = i + 2 // 헤더 제외, 1부터 시작

      const contact: Partial<ImportedContact> = {}

      // 매핑된 컬럼 값 추출
      for (const [originalCol, normalizedCol] of Object.entries(columnMap)) {
        const value = row[originalCol]
        if (value !== undefined && value !== null && value !== '') {
          contact[normalizedCol as keyof ImportedContact] = String(value).trim()
        }
      }

      // 이메일 필수 체크
      if (!contact.email) {
        result.errors.push(`${rowNum}행: 이메일이 비어있습니다.`)
        continue
      }

      // 이메일 유효성 체크
      if (!isValidEmail(contact.email)) {
        result.errors.push(`${rowNum}행: 유효하지 않은 이메일 형식입니다. (${contact.email})`)
        continue
      }

      // 중복 체크
      const emailLower = contact.email.toLowerCase()
      if (seenEmails.has(emailLower)) {
        result.duplicates.push(contact.email)
        continue
      }
      seenEmails.add(emailLower)

      // 이름이 없으면 이메일 앞부분 사용
      if (!contact.name) {
        contact.name = contact.email.split('@')[0]
      }

      result.contacts.push(contact as ImportedContact)
    }

    result.success = result.contacts.length > 0

  } catch (error) {
    console.error('주소록 파싱 오류:', error)
    result.errors.push('파일을 파싱하는 중 오류가 발생했습니다.')
  }

  return result
}

// 주소록을 엑셀 파일로 내보내기
export function exportAddressBook(contacts: ImportedContact[]): ArrayBuffer {
  const worksheet = XLSX.utils.json_to_sheet(
    contacts.map((c) => ({
      이름: c.name,
      이메일: c.email,
      회사: c.company || '',
      부서: c.department || '',
      직책: c.position || '',
      전화번호: c.phone || '',
      메모: c.memo || '',
    }))
  )

  // 컬럼 너비 설정
  worksheet['!cols'] = [
    { wch: 15 }, // 이름
    { wch: 30 }, // 이메일
    { wch: 20 }, // 회사
    { wch: 15 }, // 부서
    { wch: 15 }, // 직책
    { wch: 15 }, // 전화번호
    { wch: 30 }, // 메모
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '주소록')

  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
}

// 템플릿 엑셀 파일 생성
export function createAddressBookTemplate(): ArrayBuffer {
  const sampleData = [
    {
      이름: '홍길동',
      이메일: 'hong@example.com',
      회사: 'ABC주식회사',
      부서: '영업부',
      직책: '과장',
      전화번호: '010-1234-5678',
      메모: '주요 거래처',
    },
    {
      이름: '김철수',
      이메일: 'kim@example.com',
      회사: 'XYZ기업',
      부서: '구매부',
      직책: '대리',
      전화번호: '010-9876-5432',
      메모: '',
    },
  ]

  const worksheet = XLSX.utils.json_to_sheet(sampleData)

  worksheet['!cols'] = [
    { wch: 15 },
    { wch: 30 },
    { wch: 20 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 30 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '주소록')

  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
}
