'use client'

import { useState, useCallback } from 'react'
import { Editor } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Table as TableIcon, Settings2 } from 'lucide-react'

interface TableInsertPopoverProps {
  editor: Editor
}

const MAX_ROWS = 10
const MAX_COLS = 10

// 테두리 스타일 옵션
const BORDER_STYLES = [
  { name: '실선', value: 'solid' },
  { name: '점선', value: 'dotted' },
  { name: '파선', value: 'dashed' },
  { name: '없음', value: 'none' },
]

// 테두리 두께 옵션
const BORDER_WIDTHS = [
  { name: '얇게', value: '1px' },
  { name: '보통', value: '2px' },
  { name: '굵게', value: '3px' },
]

export function TableInsertPopover({ editor }: TableInsertPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hoveredCell, setHoveredCell] = useState({ row: 0, col: 0 })
  const [selectedRows, setSelectedRows] = useState(3)
  const [selectedCols, setSelectedCols] = useState(3)

  // 세부 설정
  const [borderStyle, setBorderStyle] = useState('solid')
  const [borderWidth, setBorderWidth] = useState('1px')
  const [borderColor, setBorderColor] = useState('#d1d5db')
  const [cellBgColor, setCellBgColor] = useState('')
  const [headerBgColor, setHeaderBgColor] = useState('#f3f4f6')
  const [hasHeader, setHasHeader] = useState(true)

  // 그리드 셀 호버 처리
  const handleCellHover = useCallback((row: number, col: number) => {
    setHoveredCell({ row, col })
  }, [])

  // 그리드에서 표 삽입
  const handleGridInsert = useCallback((rows: number, cols: number) => {
    editor.chain().focus().insertTable({
      rows,
      cols,
      withHeaderRow: hasHeader
    }).run()
    setIsOpen(false)
  }, [editor, hasHeader])

  // 세부 설정으로 표 삽입
  const handleAdvancedInsert = useCallback(() => {
    editor.chain().focus().insertTable({
      rows: selectedRows,
      cols: selectedCols,
      withHeaderRow: hasHeader
    }).run()
    setSettingsOpen(false)
    setIsOpen(false)
  }, [editor, selectedRows, selectedCols, hasHeader])

  // 그리드 렌더링
  const renderGrid = () => {
    const cells = []
    for (let row = 1; row <= MAX_ROWS; row++) {
      for (let col = 1; col <= MAX_COLS; col++) {
        const isSelected = row <= hoveredCell.row && col <= hoveredCell.col
        cells.push(
          <div
            key={`${row}-${col}`}
            className={`w-5 h-5 border border-gray-300 cursor-pointer transition-colors ${
              isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white hover:bg-blue-100'
            }`}
            onMouseEnter={() => handleCellHover(row, col)}
            onClick={() => handleGridInsert(row, col)}
          />
        )
      }
    }
    return cells
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <TableIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">표 삽입</TooltipContent>

          <PopoverContent className="w-auto p-3" align="start">
            <div className="space-y-3">
              {/* 헤더 */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  표 삽입 {hoveredCell.row > 0 && hoveredCell.col > 0 && (
                    <span className="text-blue-600">{hoveredCell.col}x{hoveredCell.row}</span>
                  )}
                </span>

                {/* 세부 설정 다이얼로그 */}
                <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800">
                      <Settings2 className="h-3 w-3 mr-1" />
                      세부 설정
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>표 세부 설정</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {/* 행/열 개수 */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="cols">열 개수</Label>
                          <Input
                            id="cols"
                            type="number"
                            min={1}
                            max={20}
                            value={selectedCols}
                            onChange={(e) => setSelectedCols(Number(e.target.value))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rows">행 개수</Label>
                          <Input
                            id="rows"
                            type="number"
                            min={1}
                            max={20}
                            value={selectedRows}
                            onChange={(e) => setSelectedRows(Number(e.target.value))}
                          />
                        </div>
                      </div>

                      {/* 테두리 스타일 */}
                      <div className="space-y-2">
                        <Label>테두리 두께</Label>
                        <Select value={borderWidth} onValueChange={setBorderWidth}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BORDER_WIDTHS.map((width) => (
                              <SelectItem key={width.value} value={width.value}>
                                {width.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 테두리 색상 */}
                      <div className="space-y-2">
                        <Label htmlFor="borderColor">테두리 색</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="borderColor"
                            type="color"
                            value={borderColor}
                            onChange={(e) => setBorderColor(e.target.value)}
                            className="w-12 h-9 p-1 cursor-pointer"
                          />
                          <Input
                            value={borderColor}
                            onChange={(e) => setBorderColor(e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>

                      {/* 셀 배경색 */}
                      <div className="space-y-2">
                        <Label htmlFor="cellBgColor">셀 배경색</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="cellBgColor"
                            type="color"
                            value={cellBgColor || '#ffffff'}
                            onChange={(e) => setCellBgColor(e.target.value)}
                            className="w-12 h-9 p-1 cursor-pointer"
                          />
                          <Input
                            value={cellBgColor}
                            onChange={(e) => setCellBgColor(e.target.value)}
                            placeholder="투명"
                            className="flex-1"
                          />
                        </div>
                      </div>

                      {/* 헤더 행 여부 */}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="hasHeader"
                          checked={hasHeader}
                          onChange={(e) => setHasHeader(e.target.checked)}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="hasHeader" className="cursor-pointer">
                          첫 행을 헤더로 설정
                        </Label>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button onClick={handleAdvancedInsert}>
                        적용
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* 그리드 선택 영역 */}
              <div
                className="grid gap-0.5 p-1 bg-gray-100 rounded"
                style={{
                  gridTemplateColumns: `repeat(${MAX_COLS}, 1fr)`,
                }}
                onMouseLeave={() => setHoveredCell({ row: 0, col: 0 })}
              >
                {renderGrid()}
              </div>

              {/* 헤더 행 토글 */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  id="hasHeaderQuick"
                  checked={hasHeader}
                  onChange={(e) => setHasHeader(e.target.checked)}
                  className="h-3 w-3"
                />
                <label htmlFor="hasHeaderQuick" className="cursor-pointer">
                  헤더 행 포함
                </label>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </Tooltip>
    </TooltipProvider>
  )
}
