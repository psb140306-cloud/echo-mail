'use client'

import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, X } from 'lucide-react'

interface ImportResult {
  totalRows: number
  created: number
  updated: number
  duplicates: string[]
  errors: string[]
}

interface AddressBookImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function AddressBookImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddressBookImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'merge' | 'skip'>('merge')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
      setError(null)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      const filename = droppedFile.name.toLowerCase()
      if (filename.endsWith('.xlsx') || filename.endsWith('.xls') || filename.endsWith('.csv')) {
        setFile(droppedFile)
        setResult(null)
        setError(null)
      } else {
        setError('지원하지 않는 파일 형식입니다. (xlsx, xls, csv만 지원)')
      }
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleImport = async () => {
    if (!file) return

    setImporting(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mode', mode)

      const response = await fetch('/api/mail/address-book/import', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.ok && data.data) {
        setResult(data.data)
        if (onSuccess) onSuccess()
      } else {
        setError(data.error || '가져오기에 실패했습니다.')
      }
    } catch (err) {
      setError('파일을 업로드하는 중 오류가 발생했습니다.')
    } finally {
      setImporting(false)
    }
  }

  const handleDownloadTemplate = () => {
    window.open('/api/mail/address-book/template', '_blank')
  }

  const handleClose = () => {
    setFile(null)
    setResult(null)
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            주소록 가져오기
          </DialogTitle>
          <DialogDescription>
            엑셀 또는 CSV 파일에서 주소록을 가져옵니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 템플릿 다운로드 */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              <span className="text-sm">템플릿 파일 다운로드</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-1" />
              다운로드
            </Button>
          </div>

          {/* 파일 업로드 영역 */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              file ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-muted-foreground/25 hover:border-primary'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileSpreadsheet className="h-8 w-8 text-green-600" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFile(null)
                    setResult(null)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  클릭하거나 파일을 여기에 드래그하세요
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  xlsx, xls, csv 파일 지원 (최대 5MB)
                </p>
              </>
            )}
          </div>

          {/* 중복 처리 옵션 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">중복 이메일 처리</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="merge"
                  checked={mode === 'merge'}
                  onChange={() => setMode('merge')}
                  className="w-4 h-4"
                />
                <span className="text-sm">업데이트 (기존 정보 덮어쓰기)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="skip"
                  checked={mode === 'skip'}
                  onChange={() => setMode('skip')}
                  className="w-4 h-4"
                />
                <span className="text-sm">건너뛰기</span>
              </label>
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* 결과 표시 */}
          {result && (
            <div className="space-y-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">가져오기 완료</span>
              </div>
              <div className="text-sm space-y-1 text-muted-foreground">
                <p>전체 {result.totalRows}행 처리됨</p>
                <p>신규 추가: {result.created}건</p>
                <p>업데이트: {result.updated}건</p>
                {result.duplicates.length > 0 && (
                  <p>중복 건너뜀: {result.duplicates.length}건</p>
                )}
                {result.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-destructive">오류: {result.errors.length}건</p>
                    <ul className="text-xs text-destructive mt-1 max-h-20 overflow-y-auto">
                      {result.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {result.errors.length > 5 && (
                        <li>...외 {result.errors.length - 5}건</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              닫기
            </Button>
            <Button
              onClick={handleImport}
              disabled={!file || importing}
            >
              {importing ? '가져오는 중...' : '가져오기'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
