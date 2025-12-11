import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

/**
 * 테이블 행 높이 조절 확장
 *
 * 행의 하단 테두리 근처에서 마우스를 드래그하면
 * 행 높이를 조절할 수 있음
 */

const rowResizePluginKey = new PluginKey('rowResize')

export const RowResizeExtension = Extension.create({
  name: 'rowResize',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: rowResizePluginKey,

        props: {
          handleDOMEvents: {
            mousemove(view, event) {
              const target = event.target as HTMLElement
              const cell = target.closest('td, th') as HTMLTableCellElement

              if (!cell) {
                document.body.style.cursor = ''
                return false
              }

              const row = cell.closest('tr') as HTMLTableRowElement
              if (!row) return false

              const cellRect = cell.getBoundingClientRect()
              const distanceFromBottom = cellRect.bottom - event.clientY

              // 하단 6px 이내에서 row-resize 커서 표시
              if (distanceFromBottom <= 6 && distanceFromBottom >= 0) {
                document.body.style.cursor = 'row-resize'
              } else {
                // column-resize 핸들이 아닐 때만 커서 초기화
                const distanceFromRight = cellRect.right - event.clientX
                if (distanceFromRight > 6 || distanceFromRight < 0) {
                  document.body.style.cursor = ''
                }
              }

              return false
            },

            mousedown(view, event) {
              const target = event.target as HTMLElement
              const cell = target.closest('td, th') as HTMLTableCellElement

              if (!cell) return false

              const row = cell.closest('tr') as HTMLTableRowElement
              if (!row) return false

              const cellRect = cell.getBoundingClientRect()
              const distanceFromBottom = cellRect.bottom - event.clientY

              // 하단 6px 이내에서만 리사이즈 시작
              if (distanceFromBottom > 6 || distanceFromBottom < 0) {
                return false
              }

              event.preventDefault()

              const startY = event.clientY
              const startHeight = row.offsetHeight

              const handleMouseMove = (e: MouseEvent) => {
                const deltaY = e.clientY - startY
                const newHeight = Math.max(24, startHeight + deltaY) // 최소 24px

                // 행에 높이 설정
                row.style.height = `${newHeight}px`

                // 모든 셀에도 높이 적용
                const cells = row.querySelectorAll('td, th')
                cells.forEach((c) => {
                  (c as HTMLElement).style.height = `${newHeight}px`
                  (c as HTMLElement).style.minHeight = `${newHeight}px`
                })
              }

              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove)
                document.removeEventListener('mouseup', handleMouseUp)
                document.body.style.cursor = ''
                document.body.style.userSelect = ''
              }

              document.body.style.cursor = 'row-resize'
              document.body.style.userSelect = 'none'
              document.addEventListener('mousemove', handleMouseMove)
              document.addEventListener('mouseup', handleMouseUp)

              return true
            },

            mouseleave() {
              document.body.style.cursor = ''
              return false
            },
          },
        },
      }),
    ]
  },
})
