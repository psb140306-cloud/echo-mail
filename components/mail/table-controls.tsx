'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Editor } from '@tiptap/react'
import { CellSelection } from '@tiptap/pm/tables'
import { TableMap } from '@tiptap/pm/tables'

interface TableControlsProps {
  editor: Editor
}

export function TableControls({ editor }: TableControlsProps) {
  const [tableElement, setTableElement] = useState<HTMLTableElement | null>(null)
  const [showControls, setShowControls] = useState(false)
  const [controlPosition, setControlPosition] = useState({ top: 0, left: 0 })

  // 테이블 요소 찾기
  useEffect(() => {
    const updateTableElement = () => {
      const isInTable = editor.isActive('table')

      if (!isInTable) {
        setShowControls(false)
        setTableElement(null)
        return
      }

      // 현재 커서 위치에서 테이블 찾기
      const { view } = editor
      const { from } = editor.state.selection

      try {
        const domAtPos = view.domAtPos(from)
        let element = domAtPos.node as HTMLElement

        // 테이블 요소 찾기
        while (element && element.tagName !== 'TABLE') {
          element = element.parentElement as HTMLElement
        }

        if (element && element.tagName === 'TABLE') {
          const table = element as HTMLTableElement
          setTableElement(table)

          const editorRect = view.dom.getBoundingClientRect()
          const tableRect = table.getBoundingClientRect()

          setControlPosition({
            top: tableRect.top - editorRect.top,
            left: tableRect.left - editorRect.left,
          })
          setShowControls(true)
        }
      } catch {
        setShowControls(false)
      }
    }

    updateTableElement()

    editor.on('selectionUpdate', updateTableElement)
    editor.on('transaction', updateTableElement)

    return () => {
      editor.off('selectionUpdate', updateTableElement)
      editor.off('transaction', updateTableElement)
    }
  }, [editor])

  // 표 전체 선택
  const selectAllCells = useCallback(() => {
    if (!tableElement) return

    // TipTap의 selectAll 대신 모든 셀 선택을 시뮬레이션
    // 첫 번째 셀을 클릭하고 마지막 셀까지 드래그하는 효과
    const cells = tableElement.querySelectorAll('td, th')
    if (cells.length > 0) {
      // 셀에 selectedCell 클래스 추가
      cells.forEach(cell => {
        cell.classList.add('selectedCell')
      })
    }
  }, [tableElement])

  // 행 전체 선택
  const selectRow = useCallback((rowIndex: number) => {
    if (!tableElement) return

    const rows = tableElement.querySelectorAll('tr')
    if (rows[rowIndex]) {
      const cells = rows[rowIndex].querySelectorAll('td, th')
      cells.forEach(cell => {
        cell.classList.add('selectedCell')
      })
    }
  }, [tableElement])

  // 열 전체 선택
  const selectColumn = useCallback((colIndex: number) => {
    if (!tableElement) return

    const rows = tableElement.querySelectorAll('tr')
    rows.forEach(row => {
      const cells = row.querySelectorAll('td, th')
      if (cells[colIndex]) {
        cells[colIndex].classList.add('selectedCell')
      }
    })
  }, [tableElement])

  if (!showControls || !tableElement) {
    return null
  }

  const tableRect = tableElement.getBoundingClientRect()
  const rows = tableElement.querySelectorAll('tr')
  const firstRowCells = rows[0]?.querySelectorAll('td, th') || []

  return (
    <>
      {/* 왼쪽 상단 코너 - 전체 선택 */}
      <div
        className="absolute z-40 w-4 h-4 bg-muted hover:bg-primary/20 border border-border cursor-pointer flex items-center justify-center transition-colors"
        style={{
          top: `${controlPosition.top - 16}px`,
          left: `${controlPosition.left - 16}px`,
        }}
        onClick={selectAllCells}
        title="표 전체 선택"
      >
        <div className="w-2 h-2 border border-current opacity-60" />
      </div>

      {/* 상단 - 열 선택 핸들 */}
      {Array.from(firstRowCells).map((cell, index) => {
        const cellRect = cell.getBoundingClientRect()
        const editorRect = editor.view.dom.getBoundingClientRect()

        return (
          <div
            key={`col-${index}`}
            className="absolute z-40 h-4 bg-muted hover:bg-primary/20 border-x border-t border-border cursor-pointer transition-colors"
            style={{
              top: `${controlPosition.top - 16}px`,
              left: `${cellRect.left - editorRect.left}px`,
              width: `${cellRect.width}px`,
            }}
            onClick={() => selectColumn(index)}
            title={`${index + 1}열 선택`}
          />
        )
      })}

      {/* 왼쪽 - 행 선택 핸들 */}
      {Array.from(rows).map((row, index) => {
        const rowRect = row.getBoundingClientRect()
        const editorRect = editor.view.dom.getBoundingClientRect()

        return (
          <div
            key={`row-${index}`}
            className="absolute z-40 w-4 bg-muted hover:bg-primary/20 border-y border-l border-border cursor-pointer transition-colors"
            style={{
              top: `${rowRect.top - editorRect.top}px`,
              left: `${controlPosition.left - 16}px`,
              height: `${rowRect.height}px`,
            }}
            onClick={() => selectRow(index)}
            title={`${index + 1}행 선택`}
          />
        )
      })}
    </>
  )
}
