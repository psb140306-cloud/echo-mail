'use client'

import { useEffect, useState, useCallback } from 'react'
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

  // 테이블 셀 드래그 선택 감지 (여러 셀 선택 시에만 메뉴 표시)
  useEffect(() => {
    const checkSelection = () => {
      const isInTable = editor.isActive('table')
      const { selection } = editor.state

      // CellSelection인 경우에만 메뉴 표시 (드래그로 여러 셀 선택)
      if (isInTable && selection instanceof CellSelection) {
        // DOM에서 selectedCell 클래스를 가진 요소 수 확인
        const selectedCells = editor.view.dom.querySelectorAll('.selectedCell')
        const actualCount = selectedCells.length

        // 2개 이상의 셀이 선택된 경우에만 메뉴 표시
        if (actualCount >= 2) {
          // 선택 영역의 위치 계산
          const firstCell = selectedCells[0] as HTMLElement
          const lastCell = selectedCells[actualCount - 1] as HTMLElement
          const editorRect = editor.view.dom.getBoundingClientRect()

          // 선택 영역의 오른쪽에 메뉴 배치
          const lastCellRect = lastCell.getBoundingClientRect()
          const firstCellRect = firstCell.getBoundingClientRect()

          // 선택 영역의 가장 오른쪽 셀의 오른쪽에 배치
          const maxRight = Math.max(lastCellRect.right, firstCellRect.right)
          const minTop = Math.min(lastCellRect.top, firstCellRect.top)

          setMenuPosition({
            top: minTop - editorRect.top,
            left: maxRight - editorRect.left + 8,
          })
          setShowMenu(true)
        } else {
          setShowMenu(false)
        }
      } else {
        setShowMenu(false)
      }
    }

    // MutationObserver로 selectedCell 클래스 변화 감지
    const observer = new MutationObserver(() => {
      checkSelection()
    })

    observer.observe(editor.view.dom, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
    })

    editor.on('selectionUpdate', checkSelection)
    editor.on('transaction', checkSelection)

    return () => {
      observer.disconnect()
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

  if (!showMenu || !editor.isActive('table')) {
    return null
  }

  return (
    <div
      className="absolute z-50 bg-background border rounded-lg shadow-lg p-2 min-w-[180px]"
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* 병합 */}
      <div className="flex items-center justify-between py-1.5 px-1">
        <span className="text-sm">병합</span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => editor.chain().focus().mergeCells().run()}
        >
          <Grid3X3 className="h-3.5 w-3.5 mr-1" />
          셀 병합
        </Button>
      </div>

      {/* 분할 */}
      <div className="flex items-center justify-between py-1.5 px-1">
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
      <div className="flex items-center justify-between py-1.5 px-1">
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
      <div className="flex items-center justify-between py-1.5 px-1">
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

      {/* 셀배경색 */}
      <div className="flex items-center justify-between py-1.5 px-1">
        <span className="text-sm">셀배경색</span>
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

      {/* 색상 프리셋 */}
      <div className="grid grid-cols-9 gap-1 mt-2 px-1">
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
