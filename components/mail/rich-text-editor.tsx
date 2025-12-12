'use client'

import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Link } from '@tiptap/extension-link'
import { Image } from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { CustomTableCell } from '@/lib/tiptap/custom-table-cell'
import { CustomTableHeader } from '@/lib/tiptap/custom-table-header'
import { SplitCellExtension } from '@/lib/tiptap/split-cell-extension'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TextAlign } from '@tiptap/extension-text-align'
import { Underline } from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import { useEffect, useState } from 'react'
import { EditorToolbar } from './editor-toolbar'
import { TableCellMenu } from './table-cell-menu'

interface RichTextEditorProps {
  content?: string
  onChange?: (html: string, text: string) => void
  placeholder?: string
  editable?: boolean
  minHeight?: string
  className?: string
}

export function RichTextEditor({
  content = '',
  onChange,
  placeholder = '메일 내용을 입력하세요...',
  editable = true,
  minHeight = '400px',
  className = '',
}: RichTextEditorProps) {
  const [isMounted, setIsMounted] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline hover:text-blue-800',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          style: 'border-collapse: collapse; border: 1px solid #1f2937;',
        },
      }),
      TableRow,
      CustomTableCell.configure({
        HTMLAttributes: {
          style: 'border: 1px solid #1f2937; padding: 8px;',
        },
      }),
      CustomTableHeader.configure({
        HTMLAttributes: {
          style: 'border: 1px solid #1f2937; padding: 8px; background-color: #ffffff;',
        },
      }),
      SplitCellExtension,
      TextAlign.configure({
        types: ['heading', 'paragraph', 'listItem'],
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    editable,
    immediatelyRender: false, // SSR 호환성
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML(), editor.getText())
      }
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm sm:prose dark:prose-invert max-w-none focus:outline-none p-4`,
        style: `min-height: ${minHeight}`,
      },
    },
  })

  // 클라이언트 사이드 렌더링 확인
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // 외부에서 content가 변경될 때 에디터 업데이트
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  // 테이블 행 높이 조절 핸들 및 이벤트 핸들러
  useEffect(() => {
    if (!editor || !isMounted) return

    const editorDom = editor.view.dom as HTMLElement
    if (!editorDom) return

    let isResizing = false
    let startY = 0
    let startHeight = 0
    let targetRow: HTMLTableRowElement | null = null
    let resizeHandle: HTMLDivElement | null = null
    let activeHandle: HTMLDivElement | null = null

    // 리사이즈 핸들 생성 함수
    const createResizeHandle = (row: HTMLTableRowElement): HTMLDivElement => {
      const handle = document.createElement('div')
      handle.className = 'row-resize-handle'
      handle.style.cssText = `
        position: absolute;
        left: 0;
        right: 0;
        height: 4px;
        background-color: transparent;
        cursor: row-resize;
        z-index: 50;
        pointer-events: auto;
      `
      return handle
    }

    // 핸들 위치 업데이트
    const updateHandlePosition = (handle: HTMLDivElement, row: HTMLTableRowElement) => {
      const rowRect = row.getBoundingClientRect()
      const editorRect = editorDom.getBoundingClientRect()
      handle.style.top = `${rowRect.bottom - editorRect.top - 2}px`
      handle.style.width = `${rowRect.width}px`
      handle.style.left = `${rowRect.left - editorRect.left}px`
    }

    // 테이블에 마우스 진입 시 핸들 표시
    const handleTableMouseMove = (e: MouseEvent) => {
      if (isResizing) return

      const target = e.target as HTMLElement
      const row = target.closest('tr') as HTMLTableRowElement
      const table = target.closest('table')

      if (!row || !table) {
        // 핸들 숨기기
        if (resizeHandle && resizeHandle.parentNode) {
          resizeHandle.style.backgroundColor = 'transparent'
        }
        return
      }

      const rowRect = row.getBoundingClientRect()
      const distanceFromBottom = rowRect.bottom - e.clientY

      // 행 하단 8px 영역에서 핸들 표시
      if (distanceFromBottom <= 8 && distanceFromBottom >= -2) {
        if (!resizeHandle) {
          resizeHandle = createResizeHandle(row)
          editorDom.style.position = 'relative'
          editorDom.appendChild(resizeHandle)
        }

        updateHandlePosition(resizeHandle, row)
        resizeHandle.style.backgroundColor = '#3b82f6' // 파란색
        resizeHandle.dataset.rowIndex = String(Array.from(row.parentNode?.children || []).indexOf(row))
        targetRow = row
      } else if (resizeHandle) {
        resizeHandle.style.backgroundColor = 'transparent'
      }
    }

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement

      // 리사이즈 핸들 클릭 확인
      if (target.classList.contains('row-resize-handle') ||
          (resizeHandle && resizeHandle.style.backgroundColor === 'rgb(59, 130, 246)')) {

        const row = target.closest('tr') as HTMLTableRowElement || targetRow
        if (!row && !targetRow) return

        e.preventDefault()
        e.stopPropagation()

        isResizing = true
        startY = e.clientY
        if (targetRow) {
          startHeight = targetRow.offsetHeight
        }

        activeHandle = resizeHandle
        if (activeHandle) {
          activeHandle.style.backgroundColor = '#2563eb' // 진한 파란색
        }

        document.body.style.cursor = 'row-resize'
        document.body.style.userSelect = 'none'
        return
      }

      // 셀 하단 테두리 근처 클릭 확인
      const cell = target.closest('td, th') as HTMLTableCellElement
      if (!cell) return

      const cellRect = cell.getBoundingClientRect()
      const distanceFromBottom = cellRect.bottom - e.clientY

      if (distanceFromBottom <= 8 && distanceFromBottom >= 0) {
        e.preventDefault()
        e.stopPropagation()
        isResizing = true
        startY = e.clientY
        targetRow = cell.closest('tr')
        if (targetRow) {
          startHeight = targetRow.offsetHeight
        }
        document.body.style.cursor = 'row-resize'
        document.body.style.userSelect = 'none'
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && targetRow) {
        e.preventDefault()
        const deltaY = e.clientY - startY
        const newHeight = Math.max(24, startHeight + deltaY)

        // 행 높이 설정
        targetRow.style.height = `${newHeight}px`

        // 모든 셀에 높이 적용
        const cells = targetRow.querySelectorAll('td, th')
        cells.forEach((cell) => {
          const cellEl = cell as HTMLElement
          cellEl.style.height = `${newHeight}px`
          cellEl.style.minHeight = `${newHeight}px`
        })

        // 핸들 위치 업데이트
        if (activeHandle && targetRow) {
          updateHandlePosition(activeHandle, targetRow)
        }
        return
      }

      // 호버 시 핸들 표시
      handleTableMouseMove(e)
    }

    const handleMouseUp = () => {
      if (isResizing) {
        isResizing = false
        targetRow = null
        document.body.style.cursor = ''
        document.body.style.userSelect = ''

        if (activeHandle) {
          activeHandle.style.backgroundColor = 'transparent'
          activeHandle = null
        }
      }
    }

    // 테이블 떠날 때 핸들 숨기기
    const handleMouseLeave = () => {
      if (!isResizing && resizeHandle) {
        resizeHandle.style.backgroundColor = 'transparent'
      }
    }

    // 이벤트 리스너 연결
    editorDom.addEventListener('mousemove', handleMouseMove)
    editorDom.addEventListener('mousedown', handleMouseDown, { capture: true })
    editorDom.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mousemove', handleMouseMove)

    return () => {
      editorDom.removeEventListener('mousemove', handleMouseMove)
      editorDom.removeEventListener('mousedown', handleMouseDown, { capture: true } as EventListenerOptions)
      editorDom.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mousemove', handleMouseMove)

      // 핸들 정리
      if (resizeHandle && resizeHandle.parentNode) {
        resizeHandle.parentNode.removeChild(resizeHandle)
      }
    }
  }, [editor, isMounted])

  if (!isMounted) {
    return (
      <div
        className={`border rounded-md bg-background ${className}`}
        style={{ minHeight }}
      >
        <div className="p-4 text-muted-foreground">{placeholder}</div>
      </div>
    )
  }

  return (
    <div className={`border rounded-md bg-background overflow-hidden ${className}`}>
      {editor && <EditorToolbar editor={editor} />}
      <div className="relative">
        <EditorContent
          editor={editor}
          className="prose-headings:my-2 prose-p:my-1 prose-ul:my-1 prose-ol:my-1"
        />
        {/* 표 편집 시 셀 메뉴 표시 (드래그 선택 시에만) */}
        {editor && editor.isActive('table') && (
          <TableCellMenu editor={editor} />
        )}
      </div>
    </div>
  )
}

// 에디터 인스턴스를 외부에서 사용할 수 있도록 export
export type { Editor }
