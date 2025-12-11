'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Editor } from '@tiptap/react'
import { CellSelection } from '@tiptap/pm/tables'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Grid3X3,
  RowsIcon,
  Columns,
  Trash2,
} from 'lucide-react'

interface TableCellMenuProps {
  editor: Editor
}

// 셀 배경색 프리셋
const CELL_COLORS = [
  { name: '없음', value: '' },
  { name: '빨강', value: '#fee2e2' },
  { name: '주황', value: '#ffedd5' },
  { name: '노랑', value: '#fef9c3' },
  { name: '초록', value: '#dcfce7' },
  { name: '파랑', value: '#dbeafe' },
  { name: '보라', value: '#f3e8ff' },
  { name: '분홍', value: '#fce7f3' },
  { name: '회색', value: '#f3f4f6' },
]

export function TableCellMenu({ editor }: TableCellMenuProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const [customColor, setCustomColor] = useState('#dbeafe')
  const [hasMultipleCellsSelected, setHasMultipleCellsSelected] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // 테이블 셀 선택 감지 및 위치 계산
  useEffect(() => {
    const checkSelection = () => {
      const isInTable = editor.isActive('table')
      const { selection } = editor.state

      if (!isInTable) {
        setShowMenu(false)
        return
      }

      // CellSelection 확인 (여러 셀 드래그 선택)
      const isCellSelection = selection instanceof CellSelection
      setHasMultipleCellsSelected(isCellSelection)

      // 선택된 셀의 위치 계산
      const { view } = editor

      // selectedCell 클래스가 있는 요소 찾기
      const selectedCells = view.dom.querySelectorAll('.selectedCell')

      if (selectedCells.length > 0) {
        // 선택된 셀들의 영역 계산
        const firstCell = selectedCells[0] as HTMLElement
        const lastCell = selectedCells[selectedCells.length - 1] as HTMLElement
        const editorRect = view.dom.getBoundingClientRect()

        const firstRect = firstCell.getBoundingClientRect()
        const lastRect = lastCell.getBoundingClientRect()

        // 선택 영역의 중앙 하단에 메뉴 배치
        const centerX = (firstRect.left + lastRect.right) / 2 - editorRect.left
        const bottomY = lastRect.bottom - editorRect.top + 8

        setMenuPosition({
          top: bottomY,
          left: centerX,
        })
        setShowMenu(true)
      } else {
        // 단일 셀 선택 (커서만 있는 경우)
        const { from } = selection
        try {
          const domAtPos = view.domAtPos(from)
          let cellElement = domAtPos.node as HTMLElement

          while (cellElement && !['TD', 'TH'].includes(cellElement.tagName)) {
            cellElement = cellElement.parentElement as HTMLElement
          }

          if (cellElement) {
            const rect = cellElement.getBoundingClientRect()
            const editorRect = view.dom.getBoundingClientRect()

            setMenuPosition({
              top: rect.bottom - editorRect.top + 8,
              left: rect.left - editorRect.left + rect.width / 2,
            })
            setShowMenu(true)
          }
        } catch {
          setShowMenu(false)
        }
      }
    }

    // 초기 체크
    checkSelection()

    editor.on('selectionUpdate', checkSelection)
    editor.on('transaction', checkSelection)

    return () => {
      editor.off('selectionUpdate', checkSelection)
      editor.off('transaction', checkSelection)
    }
  }, [editor])

  // 셀 배경색 설정
  const setCellBackground = useCallback((color: string) => {
    if (color) {
      editor.chain().focus().setCellAttribute('backgroundColor', color).run()
    } else {
      editor.chain().focus().setCellAttribute('backgroundColor', null).run()
    }
  }, [editor])

  // 표 전체 선택
  const selectAllCells = useCallback(() => {
    // TipTap의 표 전체 선택은 직접 지원하지 않아서, 표 삭제로 대체
    editor.chain().focus().deleteTable().run()
  }, [editor])

  if (!showMenu || !editor.isActive('table')) {
    return null
  }

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-background border rounded-lg shadow-lg p-3 min-w-[220px]"
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        transform: 'translateX(-50%)',
      }}
      onMouseDown={(e) => e.preventDefault()} // 메뉴 클릭 시 에디터 포커스 유지
    >
      {/* 병합 */}
      <div className="flex items-center justify-between py-1.5 px-2">
        <span className="text-sm">병합</span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => editor.chain().focus().mergeCells().run()}
          disabled={!hasMultipleCellsSelected}
        >
          <Grid3X3 className="h-3.5 w-3.5 mr-1" />
          셀 병합
        </Button>
      </div>

      {/* 분할 */}
      <div className="flex items-center justify-between py-1.5 px-2">
        <span className="text-sm">분할</span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => editor.chain().focus().splitCell().run()}
          >
            <RowsIcon className="h-3.5 w-3.5 mr-1" />
            행
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => editor.chain().focus().splitCell().run()}
          >
            <Columns className="h-3.5 w-3.5 mr-1" />
            열
          </Button>
        </div>
      </div>

      {/* 삽입 */}
      <div className="flex items-center justify-between py-1.5 px-2">
        <span className="text-sm">삽입</span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => editor.chain().focus().addRowAfter().run()}
            title="행 삽입"
          >
            <RowsIcon className="h-3.5 w-3.5 mr-1" />
            행
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            title="열 삽입"
          >
            <Columns className="h-3.5 w-3.5 mr-1" />
            열
          </Button>
        </div>
      </div>

      {/* 삭제 */}
      <div className="flex items-center justify-between py-1.5 px-2">
        <span className="text-sm text-red-600">삭제</span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:border-red-300"
            onClick={() => editor.chain().focus().deleteRow().run()}
            title="행 삭제"
          >
            <RowsIcon className="h-3.5 w-3.5 mr-1" />
            행
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:border-red-300"
            onClick={() => editor.chain().focus().deleteColumn().run()}
            title="열 삭제"
          >
            <Columns className="h-3.5 w-3.5 mr-1" />
            열
          </Button>
        </div>
      </div>

      <Separator className="my-2" />

      {/* 표 전체 삭제 */}
      <div className="flex items-center justify-between py-1.5 px-2">
        <span className="text-sm text-red-600">표 삭제</span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-3 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 hover:border-red-300"
          onClick={() => editor.chain().focus().deleteTable().run()}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          표 전체 삭제
        </Button>
      </div>

      <Separator className="my-2" />

      {/* 셀배경색 */}
      <div className="flex items-center justify-between py-1.5 px-2">
        <span className="text-sm">셀배경색</span>
        <div className="flex items-center gap-1">
          <Input
            type="color"
            value={customColor}
            onChange={(e) => {
              setCustomColor(e.target.value)
              setCellBackground(e.target.value)
            }}
            className="w-16 h-7 p-0.5 cursor-pointer border rounded"
          />
        </div>
      </div>

      {/* 색상 프리셋 */}
      <div className="grid grid-cols-9 gap-1 mt-2 px-2">
        {CELL_COLORS.map((color) => (
          <button
            key={color.value || 'none'}
            type="button"
            onClick={() => setCellBackground(color.value)}
            className="w-5 h-5 rounded border border-gray-300 hover:scale-110 transition-transform relative"
            style={{ backgroundColor: color.value || '#fff' }}
            title={color.name}
          >
            {!color.value && (
              <span className="absolute inset-0 flex items-center justify-center text-gray-400 text-[10px]">✕</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
