/**
 * ARIA 레이블 및 스크린 리더 지원
 * - 동적 ARIA 속성 생성
 * - 라이브 리전 관리
 * - 의미 있는 레이블 제공
 */

export interface AriaLabelConfig {
  label?: string
  labelledBy?: string
  describedBy?: string
  role?: string
  expanded?: boolean
  selected?: boolean
  checked?: boolean
  current?: 'page' | 'step' | 'location' | 'date' | 'time' | boolean
  hidden?: boolean
  live?: 'off' | 'polite' | 'assertive'
  atomic?: boolean
  relevant?: 'additions' | 'removals' | 'text' | 'all'
}

export class AriaLabels {
  /**
   * 요소에 ARIA 속성 설정
   */
  static setAriaAttributes(element: HTMLElement, config: AriaLabelConfig): void {
    if (config.label) {
      element.setAttribute('aria-label', config.label)
    }

    if (config.labelledBy) {
      element.setAttribute('aria-labelledby', config.labelledBy)
    }

    if (config.describedBy) {
      element.setAttribute('aria-describedby', config.describedBy)
    }

    if (config.role) {
      element.setAttribute('role', config.role)
    }

    if (config.expanded !== undefined) {
      element.setAttribute('aria-expanded', String(config.expanded))
    }

    if (config.selected !== undefined) {
      element.setAttribute('aria-selected', String(config.selected))
    }

    if (config.checked !== undefined) {
      element.setAttribute('aria-checked', String(config.checked))
    }

    if (config.current !== undefined) {
      element.setAttribute('aria-current', String(config.current))
    }

    if (config.hidden !== undefined) {
      element.setAttribute('aria-hidden', String(config.hidden))
    }

    if (config.live) {
      element.setAttribute('aria-live', config.live)
    }

    if (config.atomic !== undefined) {
      element.setAttribute('aria-atomic', String(config.atomic))
    }

    if (config.relevant) {
      element.setAttribute('aria-relevant', config.relevant)
    }
  }

  /**
   * 라이브 리전 생성 (동적 콘텐츠 알림용)
   */
  static createLiveRegion(
    type: 'polite' | 'assertive' = 'polite',
    atomic: boolean = true
  ): HTMLElement {
    const liveRegion = document.createElement('div')
    liveRegion.setAttribute('role', 'status')
    liveRegion.setAttribute('aria-live', type)
    liveRegion.setAttribute('aria-atomic', String(atomic))
    liveRegion.className = 'sr-only'
    document.body.appendChild(liveRegion)
    return liveRegion
  }

  /**
   * 라이브 리전에 메시지 발표
   */
  static announce(message: string, type: 'polite' | 'assertive' = 'polite'): void {
    const liveRegion = this.createLiveRegion(type)
    liveRegion.textContent = message

    // 1초 후 제거
    setTimeout(() => {
      liveRegion.remove()
    }, 1000)
  }

  /**
   * 버튼 레이블 생성
   */
  static getButtonLabel(action: string, target?: string): string {
    if (target) {
      return `${action} ${target}`
    }
    return action
  }

  /**
   * 폼 필드 레이블 검증
   */
  static validateFormLabels(formElement: HTMLFormElement): {
    valid: boolean
    missing: string[]
  } {
    const inputs = formElement.querySelectorAll('input, select, textarea')
    const missing: string[] = []

    inputs.forEach((input) => {
      const hasLabel = this.hasAccessibleLabel(input as HTMLElement)
      if (!hasLabel) {
        const name = input.getAttribute('name') || input.getAttribute('id') || 'unnamed'
        missing.push(name)
      }
    })

    return {
      valid: missing.length === 0,
      missing,
    }
  }

  /**
   * 요소가 접근 가능한 레이블을 가지고 있는지 확인
   */
  static hasAccessibleLabel(element: HTMLElement): boolean {
    // aria-label 확인
    if (element.hasAttribute('aria-label')) {
      return true
    }

    // aria-labelledby 확인
    if (element.hasAttribute('aria-labelledby')) {
      return true
    }

    // <label> 태그 확인
    const id = element.id
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`)
      if (label) {
        return true
      }
    }

    // title 속성 확인 (차선책)
    if (element.hasAttribute('title')) {
      return true
    }

    // placeholder는 레이블이 아님
    return false
  }

  /**
   * 테이블에 ARIA 추가
   */
  static enhanceTable(tableElement: HTMLTableElement): void {
    // role 설정
    tableElement.setAttribute('role', 'table')

    // caption 확인
    const caption = tableElement.querySelector('caption')
    if (caption) {
      const captionId = `table-caption-${Date.now()}`
      caption.id = captionId
      tableElement.setAttribute('aria-labelledby', captionId)
    }

    // thead 설정
    const thead = tableElement.querySelector('thead')
    if (thead) {
      thead.setAttribute('role', 'rowgroup')
    }

    // tbody 설정
    const tbody = tableElement.querySelector('tbody')
    if (tbody) {
      tbody.setAttribute('role', 'rowgroup')
    }

    // 헤더 셀
    const headers = tableElement.querySelectorAll('th')
    headers.forEach((th) => {
      th.setAttribute('role', 'columnheader')
      if (!th.hasAttribute('scope')) {
        th.setAttribute('scope', 'col')
      }
    })

    // 데이터 행
    const rows = tableElement.querySelectorAll('tbody tr')
    rows.forEach((tr) => {
      tr.setAttribute('role', 'row')
      const cells = tr.querySelectorAll('td')
      cells.forEach((td) => {
        td.setAttribute('role', 'cell')
      })
    })
  }

  /**
   * 네비게이션에 ARIA 추가
   */
  static enhanceNavigation(navElement: HTMLElement, label: string): void {
    navElement.setAttribute('role', 'navigation')
    navElement.setAttribute('aria-label', label)

    const links = navElement.querySelectorAll('a')
    links.forEach((link) => {
      // 현재 페이지 표시
      if (link.getAttribute('aria-current') !== 'page') {
        const href = link.getAttribute('href')
        const currentPath = window.location.pathname
        if (href === currentPath) {
          link.setAttribute('aria-current', 'page')
        }
      }
    })
  }

  /**
   * 로딩 인디케이터에 ARIA 추가
   */
  static createLoadingIndicator(message: string = 'Loading...'): HTMLElement {
    const indicator = document.createElement('div')
    indicator.setAttribute('role', 'status')
    indicator.setAttribute('aria-live', 'polite')
    indicator.setAttribute('aria-label', message)

    const spinner = document.createElement('div')
    spinner.setAttribute('aria-hidden', 'true')
    spinner.className = 'animate-spin'
    indicator.appendChild(spinner)

    const srText = document.createElement('span')
    srText.className = 'sr-only'
    srText.textContent = message
    indicator.appendChild(srText)

    return indicator
  }

  /**
   * Echo Mail 공통 레이블
   */
  static readonly COMMON_LABELS = {
    // 네비게이션
    mainNav: '주 네비게이션',
    userNav: '사용자 메뉴',
    breadcrumb: '현재 위치',

    // 폼
    required: '(필수)',
    optional: '(선택)',
    search: '검색',
    filter: '필터',

    // 액션
    close: '닫기',
    open: '열기',
    expand: '펼치기',
    collapse: '접기',
    edit: '수정',
    delete: '삭제',
    save: '저장',
    cancel: '취소',
    submit: '제출',

    // 상태
    loading: '로딩 중',
    success: '성공',
    error: '오류',
    warning: '경고',
    info: '정보',

    // 테이블
    sortAscending: '오름차순 정렬',
    sortDescending: '내림차순 정렬',
    noResults: '결과 없음',
    rowsPerPage: '페이지당 행 수',

    // 날짜/시간
    selectDate: '날짜 선택',
    selectTime: '시간 선택',
  }
}

export default AriaLabels
