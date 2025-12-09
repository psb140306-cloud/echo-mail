'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface Company {
  id: string
  name: string
}

interface Contact {
  id: string
  name: string
  phone: string
  email: string | null
  position: string | null
  department: string | null
  memo: string | null
  isActive: boolean
  smsEnabled: boolean
  kakaoEnabled: boolean
  company: Company
}

interface ContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact: Contact | null
  companies: Company[]
  onSuccess: () => void
}

export function ContactDialog({
  open,
  onOpenChange,
  contact,
  companies,
  onSuccess,
}: ContactDialogProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // 폼 상태
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    position: '',
    companyId: '',
    isActive: true,
    smsEnabled: true,
    kakaoEnabled: false,
  })

  // contact 변경 시 폼 초기화
  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name,
        phone: contact.phone,
        email: contact.email || '',
        position: contact.position || '',
        companyId: contact.company?.id || '',
        isActive: contact.isActive,
        smsEnabled: contact.smsEnabled,
        kakaoEnabled: contact.kakaoEnabled,
      })
    } else {
      setFormData({
        name: '',
        phone: '',
        email: '',
        position: '',
        companyId: companies[0]?.id || '',
        isActive: true,
        smsEnabled: true,
        kakaoEnabled: false,
      })
    }
  }, [contact, companies, open])

  // 전화번호 포맷팅
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, '')
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setFormData((prev) => ({ ...prev, phone: formatted }))
  }

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 유효성 검사
    if (!formData.name.trim()) {
      toast({
        title: '오류',
        description: '이름을 입력해주세요.',
        variant: 'destructive',
      })
      return
    }

    if (!formData.phone.match(/^010-\d{4}-\d{4}$/)) {
      toast({
        title: '오류',
        description: '올바른 전화번호 형식이 아닙니다. (010-0000-0000)',
        variant: 'destructive',
      })
      return
    }

    if (!formData.companyId) {
      toast({
        title: '오류',
        description: '업체를 선택해주세요.',
        variant: 'destructive',
      })
      return
    }

    if (formData.email && !formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast({
        title: '오류',
        description: '올바른 이메일 형식이 아닙니다.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      const url = contact ? `/api/contacts/${contact.id}` : '/api/contacts'
      const method = contact ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          phone: formData.phone,
          email: formData.email.trim() || undefined,
          position: formData.position.trim() || undefined,
          companyId: formData.companyId,
          isActive: formData.isActive,
          smsEnabled: formData.smsEnabled,
          kakaoEnabled: formData.kakaoEnabled,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '성공',
          description: contact ? '연락처가 수정되었습니다.' : '연락처가 추가되었습니다.',
        })
        onSuccess()
      } else {
        toast({
          title: '오류',
          description: data.error || '저장에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{contact ? '연락처 수정' : '연락처 추가'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">이름 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="홍길동"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">전화번호 *</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={handlePhoneChange}
              placeholder="010-0000-0000"
              maxLength={13}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="example@company.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">업체 *</Label>
            <select
              id="company"
              value={formData.companyId}
              onChange={(e) => setFormData((prev) => ({ ...prev, companyId: e.target.value }))}
              className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
            >
              <option value="">업체 선택</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">직책</Label>
            <Input
              id="position"
              value={formData.position}
              onChange={(e) => setFormData((prev) => ({ ...prev, position: e.target.value }))}
              placeholder="대리"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">활성 상태</Label>
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isActive: checked }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="smsEnabled">SMS 수신</Label>
            <Switch
              id="smsEnabled"
              checked={formData.smsEnabled}
              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, smsEnabled: checked }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="kakaoEnabled">카카오톡 수신</Label>
            <Switch
              id="kakaoEnabled"
              checked={formData.kakaoEnabled}
              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, kakaoEnabled: checked }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {contact ? '수정' : '추가'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
