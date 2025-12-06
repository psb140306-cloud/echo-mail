'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Loader2, FileText, Save } from 'lucide-react'

interface Template {
  id: string
  name: string
  subject: string
  content: string
  category: string | null
  isDefault: boolean
}

interface TemplateSelectorProps {
  onSelect: (template: Template) => void
  currentSubject?: string
  currentContent?: string
  disabled?: boolean
}

export function TemplateSelector({
  onSelect,
  currentSubject,
  currentContent,
  disabled = false,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateCategory, setNewTemplateCategory] = useState('')
  const { toast } = useToast()

  // 템플릿 목록 로드
  const loadTemplates = useCallback(async () => {
    try {
      const response = await fetch('/api/mail/templates')
      if (response.ok) {
        const result = await response.json()
        setTemplates(result.data?.templates || [])
        setCategories(result.data?.categories || [])
      }
    } catch (error) {
      console.error('템플릿 목록 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const handleChange = (value: string) => {
    if (value === 'save') {
      setShowSaveDialog(true)
      return
    }

    const template = templates.find(t => t.id === value)
    if (template) {
      onSelect(template)
    }
  }

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast({
        title: '오류',
        description: '템플릿 이름을 입력해주세요.',
        variant: 'destructive',
      })
      return
    }

    if (!currentSubject?.trim() || !currentContent?.trim()) {
      toast({
        title: '오류',
        description: '제목과 본문이 있어야 템플릿으로 저장할 수 있습니다.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/mail/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTemplateName.trim(),
          subject: currentSubject,
          content: currentContent,
          category: newTemplateCategory.trim() || null,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: '저장 완료',
          description: '템플릿이 저장되었습니다.',
        })
        setShowSaveDialog(false)
        setNewTemplateName('')
        setNewTemplateCategory('')
        loadTemplates() // 목록 새로고침
      } else {
        toast({
          title: '저장 실패',
          description: result.message || '템플릿 저장에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('템플릿 저장 오류:', error)
      toast({
        title: '오류',
        description: '템플릿 저장 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // 카테고리별로 템플릿 그룹화
  const groupedTemplates = templates.reduce((acc, template) => {
    const category = template.category || '미분류'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(template)
    return acc
  }, {} as Record<string, Template[]>)

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>템플릿 로드 중...</span>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <Label htmlFor="template" className="flex items-center gap-2 text-sm whitespace-nowrap">
          <FileText className="h-4 w-4" />
          템플릿
        </Label>
        <Select onValueChange={handleChange} disabled={disabled}>
          <SelectTrigger id="template" className="w-[200px]">
            <SelectValue placeholder="템플릿 선택" />
          </SelectTrigger>
          <SelectContent>
            {/* 템플릿 저장 옵션 */}
            <SelectItem value="save">
              <div className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                현재 내용을 템플릿으로 저장
              </div>
            </SelectItem>

            {/* 템플릿 목록 */}
            {Object.keys(groupedTemplates).length > 0 ? (
              Object.entries(groupedTemplates).map(([category, temps]) => (
                <SelectGroup key={category}>
                  <SelectLabel>{category}</SelectLabel>
                  {temps.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                      {template.isDefault && ' (기본)'}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))
            ) : (
              <SelectItem value="empty" disabled>
                저장된 템플릿이 없습니다
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* 템플릿 저장 다이얼로그 */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>템플릿으로 저장</DialogTitle>
            <DialogDescription>
              현재 메일 내용을 템플릿으로 저장합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">템플릿 이름</Label>
              <Input
                id="template-name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="예: 발주 확인 메일"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-category">카테고리 (선택)</Label>
              <Input
                id="template-category"
                value={newTemplateCategory}
                onChange={(e) => setNewTemplateCategory(e.target.value)}
                placeholder="예: 발주, 견적, 안내"
                list="category-suggestions"
              />
              <datalist id="category-suggestions">
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
              disabled={saving}
            >
              취소
            </Button>
            <Button onClick={handleSaveTemplate} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  저장
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
