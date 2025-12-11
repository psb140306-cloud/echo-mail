import { Extension } from '@tiptap/core'
import { TableMap, CellSelection, selectedRect, tableNodeTypes } from '@tiptap/pm/tables'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    splitCellCustom: {
      /**
       * 단일 셀을 가로로 분할 (열 추가, 다른 행의 셀은 colspan 증가)
       */
      splitCellHorizontally: () => ReturnType
      /**
       * 단일 셀을 세로로 분할 (행 추가, 다른 열의 셀은 rowspan 증가)
       */
      splitCellVertically: () => ReturnType
    }
  }
}

/**
 * 단일 셀 분할을 위한 커스텀 TipTap 확장
 *
 * ProseMirror의 기본 splitCell은 colspan/rowspan > 1인 셀만 분할 가능
 * 이 확장은 1x1 셀도 분할할 수 있게 해줌
 */
export const SplitCellExtension = Extension.create({
  name: 'splitCellCustom',

  addCommands() {
    return {
      /**
       * 셀을 가로로 분할 (왼쪽/오른쪽)
       * - 선택된 셀 오른쪽에만 새 셀 추가
       * - 다른 행의 같은 열 셀들은 colspan 증가
       */
      splitCellHorizontally:
        () =>
        ({ state, dispatch, tr }) => {
          const sel = state.selection

          // 테이블 내에 있는지 확인
          if (!(sel instanceof CellSelection)) {
            let found = false
            for (let d = sel.$from.depth; d > 0; d--) {
              if (sel.$from.node(d).type.name === 'table') {
                found = true
                break
              }
            }
            if (!found) return false
          }

          // 선택 영역 정보 가져오기
          let rect
          try {
            rect = selectedRect(state)
          } catch {
            return false
          }

          const { table, tableStart, map, left, top, right, bottom } = rect

          if (!dispatch) return true

          let transaction = tr
          const insertions: Array<{ pos: number; node: ProseMirrorNode }> = []
          const colspanUpdates: Array<{ pos: number; colspan: number }> = []
          const processedCells = new Set<number>()
          const processedForColspan = new Set<number>()

          // 선택된 열에 대해 처리 (오른쪽부터 역순으로)
          for (let col = right - 1; col >= left; col--) {
            // 모든 행을 순회
            for (let row = 0; row < map.height; row++) {
              const cellPos = map.map[row * map.width + col]
              const cell = table.nodeAt(cellPos)
              if (!cell) continue

              const rowspan = cell.attrs.rowspan || 1

              // 선택된 행 범위에 있는 셀인지 확인
              const isSelected = row >= top && row < bottom

              if (isSelected) {
                // 선택된 셀 - 오른쪽에 새 셀 추가
                if (!processedCells.has(cellPos)) {
                  processedCells.add(cellPos)

                  const absoluteCellPos = tableStart + cellPos
                  const insertPos = absoluteCellPos + cell.nodeSize

                  const newCell = cell.type.createAndFill({
                    ...cell.attrs,
                    colspan: 1,
                    rowspan: rowspan,
                  })

                  if (newCell) {
                    insertions.push({ pos: insertPos, node: newCell })
                  }
                }
              } else {
                // 선택되지 않은 행의 셀 - colspan 증가
                if (!processedForColspan.has(cellPos)) {
                  processedForColspan.add(cellPos)

                  const absoluteCellPos = tableStart + cellPos
                  const currentColspan = cell.attrs.colspan || 1
                  colspanUpdates.push({
                    pos: absoluteCellPos,
                    colspan: currentColspan + 1,
                  })
                }
              }

              // rowspan 만큼 건너뛰기
              row += rowspan - 1
            }
          }

          // colspan 업데이트 먼저 적용
          colspanUpdates.forEach(({ pos, colspan }) => {
            const nodeAtPos = state.doc.nodeAt(pos)
            if (nodeAtPos) {
              transaction = transaction.setNodeMarkup(pos, undefined, {
                ...nodeAtPos.attrs,
                colspan,
              })
            }
          })

          // 새 셀 삽입 (역순으로 정렬 후 삽입)
          insertions
            .sort((a, b) => b.pos - a.pos)
            .forEach(({ pos, node }) => {
              transaction = transaction.insert(pos, node)
            })

          dispatch(transaction)
          return true
        },

      /**
       * 셀을 세로로 분할 (위/아래)
       * - 선택된 셀 아래에만 새 셀 추가
       * - 같은 행의 다른 셀들은 rowspan 증가
       */
      splitCellVertically:
        () =>
        ({ state, dispatch, tr }) => {
          const sel = state.selection

          // 테이블 내에 있는지 확인
          if (!(sel instanceof CellSelection)) {
            let found = false
            for (let d = sel.$from.depth; d > 0; d--) {
              if (sel.$from.node(d).type.name === 'table') {
                found = true
                break
              }
            }
            if (!found) return false
          }

          // 선택 영역 정보 가져오기
          let rect
          try {
            rect = selectedRect(state)
          } catch {
            return false
          }

          const { table, tableStart, map, left, top, right, bottom } = rect

          if (!dispatch) return true

          let transaction = tr
          const rowInsertions: Array<{ insertPos: number; cells: ProseMirrorNode[] }> = []
          const rowspanUpdates: Array<{ pos: number; rowspan: number }> = []
          const processedCells = new Set<number>()
          const processedForRowspan = new Set<number>()

          // 선택된 각 행에 대해 처리 (아래 행부터 역순으로)
          for (let row = bottom - 1; row >= top; row--) {
            const newRowCells: ProseMirrorNode[] = []

            // 전체 열을 순회하면서 처리
            for (let col = 0; col < map.width; col++) {
              const cellPos = map.map[row * map.width + col]
              const cell = table.nodeAt(cellPos)
              if (!cell) continue

              const colspan = cell.attrs.colspan || 1

              // 선택된 열 범위에 있는 셀인지 확인
              const isSelected = col >= left && col < right

              if (isSelected) {
                // 선택된 셀 - 새 행에 빈 셀 추가
                if (!processedCells.has(cellPos)) {
                  processedCells.add(cellPos)

                  const newCell = cell.type.createAndFill({
                    ...cell.attrs,
                    colspan: colspan,
                    rowspan: 1,
                  })

                  if (newCell) {
                    newRowCells.push(newCell)
                  }
                }
              } else {
                // 선택되지 않은 셀 - rowspan 증가
                if (!processedForRowspan.has(cellPos)) {
                  processedForRowspan.add(cellPos)

                  const absoluteCellPos = tableStart + cellPos
                  const currentRowspan = cell.attrs.rowspan || 1
                  rowspanUpdates.push({
                    pos: absoluteCellPos,
                    rowspan: currentRowspan + 1,
                  })
                }
              }

              // colspan 만큼 건너뛰기
              col += colspan - 1
            }

            // 새 행이 있으면 삽입 위치 계산
            if (newRowCells.length > 0) {
              let insertPos = tableStart
              for (let i = 0; i <= row; i++) {
                insertPos += table.child(i).nodeSize
              }
              rowInsertions.push({ insertPos, cells: newRowCells })
            }
          }

          // rowspan 업데이트 먼저 적용
          rowspanUpdates.forEach(({ pos, rowspan }) => {
            const nodeAtPos = state.doc.nodeAt(pos)
            if (nodeAtPos) {
              transaction = transaction.setNodeMarkup(pos, undefined, {
                ...nodeAtPos.attrs,
                rowspan,
              })
            }
          })

          // 새 행 삽입 (역순으로 이미 정렬됨)
          rowInsertions.forEach(({ insertPos, cells }) => {
            const tableRowType = state.schema.nodes.tableRow
            const newRow = tableRowType.create(null, cells)
            transaction = transaction.insert(insertPos, newRow)
          })

          dispatch(transaction)
          return true
        },
    }
  },
})
