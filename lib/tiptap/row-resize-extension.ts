import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { TableMap } from '@tiptap/pm/tables'

export interface RowResizeOptions {
  handleHeight?: number
  cellMinHeight?: number
}

interface ResizeState {
  activeHandle: number // 현재 호버 중인 행의 첫 번째 셀 위치
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

// 테이블과 행 정보 찾기
function findTableAndRow(view: any, event: MouseEvent): {
  table: any;
  tableStart: number;
  map: TableMap;
  rowIndex: number;
  rowPos: number;
} | null {
  const cell = domCellAround(event.target)
  if (!cell) return null

  const row = cell.closest('tr')
  if (!row) return null

  const found = view.posAtCoords({ left: event.clientX, top: event.clientY })
  if (!found) return null

  const $pos = view.state.doc.resolve(found.pos)

  // 테이블 찾기
  let tableDepth = -1
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === 'table') {
      tableDepth = d
      break
    }
  }
  if (tableDepth === -1) return null

  const table = $pos.node(tableDepth)
  const tableStart = $pos.start(tableDepth)
  const map = TableMap.get(table)

  // 행 인덱스 찾기
  const rows = row.parentNode?.children
  if (!rows) return null
  const rowIndex = Array.from(rows).indexOf(row)
  if (rowIndex === -1 || rowIndex >= map.height) return null

  // 행의 시작 위치 계산
  let rowPos = tableStart - 1 // table 노드 자체의 위치
  for (let i = 0; i <= rowIndex; i++) {
    rowPos += 1 // 각 행 노드의 시작
    if (i < rowIndex) {
      // 이전 행들의 크기를 더함
      let rowNode = table.child(i)
      rowPos += rowNode.nodeSize - 1
    }
  }

  return { table, tableStart, map, rowIndex, rowPos }
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

// 현재 행 높이 가져오기
function getRowHeight(view: any, rowPos: number): number {
  try {
    const dom = view.domAtPos(rowPos + 1)
    if (dom && dom.node) {
      const row = dom.node.closest ? dom.node.closest('tr') :
                  (dom.node.parentElement?.closest('tr') || dom.node)
      if (row && row.offsetHeight) {
        return row.offsetHeight
      }
    }
  } catch (e) {
    // ignore
  }
  return 40 // 기본값
}

// 핸들 데코레이션 생성
function handleDecorations(state: any, cell: HTMLTableCellElement): DecorationSet {
  const decorations: Decoration[] = []

  const row = cell.closest('tr')
  if (!row) return DecorationSet.empty

  // 행 전체에 걸친 파란색 핸들 라인 생성
  const handle = document.createElement('div')
  handle.className = 'row-resize-handle-visible'
  handle.style.cssText = `
    position: absolute;
    left: 0;
    width: 100%;
    height: 4px;
    background-color: #3b82f6;
    cursor: row-resize;
    z-index: 100;
    bottom: -2px;
    pointer-events: auto;
  `

  // 테이블 wrapper에 상대 위치 기준으로 핸들 배치
  const rowRect = row.getBoundingClientRect()
  const table = row.closest('table')
  if (table) {
    const tableRect = table.getBoundingClientRect()
    handle.style.top = `${rowRect.bottom - tableRect.top - 2}px`
    handle.style.left = '0'
    handle.style.width = `${tableRect.width}px`
    handle.style.bottom = 'auto'
  }

  // 위젯으로 추가 - 테이블 시작 위치에
  const found = findPosForHandle(state, row)
  if (found !== null) {
    decorations.push(Decoration.widget(found, handle, {
      side: 1,
      key: 'row-resize-handle'
    }))
  }

  return DecorationSet.create(state.doc, decorations)
}

function findPosForHandle(state: any, row: HTMLTableRowElement): number | null {
  // 단순히 문서 시작 근처에 위젯 배치 (테이블 내부)
  const tables = document.querySelectorAll('.ProseMirror table')
  for (const table of tables) {
    if (table.contains(row)) {
      const firstCell = table.querySelector('td, th')
      if (firstCell) {
        // 대략적인 위치 반환
        return 1
      }
    }
  }
  return null
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
    let currentHoveredRow: HTMLTableRowElement | null = null
    let resizeOverlay: HTMLDivElement | null = null

    const showResizeHandle = (row: HTMLTableRowElement) => {
      if (currentHoveredRow === row && resizeOverlay) return

      hideResizeHandle()
      currentHoveredRow = row

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
      document.body.appendChild(resizeOverlay)
    }

    const hideResizeHandle = () => {
      if (resizeOverlay && resizeOverlay.parentNode) {
        resizeOverlay.parentNode.removeChild(resizeOverlay)
      }
      resizeOverlay = null
      currentHoveredRow = null
    }

    const plugin = new Plugin<ResizeState>({
      key: rowResizingPluginKey,

      state: {
        init() {
          return { activeHandle: -1, dragging: null }
        },
        apply(tr, prev) {
          const meta = tr.getMeta(rowResizingPluginKey)
          if (meta) {
            if (meta.setHandle !== undefined) {
              return { ...prev, activeHandle: meta.setHandle }
            }
            if (meta.setDragging !== undefined) {
              return { ...prev, dragging: meta.setDragging }
            }
          }
          if (tr.docChanged && prev.dragging) {
            return { activeHandle: -1, dragging: null }
          }
          return prev
        },
      },

      props: {
        attributes(state): Record<string, string> {
          const pluginState = rowResizingPluginKey.getState(state)
          if (pluginState && (pluginState.activeHandle > -1 || pluginState.dragging)) {
            return { class: 'row-resize-cursor' }
          }
          return {}
        },

        handleDOMEvents: {
          mousemove: (view, event) => {
            if (!view.editable) return false

            const pluginState = rowResizingPluginKey.getState(view.state)
            if (!pluginState) return false

            // 드래그 중이면 높이 조절
            if (pluginState.dragging) {
              const { startY, startHeight, rowPos } = pluginState.dragging
              const deltaY = event.clientY - startY
              const newHeight = Math.max(cellMinHeight, startHeight + deltaY)

              // DOM 직접 업데이트 (실시간 피드백)
              if (currentHoveredRow) {
                currentHoveredRow.style.height = `${newHeight}px`
                const cells = currentHoveredRow.querySelectorAll('td, th')
                cells.forEach((c) => {
                  (c as HTMLElement).style.height = `${newHeight}px`;
                  (c as HTMLElement).style.minHeight = `${newHeight}px`
                })

                // 핸들 위치도 업데이트
                if (resizeOverlay) {
                  const rowRect = currentHoveredRow.getBoundingClientRect()
                  resizeOverlay.style.top = `${rowRect.bottom - 3}px`
                }
              }
              return true
            }

            // 행 하단 테두리 감지
            if (isNearRowBottom(event, handleHeight)) {
              const cell = domCellAround(event.target)
              if (cell) {
                const row = cell.closest('tr') as HTMLTableRowElement
                if (row) {
                  showResizeHandle(row)
                  const info = findTableAndRow(view, event)
                  if (info) {
                    view.dispatch(
                      view.state.tr.setMeta(rowResizingPluginKey, { setHandle: info.rowPos })
                    )
                  }
                  return false
                }
              }
            } else {
              // 핸들 숨기기
              const pluginState = rowResizingPluginKey.getState(view.state)
              if (pluginState && pluginState.activeHandle > -1 && !pluginState.dragging) {
                hideResizeHandle()
                view.dispatch(
                  view.state.tr.setMeta(rowResizingPluginKey, { setHandle: -1 })
                )
              }
            }
            return false
          },

          mouseleave: (view) => {
            const pluginState = rowResizingPluginKey.getState(view.state)
            if (pluginState && pluginState.activeHandle > -1 && !pluginState.dragging) {
              hideResizeHandle()
              view.dispatch(
                view.state.tr.setMeta(rowResizingPluginKey, { setHandle: -1 })
              )
            }
            return false
          },

          mousedown: (view, event) => {
            if (!view.editable) return false

            // 핸들 위에서 클릭했는지 또는 행 하단 근처인지 확인
            const target = event.target as HTMLElement
            const isOnOverlay = target.classList.contains('row-resize-overlay')
            const isNearBottom = isNearRowBottom(event, handleHeight)

            if (!isOnOverlay && !isNearBottom) return false

            const cell = domCellAround(event.target)
            let row: HTMLTableRowElement | null = null

            if (isOnOverlay && currentHoveredRow) {
              row = currentHoveredRow
            } else if (cell) {
              row = cell.closest('tr') as HTMLTableRowElement
            }

            if (!row) return false

            event.preventDefault()

            const startHeight = row.offsetHeight
            const info = findTableAndRow(view, event)

            if (!info) return false

            currentHoveredRow = row
            showResizeHandle(row)

            // 드래그 시작
            view.dispatch(
              view.state.tr.setMeta(rowResizingPluginKey, {
                setDragging: {
                  startY: event.clientY,
                  startHeight,
                  rowPos: info.rowPos
                }
              })
            )

            const onMouseMove = (e: MouseEvent) => {
              if (!currentHoveredRow) return

              const state = rowResizingPluginKey.getState(view.state)
              if (!state?.dragging) return

              const { startY, startHeight } = state.dragging
              const deltaY = e.clientY - startY
              const newHeight = Math.max(cellMinHeight, startHeight + deltaY)

              // DOM 업데이트
              currentHoveredRow.style.height = `${newHeight}px`
              const cells = currentHoveredRow.querySelectorAll('td, th')
              cells.forEach((c) => {
                (c as HTMLElement).style.height = `${newHeight}px`;
                (c as HTMLElement).style.minHeight = `${newHeight}px`
              })

              // 핸들 위치 업데이트
              if (resizeOverlay) {
                const rowRect = currentHoveredRow.getBoundingClientRect()
                resizeOverlay.style.top = `${rowRect.bottom - 3}px`
              }
            }

            const onMouseUp = (e: MouseEvent) => {
              window.removeEventListener('mousemove', onMouseMove)
              window.removeEventListener('mouseup', onMouseUp)

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
                const tr = view.state.tr
                const $pos = view.state.doc.resolve(rowPos)

                // tableRow 노드 찾기
                for (let d = $pos.depth; d > 0; d--) {
                  const node = $pos.node(d)
                  if (node.type.name === 'tableRow') {
                    const pos = $pos.before(d)
                    tr.setNodeMarkup(pos, null, {
                      ...node.attrs,
                      height: newHeight
                    })
                    view.dispatch(tr)
                    break
                  }
                }
              } catch (e) {
                console.error('Failed to save row height:', e)
              }

              hideResizeHandle()
              view.dispatch(
                view.state.tr.setMeta(rowResizingPluginKey, { setDragging: null })
              )
            }

            window.addEventListener('mousemove', onMouseMove)
            window.addEventListener('mouseup', onMouseUp)

            return true
          },
        },
      },

      view() {
        return {
          destroy() {
            hideResizeHandle()
          }
        }
      }
    })

    return [plugin]
  },
})
