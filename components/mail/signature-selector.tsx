'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Loader2, FileSignature } from 'lucide-react'

interface Signature {
  id: string
  name: string
  content: string
  isDefault: boolean
}

interface SignatureSelectorProps {
  onSelect: (signature: Signature | null) => void
  disabled?: boolean
}

export function SignatureSelector({ onSelect, disabled = false }: SignatureSelectorProps) {
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string>('')

  // 서명 목록 로드
  const loadSignatures = useCallback(async () => {
    try {
      const response = await fetch('/api/mail/signatures')
      if (response.ok) {
        const result = await response.json()
        const sigs = result.data?.signatures || []
        setSignatures(sigs)

        // 기본 서명이 있으면 자동 선택
        const defaultSig = sigs.find((s: Signature) => s.isDefault)
        if (defaultSig) {
          setSelectedId(defaultSig.id)
          onSelect(defaultSig)
        }
      }
    } catch (error) {
      console.error('서명 목록 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [onSelect])

  useEffect(() => {
    loadSignatures()
  }, [loadSignatures])

  const handleChange = (value: string) => {
    setSelectedId(value)
    if (value === 'none') {
      onSelect(null)
    } else {
      const signature = signatures.find(s => s.id === value)
      onSelect(signature || null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>서명 로드 중...</span>
      </div>
    )
  }

  if (signatures.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-3">
      <Label htmlFor="signature" className="flex items-center gap-2 text-sm whitespace-nowrap">
        <FileSignature className="h-4 w-4" />
        서명
      </Label>
      <Select value={selectedId} onValueChange={handleChange} disabled={disabled}>
        <SelectTrigger id="signature" className="w-[200px]">
          <SelectValue placeholder="서명 선택" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">서명 없음</SelectItem>
          {signatures.map((signature) => (
            <SelectItem key={signature.id} value={signature.id}>
              {signature.name}
              {signature.isDefault && ' (기본)'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
