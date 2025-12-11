'use client'

import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Link } from '@tiptap/extension-link'
import { Image } from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TextAlign } from '@tiptap/extension-text-align'
import { Underline } from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import { useCallback, useEffect, useState } from 'react'
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
  minHeight = '300px',
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
          class: 'border-collapse border border-gray-300',
        },
      }),
      TableRow,
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 p-2',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 p-2 bg-gray-100 font-bold',
        },
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
