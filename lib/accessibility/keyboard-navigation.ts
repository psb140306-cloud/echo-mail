/**
 * 키보드 네비게이션 유틸리티
 * - Tab/Shift+Tab 순환 네비게이션
 * - Escape 키로 모달/다이얼로그 닫기
 * - Enter/Space로 버튼 활성화
 * - Arrow Keys로 리스트 네비게이션
 */

export class KeyboardNavigation {
  /**
   * 포커스 가능한 요소 선택자
   */
  private static readonly FOCUSABLE_SELECTORS = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',')

  /**
   * 모달/다이얼로그에서 포커스 트랩 (Esc로 닫기)
   */
  static trapFocus(containerElement: HTMLElement, onClose?: () => void): () => void {
    const focusableElements = containerElement.querySelectorAll<HTMLElement>(
      this.FOCUSABLE_SELECTORS
    )
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    // 초기 포커스
    if (firstElement) {
      firstElement.focus()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape로 닫기
      if (e.key === 'Escape' && onClose) {
        e.preventDefault()
        onClose()
        return
      }

      // Tab 순환
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          // Shift + Tab (역방향)
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement?.focus()
          }
        } else {
          // Tab (정방향)
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement?.focus()
          }
        }
      }
    }

    containerElement.addEventListener('keydown', handleKeyDown)

    // Cleanup 함수 반환
    return () => {
      containerElement.removeEventListener('keydown', handleKeyDown)
    }
  }

  /**
   * 리스트에서 Arrow Key 네비게이션
   */
  static setupListNavigation(
    listElement: HTMLElement,
    itemSelector: string = '[role="option"], [role="menuitem"], [role="listitem"]'
  ): () => void {
    const handleKeyDown = (e: KeyboardEvent) => {
      const items = Array.from(listElement.querySelectorAll<HTMLElement>(itemSelector))
      const currentIndex = items.findIndex((item) => item === document.activeElement)

      if (currentIndex === -1) return

      switch (e.key) {
        case 'ArrowDown':
        case 'Down':
          e.preventDefault()
          const nextIndex = (currentIndex + 1) % items.length
          items[nextIndex]?.focus()
          break

        case 'ArrowUp':
        case 'Up':
          e.preventDefault()
          const prevIndex = (currentIndex - 1 + items.length) % items.length
          items[prevIndex]?.focus()
          break

        case 'Home':
          e.preventDefault()
          items[0]?.focus()
          break

        case 'End':
          e.preventDefault()
          items[items.length - 1]?.focus()
          break
      }
    }

    listElement.addEventListener('keydown', handleKeyDown)

    return () => {
      listElement.removeEventListener('keydown', handleKeyDown)
    }
  }

  /**
   * Skip to main content 링크 추가
   */
  static addSkipToMainLink(): void {
    const skipLink = document.createElement('a')
    skipLink.href = '#main-content'
    skipLink.className =
      'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md'
    skipLink.textContent = 'Skip to main content'

    skipLink.addEventListener('click', (e) => {
      e.preventDefault()
      const main = document.getElementById('main-content')
      if (main) {
        main.tabIndex = -1
        main.focus()
        main.removeAttribute('tabindex')
      }
    })

    document.body.insertBefore(skipLink, document.body.firstChild)
  }

  /**
   * Enter/Space 키로 버튼 역할 요소 활성화
   */
  static makeClickableWithKeyboard(element: HTMLElement, onClick: () => void): () => void {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClick()
      }
    }

    element.addEventListener('keydown', handleKeyDown)

    // role과 tabindex 설정
    if (!element.getAttribute('role')) {
      element.setAttribute('role', 'button')
    }
    if (!element.hasAttribute('tabindex')) {
      element.tabIndex = 0
    }

    return () => {
      element.removeEventListener('keydown', handleKeyDown)
    }
  }

  /**
   * 포커스 가능한 첫 요소로 포커스 이동
   */
  static focusFirstElement(containerElement: HTMLElement): void {
    const firstFocusable = containerElement.querySelector<HTMLElement>(this.FOCUSABLE_SELECTORS)
    firstFocusable?.focus()
  }

  /**
   * 이전에 포커스된 요소 복원
   */
  static saveFocus(): () => void {
    const previouslyFocused = document.activeElement as HTMLElement

    return () => {
      previouslyFocused?.focus()
    }
  }
}

export default KeyboardNavigation
