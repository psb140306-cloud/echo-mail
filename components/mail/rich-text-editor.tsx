'use client'

import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Link } from '@tiptap/extension-link'
import { Image } from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { CustomTableRow } from '@/lib/tiptap/custom-table-row'
import { CustomTableCell } from '@/lib/tiptap/custom-table-cell'
import { CustomTableHeader } from '@/lib/tiptap/custom-table-header'
import { SplitCellExtension } from '@/lib/tiptap/split-cell-extension'
import { RowResizeExtension } from '@/lib/tiptap/row-resize-extension'
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
        // StarterKit 내장 Link/Underline 비활성화 (중복 extension 경고 방지)
        link: false,
        underline: false,
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
      CustomTableRow,
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
      RowResizeExtension.configure({
        handleHeight: 8,
        cellMinHeight: 24,
      }),
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
