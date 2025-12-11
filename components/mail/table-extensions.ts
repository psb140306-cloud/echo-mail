'use client'

import { Extension } from '@tiptap/core'
import { TableCell as BaseTableCell } from '@tiptap/extension-table-cell'
import { TableHeader as BaseTableHeader } from '@tiptap/extension-table-header'
import { TableMap } from '@tiptap/pm/tables'
import type { Selection } from '@tiptap/pm/state'

type ResolvedTable = {
  node: any
  start: number
}

const MIN_ROW_HEIGHT = 16

const findTable = (selection: Selection): ResolvedTable | null => {
  const { $from } = selection

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)

    if (node.type.name === 'table') {
      const pos = $from.before(depth)
      return { node, start: pos + 1 }
    }
  }

  return null
}

export const ResizableTableCell = BaseTableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      height: {
        default: null,
        parseHTML: element => {
          const htmlElement = element as HTMLElement
          const styleHeight = htmlElement.style.height
          const dataHeight = htmlElement.getAttribute('data-height')

          return styleHeight || dataHeight || null
        },
        renderHTML: attributes => {
          if (!attributes.height) {
            return {}
          }

          return {
            style: `height: ${attributes.height}`,
            'data-height': attributes.height,
          }
        },
      },
    }
  },
})

export const ResizableTableHeader = BaseTableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      height: {
        default: null,
        parseHTML: element => {
          const htmlElement = element as HTMLElement
          const styleHeight = htmlElement.style.height
          const dataHeight = htmlElement.getAttribute('data-height')

          return styleHeight || dataHeight || null
        },
        renderHTML: attributes => {
          if (!attributes.height) {
            return {}
          }

          return {
            style: `height: ${attributes.height}`,
            'data-height': attributes.height,
          }
        },
      },
    }
  },
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableRowHeight: {
      /**
       * Set the height (px) for a specific row across all its cells.
       */
      setRowHeight: (rowIndex: number, height: number | null) => ReturnType
    }
  }
}

export const TableRowHeightExtension = Extension.create({
  name: 'tableRowHeight',

  addCommands() {
    return {
      setRowHeight:
        (rowIndex: number, height: number | null) =>
          ({ state, dispatch }) => {
            const table = findTable(state.selection)

            if (!table) return false

            const map = TableMap.get(table.node)

            if (rowIndex < 0 || rowIndex >= map.height) {
              return false
            }

            const targetHeight =
              typeof height === 'number'
                ? `${Math.max(MIN_ROW_HEIGHT, Math.round(height))}px`
                : null

            let tr = state.tr

            for (let colIndex = 0; colIndex < map.width; colIndex += 1) {
              const mapIndex = rowIndex * map.width + colIndex
              const cellPos = map.map[mapIndex]
              const cell = table.node.nodeAt(cellPos)

              if (!cell) continue

              const pos = table.start + cellPos
              const attrs = {
                ...cell.attrs,
                height: targetHeight,
              }

              tr = tr.setNodeMarkup(pos, cell.type, attrs, cell.marks)
            }

            if (tr.docChanged && dispatch) {
              dispatch(tr)
              return true
            }

            return false
          },
    }
  },
})
