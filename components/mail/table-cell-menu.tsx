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
  SplitSquareVertical,
  SplitSquareHorizontal,
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
  const [selectedCellCount, setSelectedCellCount] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  // 테이블 셀 선택 감지
  useEffect(() => {
    const checkSelection = () => {
      const isInTable = editor.isActive('table')

      if (!isInTable) {
        setShowMenu(false)
        return
      }

      const { selection } = editor.state

      // CellSelection인 경우 (드래그 또는 클릭으로 셀 선택)
      if (selection instanceof CellSelection) {
        const selectedCells = editor.view.dom.querySelectorAll('.selectedCell')
        const actualCount = selectedCells.length

        setSelectedCellCount(actualCount)

        // 1개 이상의 셀이 선택된 경우 메뉴 표시
        if (actualCount >= 1) {
          const editorRect = editor.view.dom.getBoundingClientRect()
          const editorWrapper = editor.view.dom.parentElement

          // 선택된 셀들의 경계 계산
          let maxRight = 0
          let minTop = Infinity

          selectedCells.forEach((cell) => {
            const rect = (cell as HTMLElement).getBoundingClientRect()
            maxRight = Math.max(maxRight, rect.right)
            minTop = Math.min(minTop, rect.top)
          })

          // 메뉴 위치 계산 (에디터 영역 내로 제한)
          let menuLeft = maxRight - editorRect.left + 8
          let menuTop = minTop - editorRect.top

          // 메뉴 크기 예상
          const menuWidth = 220
          const menuHeight = 320

          // 메뉴가 에디터 오른쪽을 벗어나면 왼쪽에 배치
          if (menuLeft + menuWidth > editorRect.width) {
            // 선택 영역의 왼쪽에 배치
            const firstCell = selectedCells[0] as HTMLElement
            const firstCellRect = firstCell.getBoundingClientRect()
            menuLeft = firstCellRect.left - editorRect.left - menuWidth - 8

            // 그래도 벗어나면 중앙에 배치
            if (menuLeft < 0) {
              menuLeft = Math.max(10, (editorRect.width - menuWidth) / 2)
            }
          }

          // 메뉴가 에디터 아래쪽을 벗어나면 위로 조정
          if (menuTop + menuHeight > editorRect.height) {
            menuTop = editorRect.height - menuHeight - 10
          }

          // 상단 제한
          if (menuTop < 10) menuTop = 10

          setMenuPosition({ top: menuTop, left: menuLeft })
          setShowMenu(true)
        } else {
          setShowMenu(false)
        }
      } else {
        // 일반 텍스트 선택인 경우 - 테이블 내부에서 커서가 있으면 메뉴 숨김
        setShowMenu(false)
        setSelectedCellCount(0)
      }
    }

    // MutationObserver로 selectedCell 클래스 변화 감지
    const observer = new MutationObserver(() => {
      setTimeout(checkSelection, 10)
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

  // 셀을 행으로 분할 (위아래로 나눔)
  // 커스텀 ProseMirror 명령 사용
  const splitCellIntoRows = useCallback(() => {
    // 먼저 기본 splitCell 시도 (병합된 셀 분할)
    const canSplit = editor.can().splitCell()

    if (canSplit) {
      editor.chain().focus().splitCell().run()
    } else {
      // 일반 셀(1x1)인 경우: 커스텀 세로 분할 명령 사용
      editor.chain().focus().splitCellVertically().run()
    }
  }, [editor])

  // 셀을 열로 분할 (좌우로 나눔)
  // 커스텀 ProseMirror 명령 사용
  const splitCellIntoCols = useCallback(() => {
    // 먼저 기본 splitCell 시도 (병합된 셀 분할)
    const canSplit = editor.can().splitCell()

    if (canSplit) {
      editor.chain().focus().splitCell().run()
    } else {
      // 일반 셀(1x1)인 경우: 커스텀 가로 분할 명령 사용
      editor.chain().focus().splitCellHorizontally().run()
    }
  }, [editor])

  // 셀 배경색 설정 - 직접 DOM 스타일 적용
  const setCellBackground = useCallback((color: string) => {
    const selectedCells = editor.view.dom.querySelectorAll('.selectedCell')

    selectedCells.forEach((cell) => {
      const htmlCell = cell as HTMLElement
      if (color) {
        htmlCell.style.backgroundColor = color
      } else {
        htmlCell.style.backgroundColor = ''
      }
    })

    // TipTap 명령도 시도 (일부 버전에서 동작)
    try {
      if (color) {
        editor.chain().focus().setCellAttribute('backgroundColor', color).run()
      } else {
        editor.chain().focus().setCellAttribute('backgroundColor', null).run()
      }
    } catch {
      // 무시
    }
  }, [editor])

  if (!showMenu || !editor.isActive('table')) {
    return null
  }

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-background border rounded-lg shadow-lg p-2 min-w-[200px]"
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        maxHeight: '400px',
        overflowY: 'auto',
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
          disabled={selectedCellCount < 2}
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
            onClick={splitCellIntoRows}
            title="행으로 분할 (위아래로 나눔)"
          >
            <SplitSquareVertical className="h-3.5 w-3.5 mr-1" />
            행
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={splitCellIntoCols}
            title="열로 분할 (좌우로 나눔)"
          >
            <SplitSquareHorizontal className="h-3.5 w-3.5 mr-1" />
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
