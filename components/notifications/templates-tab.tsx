'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Edit, Trash2, Loader2, MessageSquare, Bell } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface MessageTemplate {
  id: string
  name: string
  type: string
  subject?: string
  content: string
  variables: Record<string, string>
  isActive: boolean
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export function TemplatesTab() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null)
  const [editForm, setEditForm] = useState({
    subject: '',
    content: '',
    isActive: true,
  })
  const { toast } = useToast()

  // 템플릿 목록 조회
  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/notifications/templates')
      const data = await response.json()

      if (data.success) {
        setTemplates(data.data)
      } else {
        toast({
          title: '오류',
          description: data.error || '템플릿을 불러오는데 실패했습니다.',
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

  // 템플릿 수정
  const updateTemplate = async () => {
    if (!selectedTemplate) return

    try {
      const response = await fetch('/api/notifications/templates', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedTemplate.id,
          ...editForm,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '성공',
          description: '템플릿이 수정되었습니다.',
        })
        setShowEditDialog(false)
        fetchTemplates()
      } else {
        toast({
          title: '오류',
          description: data.error || '템플릿 수정에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      })
    }
  }

  // 템플릿 삭제
  const deleteTemplate = async () => {
    if (!selectedTemplate) return

    try {
      const response = await fetch(`/api/notifications/templates?id=${selectedTemplate.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '성공',
          description: '템플릿이 삭제되었습니다.',
        })
        setShowDeleteDialog(false)
        fetchTemplates()
      } else {
        toast({
          title: '오류',
          description: data.error || '템플릿 삭제에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      })
    }
  }

  // 수정 대화상자 열기
  const openEditDialog = (template: MessageTemplate) => {
    setSelectedTemplate(template)
    setEditForm({
      subject: template.subject || '',
      content: template.content,
      isActive: template.isActive,
    })
    setShowEditDialog(true)
  }

  // 삭제 대화상자 열기
  const openDeleteDialog = (template: MessageTemplate) => {
    setSelectedTemplate(template)
    setShowDeleteDialog(true)
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'SMS':
        return <MessageSquare className="h-4 w-4" />
      case 'KAKAO_ALIMTALK':
      case 'KAKAO_FRIENDTALK':
        return <Bell className="h-4 w-4" />
      default:
        return null
    }
  }

  const getTypeName = (type: string) => {
    switch (type) {
      case 'SMS':
        return 'SMS'
      case 'KAKAO_ALIMTALK':
        return '카카오 알림톡'
      case 'KAKAO_FRIENDTALK':
        return '카카오 친구톡'
      default:
        return type
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>메시지 템플릿</CardTitle>
              <CardDescription>SMS/카카오톡 발송에 사용되는 템플릿을 관리하세요</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">템플릿이 없습니다.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>타입</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>내용 미리보기</TableHead>
                  <TableHead>변수</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(template.type)}
                        <span className="text-sm font-medium">{getTypeName(template.type)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{template.name}</div>
                        {template.isDefault && (
                          <Badge variant="secondary" className="mt-1 text-xs">
                            기본
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-md">
                        <div className="text-sm line-clamp-2">{template.content}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {Object.keys(template.variables).map((key) => (
                          <Badge key={key} variant="outline" className="text-xs">
                            {key}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={template.isActive ? 'default' : 'secondary'}>
                        {template.isActive ? '활성' : '비활성'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(template)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {!template.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(template)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 템플릿 수정 대화상자 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>템플릿 수정</DialogTitle>
            <DialogDescription>{selectedTemplate?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {selectedTemplate?.type !== 'SMS' && (
              <div className="grid gap-2">
                <Label htmlFor="subject">제목</Label>
                <Input
                  id="subject"
                  value={editForm.subject}
                  onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="content">내용</Label>
              <Textarea
                id="content"
                value={editForm.content}
                onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                rows={8}
              />
              <p className="text-sm text-muted-foreground">
                변수 형식: {'{{변수명}}'} (예: {'{{companyName}}'})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={editForm.isActive}
                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                활성화
              </Label>
            </div>
            {selectedTemplate && (
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm font-medium mb-2">사용 가능한 변수:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(selectedTemplate.variables).map(([key, value]) => (
                    <Badge key={key} variant="secondary">
                      {'{{' + key + '}}'} = {value}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              취소
            </Button>
            <Button onClick={updateTemplate}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 템플릿 삭제 확인 대화상자 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>템플릿 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 '{selectedTemplate?.name}' 템플릿을 삭제하시겠습니까? 이 작업은 되돌릴 수
              없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={deleteTemplate} className="bg-red-600 hover:bg-red-700">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
