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
       * - 현재 셀 오른쪽에 새 셀 추가
       * - 다른 행의 같은 열 위치 셀들은 colspan + 1
       */
      splitCellHorizontally:
        () =>
        ({ state, dispatch, tr }) => {
          const sel = state.selection

          // 테이블 내에 있는지 확인
          if (!(sel instanceof CellSelection)) {
            // 일반 텍스트 선택인 경우도 테이블 내부일 수 있음
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

          const { table, tableStart, map, left, top } = rect

          // 현재 셀 정보
          const cellPos = map.map[top * map.width + left]
          const cell = table.nodeAt(cellPos)
          if (!cell) return false

          const cellColspan = cell.attrs.colspan || 1
          const cellRowspan = cell.attrs.rowspan || 1

          if (!dispatch) return true

          let transaction = tr
          const insertions: Array<{ pos: number; node: ProseMirrorNode }> = []
          const colspanUpdates: Array<{ pos: number; colspan: number }> = []

          // 모든 행을 순회
          for (let row = 0; row < map.height; row++) {
            // 이 행에서 분할 대상 열에 해당하는 셀 찾기
            const cellPosInRow = map.map[row * map.width + left]
            const cellInRow = table.nodeAt(cellPosInRow)
            if (!cellInRow) continue

            const rowspan = cellInRow.attrs.rowspan || 1
            const colspan = cellInRow.attrs.colspan || 1

            // 이 셀이 분할 대상 셀인지 확인 (같은 행 범위)
            if (row >= top && row < top + cellRowspan) {
              // 분할 대상 셀 바로 뒤에 새 셀 삽입
              const absoluteCellPos = tableStart + cellPosInRow
              const insertPos = absoluteCellPos + cellInRow.nodeSize

              const newCell = cellInRow.type.createAndFill({
                ...cellInRow.attrs,
                colspan: 1,
                rowspan: rowspan,
              })

              if (newCell && row === top) {
                // 첫 번째 행에서만 삽입 (rowspan > 1인 경우 중복 방지)
                insertions.push({ pos: insertPos, node: newCell })
              }

              // 중복 방지: 같은 셀은 한 번만 처리
              row += rowspan - 1
            } else {
              // 다른 행의 셀 - colspan 증가
              const absoluteCellPos = tableStart + cellPosInRow

              // 이미 업데이트 목록에 있는지 확인 (rowspan으로 인한 중복 방지)
              const alreadyUpdated = colspanUpdates.some(u => u.pos === absoluteCellPos)
              if (!alreadyUpdated) {
                colspanUpdates.push({
                  pos: absoluteCellPos,
                  colspan: colspan + 1,
                })
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

          // 새 셀 삽입 (역순으로)
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
       * - 현재 행 아래에 새 행 추가
       * - 다른 열의 같은 행 위치 셀들은 rowspan + 1
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

          const { table, tableStart, map, left, top } = rect

          // 현재 셀 정보
          const cellPos = map.map[top * map.width + left]
          const cell = table.nodeAt(cellPos)
          if (!cell) return false

          const cellColspan = cell.attrs.colspan || 1
          const cellRowspan = cell.attrs.rowspan || 1

          if (!dispatch) return true

          let transaction = tr
          const newRowCells: ProseMirrorNode[] = []
          const rowspanUpdates: Array<{ pos: number; rowspan: number }> = []

          // 현재 행의 모든 열을 순회
          const processedCols = new Set<number>()

          for (let col = 0; col < map.width; col++) {
            if (processedCols.has(col)) continue

            const cellPosInCol = map.map[top * map.width + col]
            const cellInCol = table.nodeAt(cellPosInCol)
            if (!cellInCol) continue

            const colspan = cellInCol.attrs.colspan || 1
            const rowspan = cellInCol.attrs.rowspan || 1

            // 해당 셀이 차지하는 모든 열 표시
            for (let c = col; c < col + colspan; c++) {
              processedCols.add(c)
            }

            // 분할 대상 열인지 확인
            if (col >= left && col < left + cellColspan) {
              // 분할 대상 셀 - 새 행에 빈 셀 추가
              const newCell = cellInCol.type.createAndFill({
                ...cellInCol.attrs,
                colspan: colspan,
                rowspan: 1,
              })
              if (newCell) {
                newRowCells.push(newCell)
              }
            } else {
              // 다른 열의 셀 - rowspan 증가
              const absoluteCellPos = tableStart + cellPosInCol
              rowspanUpdates.push({
                pos: absoluteCellPos,
                rowspan: rowspan + 1,
              })
            }
          }

          // rowspan 업데이트 적용
          rowspanUpdates.forEach(({ pos, rowspan }) => {
            const nodeAtPos = state.doc.nodeAt(pos)
            if (nodeAtPos) {
              transaction = transaction.setNodeMarkup(pos, undefined, {
                ...nodeAtPos.attrs,
                rowspan,
              })
            }
          })

          // 새 행 생성 및 삽입
          if (newRowCells.length > 0) {
            const tableRowType = state.schema.nodes.tableRow
            const newRow = tableRowType.create(null, newRowCells)

            // 현재 행 다음 위치 계산
            let insertPos = tableStart
            for (let i = 0; i <= top; i++) {
              insertPos += table.child(i).nodeSize
            }

            transaction = transaction.insert(insertPos, newRow)
          }

          dispatch(transaction)
          return true
        },
    }
  },
})
