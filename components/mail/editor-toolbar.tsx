'use client'

import { Editor } from '@tiptap/react'
import { useCallback, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Quote,
  Link as LinkIcon,
  Unlink,
  Image as ImageIcon,
  Table as TableIcon,
  Undo,
  Redo,
  Highlighter,
  Palette,
  ChevronDown,
  Plus,
  Minus,
  Trash2,
  RowsIcon,
  Columns,
  Merge,
  Split,
  ExternalLink,
  Upload,
} from 'lucide-react'

interface EditorToolbarProps {
  editor: Editor
}

// 색상 팔레트
const TEXT_COLORS = [
  { name: '기본', value: 'inherit' },
  { name: '검정', value: '#000000' },
  { name: '빨강', value: '#ef4444' },
  { name: '주황', value: '#f97316' },
  { name: '노랑', value: '#eab308' },
  { name: '초록', value: '#22c55e' },
  { name: '파랑', value: '#3b82f6' },
  { name: '남색', value: '#6366f1' },
  { name: '보라', value: '#a855f7' },
  { name: '분홍', value: '#ec4899' },
  { name: '회색', value: '#6b7280' },
]

const HIGHLIGHT_COLORS = [
  { name: '없음', value: '' },
  { name: '노랑', value: '#fef08a' },
  { name: '초록', value: '#bbf7d0' },
  { name: '파랑', value: '#bfdbfe' },
  { name: '분홍', value: '#fbcfe8' },
  { name: '보라', value: '#e9d5ff' },
  { name: '주황', value: '#fed7aa' },
]

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [imageDialogOpen, setImageDialogOpen] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const imageFileInputRef = useRef<HTMLInputElement>(null)

  // 이미지 파일 선택 처리 (로컬 파일을 Base64로 변환)
  const handleImageFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      // 이미지 파일만 허용
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드할 수 있습니다.')
        return
      }

      // 파일 크기 제한 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('이미지 크기는 5MB 이하여야 합니다.')
        return
      }

      setIsUploadingImage(true)

      try {
        // 파일을 Base64로 변환
        const reader = new FileReader()
        reader.onload = () => {
          const base64 = reader.result as string
          editor.chain().focus().setImage({ src: base64 }).run()
          setImageDialogOpen(false)
          setIsUploadingImage(false)
        }
        reader.onerror = () => {
          alert('이미지를 읽는 중 오류가 발생했습니다.')
          setIsUploadingImage(false)
        }
        reader.readAsDataURL(file)
      } catch (error) {
        alert('이미지 처리 중 오류가 발생했습니다.')
        setIsUploadingImage(false)
      }

      // input 초기화
      if (imageFileInputRef.current) {
        imageFileInputRef.current.value = ''
      }
    },
    [editor]
  )

  // 링크 설정
  const setLink = useCallback(() => {
    if (!linkUrl) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    // URL 형식 체크 및 보정
    let url = linkUrl
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url
    }

    // 링크 텍스트가 있으면 해당 텍스트로 링크 생성
    if (linkText) {
      editor
        .chain()
        .focus()
        .insertContent(`<a href="${url}">${linkText}</a>`)
        .run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }

    setLinkUrl('')
    setLinkText('')
    setLinkDialogOpen(false)
  }, [editor, linkUrl, linkText])

  // 이미지 삽입
  const insertImage = useCallback(() => {
    if (!imageUrl) return

    let url = imageUrl
    if (!/^https?:\/\//i.test(url) && !url.startsWith('data:')) {
      url = 'https://' + url
    }

    editor.chain().focus().setImage({ src: url }).run()
    setImageUrl('')
    setImageDialogOpen(false)
  }, [editor, imageUrl])

  // 표 삽입
  const insertTable = useCallback(() => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])

  // 툴바 버튼 컴포넌트
  const ToolbarButton = ({
    onClick,
    isActive = false,
    disabled = false,
    tooltip,
    children,
  }: {
    onClick: () => void
    isActive?: boolean
    disabled?: boolean
    tooltip: string
    children: React.ReactNode
  }) => (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClick}
            disabled={disabled}
            className={`h-8 w-8 p-0 ${isActive ? 'bg-muted' : ''}`}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-2 border-b bg-muted/30">
      {/* 실행 취소 / 다시 실행 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        tooltip="실행 취소"
      >
        <Undo className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        tooltip="다시 실행"
      >
        <Redo className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* 제목 드롭다운 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2 gap-1">
            <span className="text-sm">
              {editor.isActive('heading', { level: 1 })
                ? '제목 1'
                : editor.isActive('heading', { level: 2 })
                  ? '제목 2'
                  : editor.isActive('heading', { level: 3 })
                    ? '제목 3'
                    : '본문'}
            </span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()}>
            <span className="text-sm">본문</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            <Heading1 className="h-4 w-4 mr-2" />
            <span className="text-xl font-bold">제목 1</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 className="h-4 w-4 mr-2" />
            <span className="text-lg font-bold">제목 2</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <Heading3 className="h-4 w-4 mr-2" />
            <span className="text-base font-bold">제목 3</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* 서식 버튼들 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        tooltip="굵게 (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        tooltip="기울임 (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        tooltip="밑줄 (Ctrl+U)"
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        tooltip="취소선"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        tooltip="인라인 코드"
      >
        <Code className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* 글자 색상 */}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <DropdownMenu>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Palette className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>글자 색상</TooltipContent>
        <DropdownMenuContent align="start" className="w-36">
          <div className="p-2">
            <p className="text-xs font-medium mb-2">글자 색상</p>
            <div className="grid grid-cols-5 gap-1">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => {
                    if (color.value === 'inherit') {
                      editor.chain().focus().unsetColor().run()
                    } else {
                      editor.chain().focus().setColor(color.value).run()
                    }
                  }}
                  className="w-6 h-6 rounded border border-gray-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color.value === 'inherit' ? '#fff' : color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        </DropdownMenuContent>
          </DropdownMenu>
        </Tooltip>
      </TooltipProvider>

      {/* 형광펜 */}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <DropdownMenu>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Highlighter className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>형광펜</TooltipContent>
        <DropdownMenuContent align="start" className="w-36">
          <div className="p-2">
            <p className="text-xs font-medium mb-2">형광펜</p>
            <div className="grid grid-cols-4 gap-1">
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color.value || 'none'}
                  type="button"
                  onClick={() => {
                    if (!color.value) {
                      editor.chain().focus().unsetHighlight().run()
                    } else {
                      editor.chain().focus().toggleHighlight({ color: color.value }).run()
                    }
                  }}
                  className="w-6 h-6 rounded border border-gray-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color.value || '#fff' }}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        </DropdownMenuContent>
          </DropdownMenu>
        </Tooltip>
      </TooltipProvider>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* 정렬 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
        tooltip="왼쪽 정렬"
      >
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
        tooltip="가운데 정렬"
      >
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
        tooltip="오른쪽 정렬"
      >
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        isActive={editor.isActive({ textAlign: 'justify' })}
        tooltip="양쪽 정렬"
      >
        <AlignJustify className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* 목록 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        tooltip="글머리 기호"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        tooltip="번호 목록"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        tooltip="인용구"
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* 링크 */}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-8 w-8 p-0 ${editor.isActive('link') ? 'bg-muted' : ''}`}
                >
                  <LinkIcon className="h-4 w-4" />
                </Button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>링크 삽입</TooltipContent>
        <DialogContent className="sm:max-w-md p-0">
          <div className="p-4 space-y-4">
            {/* 링크 제목 */}
            <div className="flex items-center gap-4">
              <Label htmlFor="link-text" className="w-20 text-sm text-muted-foreground whitespace-nowrap">
                링크 제목
              </Label>
              <Input
                id="link-text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                className="flex-1 h-9"
              />
            </div>

            {/* 이동할 URL */}
            <div className="flex items-center gap-4">
              <Label htmlFor="link-url" className="w-20 text-sm text-muted-foreground whitespace-nowrap">
                이동할 URL
              </Label>
              <Input
                id="link-url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="URL을 입력하세요."
                className="flex-1 h-9"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    setLink()
                  }
                }}
              />
            </div>

            {/* 하단 버튼 영역 */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => {
                  if (linkUrl) {
                    let url = linkUrl
                    if (!/^https?:\/\//i.test(url)) {
                      url = 'https://' + url
                    }
                    window.open(url, '_blank')
                  }
                }}
                disabled={!linkUrl}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                URL로 이동
              </Button>
              <Button size="sm" onClick={setLink}>
                확인
              </Button>
            </div>
          </div>
        </DialogContent>
          </Dialog>
        </Tooltip>
      </TooltipProvider>

      {editor.isActive('link') && (
        <ToolbarButton
          onClick={() => editor.chain().focus().unsetLink().run()}
          tooltip="링크 제거"
        >
          <Unlink className="h-4 w-4" />
        </ToolbarButton>
      )}

      {/* 이미지 */}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <ImageIcon className="h-4 w-4" />
                </Button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>이미지 삽입</TooltipContent>
        <DialogContent className="sm:max-w-md p-0">
          <div className="p-4 space-y-4">
            {/* 숨겨진 파일 input */}
            <input
              ref={imageFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageFileSelect}
              className="hidden"
            />

            {/* 파일 업로드 영역 */}
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
              onClick={() => imageFileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isUploadingImage ? '업로드 중...' : '클릭하여 이미지 파일 선택'}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                PNG, JPG, GIF (최대 5MB)
              </p>
            </div>

            {/* 구분선 */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-2 text-muted-foreground">또는</span>
              </div>
            </div>

            {/* URL 입력 */}
            <div className="flex items-center gap-4">
              <Label htmlFor="image-url" className="w-16 text-sm text-muted-foreground whitespace-nowrap">
                이미지 URL
              </Label>
              <Input
                id="image-url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="flex-1 h-9"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    insertImage()
                  }
                }}
              />
            </div>

            {/* 하단 버튼 영역 */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setImageDialogOpen(false)}>
                취소
              </Button>
              <Button size="sm" onClick={insertImage} disabled={!imageUrl}>
                삽입
              </Button>
            </div>
          </div>
        </DialogContent>
          </Dialog>
        </Tooltip>
      </TooltipProvider>

      {/* 표 */}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <DropdownMenu>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <TableIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>표 삽입</TooltipContent>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={insertTable}>
            <Plus className="h-4 w-4 mr-2" />
            표 삽입 (3x3)
          </DropdownMenuItem>
          {editor.isActive('table') && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => editor.chain().focus().addColumnBefore().run()}>
                <Columns className="h-4 w-4 mr-2" />
                왼쪽에 열 추가
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().addColumnAfter().run()}>
                <Columns className="h-4 w-4 mr-2" />
                오른쪽에 열 추가
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().deleteColumn().run()}>
                <Minus className="h-4 w-4 mr-2" />
                열 삭제
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => editor.chain().focus().addRowBefore().run()}>
                <RowsIcon className="h-4 w-4 mr-2" />
                위에 행 추가
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().addRowAfter().run()}>
                <RowsIcon className="h-4 w-4 mr-2" />
                아래에 행 추가
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().deleteRow().run()}>
                <Minus className="h-4 w-4 mr-2" />
                행 삭제
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => editor.chain().focus().mergeCells().run()}>
                <Merge className="h-4 w-4 mr-2" />
                셀 병합
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().splitCell().run()}>
                <Split className="h-4 w-4 mr-2" />
                셀 분할
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => editor.chain().focus().deleteTable().run()}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                표 삭제
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
          </DropdownMenu>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
