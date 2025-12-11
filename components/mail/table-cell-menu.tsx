'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Editor } from '@tiptap/react'
import { CellSelection } from '@tiptap/pm/tables'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Merge,
  Split,
  Plus,
  Trash2,
  Paintbrush,
  RowsIcon,
  Columns,
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
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [customColor, setCustomColor] = useState('#ffffff')
  const [selectedCellCount, setSelectedCellCount] = useState(0)

  // 테이블 셀 드래그 선택 감지 (여러 셀 선택 시에만 메뉴 표시)
  useEffect(() => {
    const checkSelection = () => {
      const isInTable = editor.isActive('table')
      const { selection } = editor.state

      // CellSelection인 경우에만 메뉴 표시 (드래그로 여러 셀 선택)
      if (isInTable && selection instanceof CellSelection) {
        // 선택된 셀 개수 확인
        const cellCount = selection.$anchorCell && selection.$headCell ?
          Math.abs(selection.$headCell.pos - selection.$anchorCell.pos) > 0 ? 2 : 1 : 0

        // DOM에서 selectedCell 클래스를 가진 요소 수 확인
        const selectedCells = editor.view.dom.querySelectorAll('.selectedCell')
        const actualCount = selectedCells.length

        setSelectedCellCount(actualCount)

        // 2개 이상의 셀이 선택된 경우에만 메뉴 표시
        if (actualCount >= 2) {
          setShowMenu(true)
        } else {
          setShowMenu(false)
          setColorPickerOpen(false)
        }
      } else {
        setShowMenu(false)
        setColorPickerOpen(false)
        setSelectedCellCount(0)
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
    setColorPickerOpen(false)
  }, [editor])

  if (!showMenu || !editor.isActive('table')) {
    return null
  }

  return (
    <div className="border-b px-2 py-1 bg-muted/20">
      <div className="flex items-center gap-1 p-1 bg-background border rounded-lg shadow-sm">
      {/* 병합 */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs"
        onClick={() => editor.chain().focus().mergeCells().run()}
        title="셀 병합"
      >
        <Merge className="h-3.5 w-3.5 mr-1" />
        병합
      </Button>

      {/* 분할 */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs"
        onClick={() => editor.chain().focus().splitCell().run()}
        title="셀 분할"
      >
        <Split className="h-3.5 w-3.5 mr-1" />
        분할
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* 삽입 */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-blue-600">
            <Plus className="h-3.5 w-3.5 mr-1" />
            삽입
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="grid grid-cols-2 gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 justify-start text-xs"
              onClick={() => editor.chain().focus().addRowBefore().run()}
            >
              <RowsIcon className="h-3.5 w-3.5 mr-1" />
              행 (위)
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 justify-start text-xs"
              onClick={() => editor.chain().focus().addColumnBefore().run()}
            >
              <Columns className="h-3.5 w-3.5 mr-1" />
              열 (왼쪽)
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 justify-start text-xs"
              onClick={() => editor.chain().focus().addRowAfter().run()}
            >
              <RowsIcon className="h-3.5 w-3.5 mr-1" />
              행 (아래)
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 justify-start text-xs"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            >
              <Columns className="h-3.5 w-3.5 mr-1" />
              열 (오른쪽)
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* 삭제 */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-red-600">
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            삭제
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 justify-start text-xs"
              onClick={() => editor.chain().focus().deleteRow().run()}
            >
              <RowsIcon className="h-3.5 w-3.5 mr-1" />
              행 삭제
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 justify-start text-xs"
              onClick={() => editor.chain().focus().deleteColumn().run()}
            >
              <Columns className="h-3.5 w-3.5 mr-1" />
              열 삭제
            </Button>
            <Separator className="my-1" />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 justify-start text-xs text-red-600"
              onClick={() => editor.chain().focus().deleteTable().run()}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              표 전체 삭제
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* 셀 배경색 */}
      <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
            <Paintbrush className="h-3.5 w-3.5 mr-1" />
            셀배경색
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <div className="space-y-3">
            <Label className="text-xs font-medium">셀 배경색</Label>

            {/* 프리셋 색상 */}
            <div className="grid grid-cols-5 gap-1">
              {CELL_COLORS.map((color) => (
                <button
                  key={color.value || 'none'}
                  type="button"
                  onClick={() => setCellBackground(color.value)}
                  className="w-7 h-7 rounded border border-gray-300 hover:scale-110 transition-transform relative"
                  style={{ backgroundColor: color.value || '#fff' }}
                  title={color.name}
                >
                  {!color.value && (
                    <span className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">✕</span>
                  )}
                </button>
              ))}
            </div>

            {/* 커스텀 색상 */}
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-10 h-8 p-1 cursor-pointer"
              />
              <Input
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="flex-1 h-8 text-xs"
                placeholder="#ffffff"
              />
              <Button
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => setCellBackground(customColor)}
              >
                적용
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      </div>
    </div>
  )
}
