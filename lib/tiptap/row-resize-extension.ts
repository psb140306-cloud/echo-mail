import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { TableMap } from '@tiptap/pm/tables'

export interface RowResizeOptions {
  handleHeight?: number
  cellMinHeight?: number
}

interface ResizeState {
  activeHandle: number
  dragging: { startY: number; startHeight: number } | null
}

const rowResizingPluginKey = new PluginKey<ResizeState>('tableRowResizing')

function getRowAtPos(doc: any, pos: number) {
  const $pos = doc.resolve(pos)
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d)
    if (node.type.name === 'tableRow') {
      return { node, pos: $pos.before(d), start: $pos.start(d) }
    }
  }
  return null
}

function domCellAround(target: EventTarget | null): HTMLTableCellElement | null {
  while (target && (target as HTMLElement).nodeName !== 'TD' && (target as HTMLElement).nodeName !== 'TH') {
    target = (target as HTMLElement).parentNode
  }
  return target as HTMLTableCellElement | null
}

function edgeRow(view: any, event: MouseEvent, handleHeight: number): number {
  const found = view.posAtCoords({ left: event.clientX, top: event.clientY })
  if (!found) return -1

  const $pos = view.state.doc.resolve(found.pos)

  // 테이블 내부인지 확인
  let tableDepth = -1
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === 'table') {
      tableDepth = d
      break
    }
  }
  if (tableDepth === -1) return -1

  const table = $pos.node(tableDepth)
  const tableStart = $pos.start(tableDepth)
  const map = TableMap.get(table)

  // 현재 셀 찾기
  const cell = domCellAround(event.target)
  if (!cell) return -1

  const cellRect = cell.getBoundingClientRect()
  const distanceFromBottom = cellRect.bottom - event.clientY

  // 하단 테두리 근처인지 확인
  if (distanceFromBottom <= handleHeight && distanceFromBottom >= -2) {
    // 현재 행의 첫 번째 셀 위치 반환
    const row = cell.closest('tr')
    if (!row) return -1

    const rowIndex = Array.from(row.parentNode?.children || []).indexOf(row)
    if (rowIndex >= 0 && rowIndex < map.height) {
      const cellPos = map.map[rowIndex * map.width]
      return tableStart + cellPos
    }
  }

  return -1
}

function updateRowHandle(view: any, value: number) {
  view.dispatch(
    view.state.tr.setMeta(rowResizingPluginKey, { setHandle: value })
  )
}

function handleDecorations(state: any, activeHandle: number): DecorationSet {
  const decorations: Decoration[] = []
  const $pos = state.doc.resolve(activeHandle)

  // 테이블 찾기
  let tableDepth = -1
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === 'table') {
      tableDepth = d
      break
    }
  }
  if (tableDepth === -1) return DecorationSet.empty

  const table = $pos.node(tableDepth)
  const tableStart = $pos.start(tableDepth)
  const map = TableMap.get(table)

  // activeHandle이 속한 행 찾기
  const cellOffset = activeHandle - tableStart
  let rowIndex = -1
  for (let r = 0; r < map.height; r++) {
    for (let c = 0; c < map.width; c++) {
      if (map.map[r * map.width + c] === cellOffset) {
        rowIndex = r
        break
      }
    }
    if (rowIndex !== -1) break
  }

  if (rowIndex === -1) return DecorationSet.empty

  // 해당 행의 모든 셀에 decoration 추가
  for (let col = 0; col < map.width; col++) {
    const cellPos = map.map[rowIndex * map.width + col]
    const cellNode = table.nodeAt(cellPos)
    if (cellNode) {
      const handle = document.createElement('div')
      handle.className = 'row-resize-handle-active'
      handle.style.cssText = `
        position: absolute;
        left: 0;
        right: 0;
        bottom: -2px;
        height: 4px;
        background-color: #3b82f6;
        cursor: row-resize;
        z-index: 50;
        pointer-events: none;
      `

      const from = tableStart + cellPos
      const to = from + cellNode.nodeSize
      decorations.push(
        Decoration.node(from, to, {
          class: 'row-resize-target',
          style: 'position: relative;'
        })
      )
    }
  }

  // 행 전체에 파란색 라인 표시를 위한 위젯
  const firstCellPos = map.map[rowIndex * map.width]
  const firstCellNode = table.nodeAt(firstCellPos)
  if (firstCellNode) {
    const lineWidget = document.createElement('div')
    lineWidget.className = 'row-resize-line'
    lineWidget.style.cssText = `
      position: absolute;
      left: 0;
      right: 0;
      bottom: -2px;
      height: 4px;
      background-color: #3b82f6;
      cursor: row-resize;
      z-index: 100;
    `
    decorations.push(
      Decoration.widget(tableStart + firstCellPos + firstCellNode.nodeSize - 1, lineWidget, { side: 1 })
    )
  }

  return DecorationSet.create(state.doc, decorations)
}

function currentRowHeight(view: any, cellPos: number): number {
  const dom = view.domAtPos(cellPos)
  const cell = dom.node.closest ? dom.node.closest('td, th') : dom.node.parentElement?.closest('td, th')
  if (!cell) return 40

  const row = cell.closest('tr')
  return row ? row.offsetHeight : 40
}

export const RowResizeExtension = Extension.create<RowResizeOptions>({
  name: 'rowResize',

  addOptions() {
    return {
      handleHeight: 8,
      cellMinHeight: 24,
    }
  },

  addProseMirrorPlugins() {
    const handleHeight = this.options.handleHeight || 8
    const cellMinHeight = this.options.cellMinHeight || 24

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
          if (tr.docChanged && prev.activeHandle > -1) {
            // 문서가 변경되면 핸들 리셋
            return { activeHandle: -1, dragging: null }
          }
          return prev
        },
      },

      props: {
        attributes(state) {
          const pluginState = rowResizingPluginKey.getState(state)
          return pluginState && pluginState.activeHandle > -1
            ? { class: 'row-resize-cursor' }
            : {}
        },

        handleDOMEvents: {
          mousemove: (view, event) => {
            if (!view.editable) return false

            const pluginState = rowResizingPluginKey.getState(view.state)
            if (!pluginState) return false

            if (pluginState.dragging) {
              // 드래그 중
              const { startY, startHeight } = pluginState.dragging
              const deltaY = event.clientY - startY
              const newHeight = Math.max(cellMinHeight, startHeight + deltaY)

              // 현재 활성 핸들의 행 찾아서 높이 적용
              if (pluginState.activeHandle > -1) {
                const dom = view.domAtPos(pluginState.activeHandle)
                const cell = dom.node.closest ? dom.node.closest('td, th') :
                             dom.node.parentElement?.closest('td, th')
                if (cell) {
                  const row = cell.closest('tr') as HTMLTableRowElement
                  if (row) {
                    row.style.height = `${newHeight}px`
                    const cells = row.querySelectorAll('td, th')
                    cells.forEach((c) => {
                      (c as HTMLElement).style.height = `${newHeight}px`;
                      (c as HTMLElement).style.minHeight = `${newHeight}px`
                    })
                  }
                }
              }
              return true
            }

            // 핸들 감지
            const handle = edgeRow(view, event, handleHeight)
            if (handle !== pluginState.activeHandle) {
              updateRowHandle(view, handle)
            }
            return false
          },

          mouseleave: (view) => {
            const pluginState = rowResizingPluginKey.getState(view.state)
            if (pluginState && pluginState.activeHandle > -1 && !pluginState.dragging) {
              updateRowHandle(view, -1)
            }
            return false
          },

          mousedown: (view, event) => {
            if (!view.editable) return false

            const pluginState = rowResizingPluginKey.getState(view.state)
            if (!pluginState || pluginState.activeHandle === -1 || pluginState.dragging) {
              return false
            }

            event.preventDefault()

            const startHeight = currentRowHeight(view, pluginState.activeHandle)

            view.dispatch(
              view.state.tr.setMeta(rowResizingPluginKey, {
                setDragging: { startY: event.clientY, startHeight }
              })
            )

            const onMouseMove = (e: MouseEvent) => {
              const state = rowResizingPluginKey.getState(view.state)
              if (!state?.dragging) return

              const { startY, startHeight } = state.dragging
              const deltaY = e.clientY - startY
              const newHeight = Math.max(cellMinHeight, startHeight + deltaY)

              if (state.activeHandle > -1) {
                const dom = view.domAtPos(state.activeHandle)
                const cell = dom.node.closest ? dom.node.closest('td, th') :
                             dom.node.parentElement?.closest('td, th')
                if (cell) {
                  const row = cell.closest('tr') as HTMLTableRowElement
                  if (row) {
                    row.style.height = `${newHeight}px`
                    const cells = row.querySelectorAll('td, th')
                    cells.forEach((c) => {
                      (c as HTMLElement).style.height = `${newHeight}px`;
                      (c as HTMLElement).style.minHeight = `${newHeight}px`
                    })
                  }
                }
              }
            }

            const onMouseUp = () => {
              window.removeEventListener('mousemove', onMouseMove)
              window.removeEventListener('mouseup', onMouseUp)

              view.dispatch(
                view.state.tr.setMeta(rowResizingPluginKey, { setDragging: null })
              )

              // 핸들도 리셋
              updateRowHandle(view, -1)
            }

            window.addEventListener('mousemove', onMouseMove)
            window.addEventListener('mouseup', onMouseUp)

            return true
          },
        },

        decorations(state) {
          const pluginState = rowResizingPluginKey.getState(state)
          if (pluginState && pluginState.activeHandle > -1) {
            return handleDecorations(state, pluginState.activeHandle)
          }
          return DecorationSet.empty
        },
      },
    })

    return [plugin]
  },
})
