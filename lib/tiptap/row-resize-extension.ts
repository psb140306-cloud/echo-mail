import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'

export interface RowResizeOptions {
  handleHeight?: number
  cellMinHeight?: number
}

interface ResizeState {
  dragging: { startY: number; startHeight: number; rowPos: number } | null
}

const rowResizingPluginKey = new PluginKey<ResizeState>('tableRowResizing')

// 셀 요소 찾기
function domCellAround(target: EventTarget | null): HTMLTableCellElement | null {
  while (target && (target as HTMLElement).nodeName !== 'TD' && (target as HTMLElement).nodeName !== 'TH') {
    target = (target as HTMLElement).parentNode
  }
  return target as HTMLTableCellElement | null
}

// DOM 요소로부터 ProseMirror 행 위치 찾기
function findTableAndRowByElement(
  row: HTMLTableRowElement,
  view: EditorView
): { rowPos: number; rowIndex: number; cellInsideRow: number } | null {
  const table = row.closest('table')
  if (!table) return null

  // 해당 행의 첫 번째 셀에서 ProseMirror 위치 찾기
  const firstCellInRow = row.querySelector('td, th')
  if (!firstCellInRow) return null

  try {
    // 행 내부 셀의 위치를 얻음
    const cellInsideRow = view.posAtDOM(firstCellInRow, 0)
    const $cellPos = view.state.doc.resolve(cellInsideRow)

    // 테이블과 행 노드 찾기
    let tableDepth = -1
    let rowDepth = -1
    for (let d = $cellPos.depth; d > 0; d--) {
      const nodeName = $cellPos.node(d).type.name
      if (nodeName === 'tableRow' && rowDepth === -1) {
        rowDepth = d
      }
      if (nodeName === 'table') {
        tableDepth = d
        break
      }
    }
    if (tableDepth === -1 || rowDepth === -1) return null

    // 행의 시작 위치
    const rowPos = $cellPos.before(rowDepth)

    // 행 인덱스 찾기
    const tbody = row.parentNode
    const rows = tbody?.children
    if (!rows) return null
    const rowIndex = Array.from(rows).indexOf(row)

    return { rowPos, rowIndex, cellInsideRow }
  } catch (e) {
    console.error('findTableAndRowByElement error:', e)
    return null
  }
}

// 행 하단 테두리 근처인지 확인
function isNearRowBottom(event: MouseEvent, handleHeight: number): boolean {
  const cell = domCellAround(event.target)
  if (!cell) return false

  const row = cell.closest('tr') as HTMLTableRowElement
  if (!row) return false

  const rowRect = row.getBoundingClientRect()
  const distanceFromBottom = rowRect.bottom - event.clientY

  return distanceFromBottom <= handleHeight && distanceFromBottom >= -2
}

export const RowResizeExtension = Extension.create<RowResizeOptions>({
  name: 'rowResize',

  addOptions() {
    return {
      handleHeight: 10,
      cellMinHeight: 24,
    }
  },

  addProseMirrorPlugins() {
    const { handleHeight = 10, cellMinHeight = 24 } = this.options

    // 상태 변수들
    let currentHoveredRow: HTMLTableRowElement | null = null
    let resizeOverlay: HTMLDivElement | null = null
    let currentView: EditorView | null = null
    let windowMouseMoveHandler: ((e: MouseEvent) => void) | null = null
    let windowMouseUpHandler: ((e: MouseEvent) => void) | null = null

    // 리사이즈 핸들(오버레이) 표시
    const showResizeHandle = (row: HTMLTableRowElement, view: EditorView) => {
      // 같은 행이면 위치만 업데이트
      if (currentHoveredRow === row && resizeOverlay) {
        updateOverlayPosition(row)
        return
      }

      hideResizeHandle()
      currentHoveredRow = row
      currentView = view

      const table = row.closest('table')
      if (!table) return

      const rowRect = row.getBoundingClientRect()
      const tableRect = table.getBoundingClientRect()

      resizeOverlay = document.createElement('div')
      resizeOverlay.className = 'row-resize-overlay'
      resizeOverlay.style.cssText = `
        position: fixed;
        left: ${tableRect.left}px;
        top: ${rowRect.bottom - 3}px;
        width: ${tableRect.width}px;
        height: 6px;
        background-color: #3b82f6;
        cursor: row-resize;
        z-index: 9999;
        pointer-events: auto;
      `

      // overlay에 직접 mousedown 이벤트 리스너 부착
      resizeOverlay.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()

        if (!currentHoveredRow || !currentView) return

        const info = findTableAndRowByElement(currentHoveredRow, currentView)
        if (!info) return

        const startHeight = currentHoveredRow.offsetHeight
        startDragging(currentView, e.clientY, startHeight, info.rowPos)
      })

      document.body.appendChild(resizeOverlay)
    }

    // 오버레이 위치 업데이트
    const updateOverlayPosition = (row: HTMLTableRowElement) => {
      if (!resizeOverlay) return

      const table = row.closest('table')
      if (!table) return

      const rowRect = row.getBoundingClientRect()
      const tableRect = table.getBoundingClientRect()

      resizeOverlay.style.left = `${tableRect.left}px`
      resizeOverlay.style.top = `${rowRect.bottom - 3}px`
      resizeOverlay.style.width = `${tableRect.width}px`
    }

    // 리사이즈 핸들 숨기기
    const hideResizeHandle = () => {
      if (resizeOverlay && resizeOverlay.parentNode) {
        resizeOverlay.parentNode.removeChild(resizeOverlay)
      }
      resizeOverlay = null
      currentHoveredRow = null
    }

    // 드래그 시작
    const startDragging = (
      view: EditorView,
      startY: number,
      startHeight: number,
      rowPos: number
    ) => {
      // Plugin state 업데이트
      view.dispatch(
        view.state.tr.setMeta(rowResizingPluginKey, {
          setDragging: { startY, startHeight, rowPos }
        })
      )

      // 오버레이 색상 변경 (드래그 중)
      if (resizeOverlay) {
        resizeOverlay.style.backgroundColor = '#2563eb'
      }

      // window 이벤트 리스너
      windowMouseMoveHandler = (e: MouseEvent) => {
        if (!currentHoveredRow) return

        const state = rowResizingPluginKey.getState(view.state)
        if (!state?.dragging) return

        const { startY, startHeight } = state.dragging
        const deltaY = e.clientY - startY
        const newHeight = Math.max(cellMinHeight, startHeight + deltaY)

        // DOM 직접 업데이트 (실시간 피드백)
        currentHoveredRow.style.height = `${newHeight}px`
        const cells = currentHoveredRow.querySelectorAll('td, th')
        cells.forEach((c) => {
          (c as HTMLElement).style.height = `${newHeight}px`;
          (c as HTMLElement).style.minHeight = `${newHeight}px`
        })

        // 오버레이 위치 업데이트
        updateOverlayPosition(currentHoveredRow)
      }

      windowMouseUpHandler = (e: MouseEvent) => {
        // 이벤트 리스너 제거
        if (windowMouseMoveHandler) {
          window.removeEventListener('mousemove', windowMouseMoveHandler)
          windowMouseMoveHandler = null
        }
        if (windowMouseUpHandler) {
          window.removeEventListener('mouseup', windowMouseUpHandler)
          windowMouseUpHandler = null
        }

        const state = rowResizingPluginKey.getState(view.state)
        if (!state?.dragging || !currentHoveredRow) {
          hideResizeHandle()
          view.dispatch(
            view.state.tr.setMeta(rowResizingPluginKey, { setDragging: null })
          )
          return
        }

        const { startY, startHeight, rowPos } = state.dragging
        const deltaY = e.clientY - startY
        const newHeight = Math.max(cellMinHeight, startHeight + deltaY)

        // ProseMirror 문서에 높이 저장
        try {
          // rowPos는 행의 시작 위치
          const rowNode = view.state.doc.nodeAt(rowPos)

          if (rowNode && rowNode.type.name === 'tableRow') {
            const tr = view.state.tr.setNodeMarkup(rowPos, null, {
              ...rowNode.attrs,
              height: newHeight
            })
            view.dispatch(tr)
          } else {
            // fallback: rowPos + 1 위치에서 행 찾기
            const $pos = view.state.doc.resolve(rowPos + 1)
            for (let d = $pos.depth; d > 0; d--) {
              const node = $pos.node(d)
              if (node.type.name === 'tableRow') {
                const pos = $pos.before(d)
                const tr = view.state.tr.setNodeMarkup(pos, null, {
                  ...node.attrs,
                  height: newHeight
                })
                view.dispatch(tr)
                break
              }
            }
          }
        } catch (e) {
          console.error('Failed to save row height:', e)
        }

        // 상태 초기화
        hideResizeHandle()
        view.dispatch(
          view.state.tr.setMeta(rowResizingPluginKey, { setDragging: null })
        )
      }

      window.addEventListener('mousemove', windowMouseMoveHandler)
      window.addEventListener('mouseup', windowMouseUpHandler)
    }

    const plugin = new Plugin<ResizeState>({
      key: rowResizingPluginKey,

      state: {
        init() {
          return { dragging: null }
        },
        apply(tr, prev) {
          const meta = tr.getMeta(rowResizingPluginKey)
          if (meta && meta.setDragging !== undefined) {
            return { dragging: meta.setDragging }
          }
          if (tr.docChanged && prev.dragging) {
            return { dragging: null }
          }
          return prev
        },
      },

      props: {
        attributes(state): Record<string, string> {
          const pluginState = rowResizingPluginKey.getState(state)
          if (pluginState?.dragging) {
            return { class: 'row-resize-cursor' }
          }
          return {}
        },

        handleDOMEvents: {
          mousemove: (view, event) => {
            if (!view.editable) return false

            const pluginState = rowResizingPluginKey.getState(view.state)

            // 드래그 중이면 무시 (window 이벤트에서 처리)
            if (pluginState?.dragging) return false

            // 행 하단 테두리 감지
            if (isNearRowBottom(event, handleHeight)) {
              const cell = domCellAround(event.target)
              if (cell) {
                const row = cell.closest('tr') as HTMLTableRowElement
                if (row) {
                  showResizeHandle(row, view)
                  return false
                }
              }
            } else {
              // 핸들 숨기기 (단, 드래그 중이 아닐 때만)
              if (!pluginState?.dragging) {
                hideResizeHandle()
              }
            }

            return false
          },

          mouseleave: (view) => {
            const pluginState = rowResizingPluginKey.getState(view.state)
            // 드래그 중이 아닐 때만 숨기기
            if (!pluginState?.dragging) {
              // 약간의 딜레이를 주어 오버레이로 이동할 시간 확보
              setTimeout(() => {
                const state = rowResizingPluginKey.getState(view.state)
                if (!state?.dragging && resizeOverlay) {
                  // 마우스가 오버레이 위에 있는지 확인
                  const overlayRect = resizeOverlay.getBoundingClientRect()
                  const mouseX = (window as any).__lastMouseX || 0
                  const mouseY = (window as any).__lastMouseY || 0

                  if (
                    mouseX < overlayRect.left ||
                    mouseX > overlayRect.right ||
                    mouseY < overlayRect.top ||
                    mouseY > overlayRect.bottom
                  ) {
                    hideResizeHandle()
                  }
                }
              }, 100)
            }
            return false
          },

          mousedown: (view, event) => {
            if (!view.editable) return false

            // 오버레이 클릭은 오버레이 자체 이벤트 핸들러에서 처리
            const target = event.target as HTMLElement
            if (target.classList.contains('row-resize-overlay')) {
              return false
            }

            // 셀 하단 근처 직접 클릭 감지 (오버레이 없는 경우)
            if (!isNearRowBottom(event, handleHeight)) return false

            const cell = domCellAround(event.target)
            if (!cell) return false

            const row = cell.closest('tr') as HTMLTableRowElement
            if (!row) return false

            event.preventDefault()

            // 오버레이 표시하고 드래그 시작
            showResizeHandle(row, view)
            const info = findTableAndRowByElement(row, view)
            if (info) {
              startDragging(view, event.clientY, row.offsetHeight, info.rowPos)
            }

            return true
          },
        },
      },

      view() {
        // 마우스 위치 추적 (mouseleave 처리용)
        const trackMouse = (e: MouseEvent) => {
          (window as any).__lastMouseX = e.clientX;
          (window as any).__lastMouseY = e.clientY
        }
        document.addEventListener('mousemove', trackMouse)

        return {
          destroy() {
            hideResizeHandle()
            document.removeEventListener('mousemove', trackMouse)
            if (windowMouseMoveHandler) {
              window.removeEventListener('mousemove', windowMouseMoveHandler)
            }
            if (windowMouseUpHandler) {
              window.removeEventListener('mouseup', windowMouseUpHandler)
            }
          }
        }
      }
    })

    return [plugin]
  },
})
