'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Edit,
  Trash2,
  Mail,
  Phone,
  User,
  Briefcase,
  MessageSquare,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface Company {
  id: string
  name: string
  email: string
  region: string
  isActive: boolean
  contacts: Contact[]
  createdAt: string
  updatedAt: string
}

interface Contact {
  id: string
  name: string
  phone: string
  email?: string
  position?: string
  isActive: boolean
  smsEnabled: boolean
  kakaoEnabled: boolean
}

export default function CompanyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const companyId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [company, setCompany] = useState<Company | null>(null)

  // 업체 정보 폼
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    region: '',
    isActive: true,
  })

  // 업체 정보 조회
  useEffect(() => {
    fetchCompany()
  }, [companyId])

  const fetchCompany = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/companies/${companyId}`)
      const data = await response.json()

      if (data.success) {
        setCompany(data.data)
        setFormData({
          name: data.data.name,
          email: data.data.email,
          region: data.data.region,
          isActive: data.data.isActive,
        })
      } else {
        toast({
          title: '오류',
          description: data.error || '업체 정보를 불러오는데 실패했습니다.',
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

  // 업체 정보 저장
  const handleSave = async () => {
    try {
      setSaving(true)

      const response = await fetch(`/api/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '성공',
          description: '업체 정보가 저장되었습니다.',
        })
        fetchCompany()
      } else {
        toast({
          title: '오류',
          description: data.error || '업체 정보 저장에 실패했습니다.',
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
      setSaving(false)
    }
  }

  // 담당자 삭제
  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('이 담당자를 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '성공',
          description: '담당자가 삭제되었습니다.',
        })
        fetchCompany()
      } else {
        toast({
          title: '오류',
          description: data.error || '담당자 삭제에 실패했습니다.',
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

  const regions = [
    '서울',
    '부산',
    '대구',
    '인천',
    '광주',
    '대전',
    '울산',
    '세종',
    '경기',
    '강원',
    '충북',
    '충남',
    '전북',
    '전남',
    '경북',
    '경남',
    '제주',
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/40 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-gray-50/40 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-muted-foreground mb-4">업체를 찾을 수 없습니다.</p>
          <Button asChild>
            <Link href="/companies">
              <ArrowLeft className="mr-2 h-4 w-4" />
              목록으로 돌아가기
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/40">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <Link href="/companies" className="mr-6 flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">업체 목록</span>
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2">
            <h1 className="text-lg font-semibold">{company.name}</h1>
            <Button onClick={handleSave} disabled={saving}>
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        <Tabs defaultValue="info" className="space-y-4">
          <TabsList>
            <TabsTrigger value="info">업체 정보</TabsTrigger>
            <TabsTrigger value="contacts">
              담당자 ({company.contacts.length})
            </TabsTrigger>
          </TabsList>

          {/* 업체 정보 탭 */}
          <TabsContent value="info" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>기본 정보</CardTitle>
                <CardDescription>업체의 기본 정보를 수정합니다</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">업체명 *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="업체명을 입력하세요"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">이메일 *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="company@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="region">지역 *</Label>
                    <select
                      id="region"
                      value={formData.region}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">지역 선택</option>
                      {regions.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="isActive">상태</Label>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isActive"
                        checked={formData.isActive}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, isActive: checked })
                        }
                      />
                      <Label htmlFor="isActive" className="cursor-pointer">
                        {formData.isActive ? '활성' : '비활성'}
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">등록일</p>
                    <p className="font-medium">
                      {new Date(company.createdAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">최종 수정일</p>
                    <p className="font-medium">
                      {new Date(company.updatedAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 담당자 탭 */}
          <TabsContent value="contacts" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>담당자 목록</CardTitle>
                    <CardDescription>이 업체의 담당자 정보를 관리합니다</CardDescription>
                  </div>
                  <Button asChild>
                    <Link href={`/contacts/new?companyId=${companyId}`}>
                      <Plus className="mr-2 h-4 w-4" />
                      담당자 추가
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {company.contacts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    등록된 담당자가 없습니다.
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>이름</TableHead>
                          <TableHead>연락처</TableHead>
                          <TableHead>이메일</TableHead>
                          <TableHead>직책</TableHead>
                          <TableHead>알림</TableHead>
                          <TableHead>상태</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {company.contacts.map((contact) => (
                          <TableRow key={contact.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                {contact.name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                {contact.phone}
                              </div>
                            </TableCell>
                            <TableCell>
                              {contact.email ? (
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4 text-muted-foreground" />
                                  {contact.email}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {contact.position ? (
                                <div className="flex items-center gap-2">
                                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                                  {contact.position}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {contact.smsEnabled && (
                                  <Badge variant="outline" className="text-xs">
                                    SMS
                                  </Badge>
                                )}
                                {contact.kakaoEnabled && (
                                  <Badge variant="outline" className="text-xs">
                                    카카오
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={contact.isActive ? 'default' : 'secondary'}>
                                {contact.isActive ? '활성' : '비활성'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  asChild
                                >
                                  <Link href={`/contacts/${contact.id}`}>
                                    <Edit className="h-4 w-4" />
                                  </Link>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteContact(contact.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
