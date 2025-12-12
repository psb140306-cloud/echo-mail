'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import {
  Paperclip,
  X,
  File,
  FileText,
  FileImage,
  FileArchive,
  Upload,
  Loader2,
} from 'lucide-react'

export interface AttachmentFile {
  key: string
  name: string
  size: number
  type: string
  url?: string
}

interface AttachmentLimits {
  maxSize: number
  maxCount: number
}

interface AttachmentUploaderProps {
  attachments: AttachmentFile[]
  onAttachmentsChange: (attachments: AttachmentFile[]) => void
  onUploadingChange?: (uploading: boolean) => void  // 업로드 상태 콜백 (전송 버튼 제어용)
  maxFiles?: number  // deprecated: 백엔드 플랜 제한 사용
  maxSize?: number   // deprecated: 백엔드 플랜 제한 사용
  disabled?: boolean
}

// 파일 크기 포맷팅
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// 파일 타입에 따른 아이콘
function getFileIcon(type: string) {
  if (type.startsWith('image/')) return <FileImage className="h-4 w-4" />
  if (
    type.includes('zip') ||
    type.includes('rar') ||
    type.includes('7z') ||
    type.includes('tar')
  )
    return <FileArchive className="h-4 w-4" />
  if (
    type.includes('pdf') ||
    type.includes('word') ||
    type.includes('document') ||
    type.includes('text')
  )
    return <FileText className="h-4 w-4" />
  return <File className="h-4 w-4" />
}

export function AttachmentUploader({
  attachments,
  onAttachmentsChange,
  onUploadingChange,
  maxFiles: propMaxFiles,  // props로 받은 값은 fallback으로만 사용
  maxSize: propMaxSize,
  disabled = false,
}: AttachmentUploaderProps) {
  const [uploading, setUploadingState] = useState(false)

  // uploading 상태 변경 시 콜백 호출
  const setUploading = (value: boolean) => {
    setUploadingState(value)
    onUploadingChange?.(value)
  }
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const [limits, setLimits] = useState<AttachmentLimits>({
    maxSize: propMaxSize ?? 25 * 1024 * 1024,  // 초기값: props 또는 기본값
    maxCount: propMaxFiles ?? 10,
  })
  const [limitsLoaded, setLimitsLoaded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // 플랜별 첨부파일 제한 정보 로드
  useEffect(() => {
    const fetchLimits = async () => {
      try {
        const response = await fetch('/api/mail/attachments')
        if (response.ok) {
          const result = await response.json()
          if (result.data) {
            setLimits({
              maxSize: result.data.maxSize,
              maxCount: result.data.maxCount,
            })
          }
        }
      } catch (error) {
        // 실패 시 기본값 유지
        console.warn('첨부파일 제한 정보 로드 실패:', error)
      } finally {
        setLimitsLoaded(true)
      }
    }

    fetchLimits()
  }, [])

  // 편의를 위한 변수
  const maxFiles = limits.maxCount
  const maxSize = limits.maxSize

  // 파일 업로드 핸들러
  const uploadFile = useCallback(
    async (file: File) => {
      // 파일 개수 체크
      if (attachments.length >= maxFiles) {
        toast({
          title: '첨부 파일 제한',
          description: `최대 ${maxFiles}개까지 첨부할 수 있습니다.`,
          variant: 'destructive',
        })
        return null
      }

      // 파일 크기 체크
      if (file.size > maxSize) {
        toast({
          title: '파일 크기 초과',
          description: `파일 크기가 너무 큽니다. 최대 ${formatFileSize(maxSize)}까지 업로드 가능합니다.`,
          variant: 'destructive',
        })
        return null
      }

      // 중복 파일 체크
      if (attachments.some((a) => a.name === file.name && a.size === file.size)) {
        toast({
          title: '중복 파일',
          description: '이미 첨부된 파일입니다.',
          variant: 'destructive',
        })
        return null
      }

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('currentCount', attachments.length.toString())

        const response = await fetch('/api/mail/attachments', {
          method: 'POST',
          body: formData,
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.message || '파일 업로드에 실패했습니다.')
        }

        // 응답에 포함된 제한 정보로 업데이트
        if (result.data?.limits) {
          setLimits({
            maxSize: result.data.limits.maxSize,
            maxCount: result.data.limits.maxCount,
          })
        }

        return result.data as AttachmentFile
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '파일 업로드 실패'
        toast({
          title: '업로드 실패',
          description: errorMessage,
          variant: 'destructive',
        })
        return null
      }
    },
    [attachments, maxFiles, maxSize, toast]
  )

  // 여러 파일 업로드
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files)
      const remainingSlots = maxFiles - attachments.length

      if (fileArray.length > remainingSlots) {
        toast({
          title: '첨부 파일 제한',
          description: `${remainingSlots}개의 파일만 더 첨부할 수 있습니다.`,
          variant: 'destructive',
        })
        return
      }

      setUploading(true)
      setUploadProgress(0)

      const newAttachments: AttachmentFile[] = []
      const totalFiles = fileArray.length

      for (let i = 0; i < fileArray.length; i++) {
        const result = await uploadFile(fileArray[i])
        if (result) {
          newAttachments.push(result)
        }
        setUploadProgress(((i + 1) / totalFiles) * 100)
      }

      if (newAttachments.length > 0) {
        onAttachmentsChange([...attachments, ...newAttachments])
        toast({
          title: '업로드 완료',
          description: `${newAttachments.length}개 파일이 첨부되었습니다.`,
        })
      }

      setUploading(false)
      setUploadProgress(0)
    },
    [attachments, maxFiles, onAttachmentsChange, toast, uploadFile]
  )

  // 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files)
      e.target.value = '' // 같은 파일 다시 선택 가능하도록
    }
  }

  // 드래그 앤 드롭 핸들러
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (disabled || uploading) return

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  // 파일 삭제 핸들러
  const handleRemove = async (attachment: AttachmentFile) => {
    try {
      const response = await fetch(
        `/api/mail/attachments?key=${encodeURIComponent(attachment.key)}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || '파일 삭제에 실패했습니다.')
      }

      onAttachmentsChange(attachments.filter((a) => a.key !== attachment.key))
      toast({
        title: '삭제 완료',
        description: '파일이 삭제되었습니다.',
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '파일 삭제 실패'
      toast({
        title: '삭제 실패',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-3">
      {/* 드래그 앤 드롭 영역 */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-4 transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600'
        } ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || uploading}
        />

        <div className="flex flex-col items-center justify-center py-4 text-center">
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
              <p className="text-sm text-muted-foreground">파일 업로드 중...</p>
              <Progress value={uploadProgress} className="w-48 mt-2" />
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-gray-400 mb-2" />
              <p className="text-sm font-medium">
                파일을 드래그하거나 클릭하여 업로드
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                최대 {maxFiles}개, 파일당 {formatFileSize(maxSize)}까지
              </p>
            </>
          )}
        </div>
      </div>

      {/* 첨부파일 목록 */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Paperclip className="h-4 w-4" />
            <span>첨부파일 ({attachments.length}개)</span>
          </div>
          <div className="space-y-1">
            {attachments.map((attachment) => (
              <div
                key={attachment.key}
                className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {getFileIcon(attachment.type)}
                  <span className="text-sm truncate">{attachment.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({formatFileSize(attachment.size)})
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemove(attachment)
                  }}
                  disabled={disabled}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 단순 버튼 (대체 UI) */}
      {attachments.length === 0 && !dragActive && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
          >
            <Paperclip className="h-4 w-4 mr-2" />
            파일 첨부
          </Button>
        </div>
      )}
    </div>
  )
}
