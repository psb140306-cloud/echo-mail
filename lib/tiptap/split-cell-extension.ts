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
       * - 선택된 모든 셀 오른쪽에 새 셀 추가
       * - 다른 행의 같은 열 위치 셀들은 colspan 증가
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
          const processedCells = new Set<number>()

          // 선택된 모든 셀에 대해 처리 (오른쪽 열부터 역순으로 처리해야 위치가 안 꼬임)
          for (let col = right - 1; col >= left; col--) {
            for (let row = top; row < bottom; row++) {
              const cellPos = map.map[row * map.width + col]

              // 이미 처리한 셀은 건너뛰기 (rowspan/colspan으로 인한 중복)
              if (processedCells.has(cellPos)) continue
              processedCells.add(cellPos)

              const cell = table.nodeAt(cellPos)
              if (!cell) continue

              const absoluteCellPos = tableStart + cellPos
              const insertPos = absoluteCellPos + cell.nodeSize

              // 새 셀 생성 (같은 타입, 같은 rowspan)
              const newCell = cell.type.createAndFill({
                ...cell.attrs,
                colspan: 1,
                rowspan: cell.attrs.rowspan || 1,
              })

              if (newCell) {
                insertions.push({ pos: insertPos, node: newCell })
              }
            }
          }

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
       * - 선택된 각 행 아래에 새 행 추가
       * - 선택된 셀들만 분할됨
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
          const processedCells = new Set<number>()

          // 선택된 각 행에 대해 처리 (아래 행부터 역순으로)
          for (let row = bottom - 1; row >= top; row--) {
            const newRowCells: ProseMirrorNode[] = []

            // 선택된 열 범위의 셀만 분할
            for (let col = left; col < right; col++) {
              const cellPos = map.map[row * map.width + col]

              // 이미 처리한 셀은 건너뛰기
              if (processedCells.has(cellPos)) continue
              processedCells.add(cellPos)

              const cell = table.nodeAt(cellPos)
              if (!cell) continue

              // 새 셀 생성 (같은 타입, 같은 colspan)
              const newCell = cell.type.createAndFill({
                ...cell.attrs,
                colspan: cell.attrs.colspan || 1,
                rowspan: 1,
              })

              if (newCell) {
                newRowCells.push(newCell)
              }
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
