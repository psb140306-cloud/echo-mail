'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Users,
  Mail,
  Phone,
  Loader2,
  BookUser,
  Building2,
  Upload,
  Download,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { AppHeader } from '@/components/layout/app-header'
import { ContactDialog } from '@/components/address-book/contact-dialog'
import { AddressBookImportDialog } from '@/components/mail/address-book-import-dialog'

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
  createdAt: string
}

interface Stats {
  totalContacts: number
  contactsWithEmail: number
  contactsWithPhone: number
}

export default function AddressBookPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [deletingContact, setDeletingContact] = useState<string | null>(null)
  const { toast } = useToast()

  // 통계 상태
  const [stats, setStats] = useState<Stats>({
    totalContacts: 0,
    contactsWithEmail: 0,
    contactsWithPhone: 0,
  })

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // 다이얼로그 상태
  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)

  // 연락처 목록 조회
  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      })

      if (searchTerm) params.append('search', searchTerm)
      if (selectedCompanyId) params.append('companyId', selectedCompanyId)

      const response = await fetch(`/api/contacts?${params}`)
      const data = await response.json()

      if (data.success) {
        setContacts(data.data)
        setTotalPages(data.pagination.pages)
        setTotalCount(data.pagination.total)
      } else {
        toast({
          title: '오류',
          description: data.error || '연락처 목록을 불러오는데 실패했습니다.',
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
  }, [currentPage, searchTerm, selectedCompanyId, itemsPerPage, toast])

  // 업체 목록 조회
  const fetchCompanies = useCallback(async () => {
    try {
      const response = await fetch('/api/companies?limit=1000')
      const data = await response.json()

      if (data.success) {
        setCompanies(data.data.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
      }
    } catch (error) {
      console.error('업체 목록 조회 실패:', error)
    }
  }, [])

  // 통계 조회
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/address-book/stats')
      const data = await response.json()

      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('통계 조회 실패:', error)
    }
  }, [])

  // 연락처 삭제
  const deleteContact = async (contactId: string) => {
    try {
      setDeletingContact(contactId)

      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '성공',
          description: data.message,
        })
        fetchContacts()
      } else {
        toast({
          title: '오류',
          description: data.error || '연락처 삭제에 실패했습니다.',
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
      setDeletingContact(null)
    }
  }

  // 검색 및 필터 적용 - 페이지를 1로 리셋 (debounce 적용)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm, selectedCompanyId, currentPage])

  // 페이지 변경 시 조회 (fetchContacts가 searchTerm, selectedCompanyId를 이미 의존하므로 중복 방지)
  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  // 초기 데이터 로드 (fetchContacts는 [fetchContacts] useEffect에서 자동 호출)
  useEffect(() => {
    fetchCompanies()
    fetchStats()
  }, [])

  // itemsPerPage 변경 시 첫 페이지로
  useEffect(() => {
    setCurrentPage(1)
  }, [itemsPerPage])

  // 새 연락처 추가 핸들러
  const handleAddContact = () => {
    setEditingContact(null)
    setContactDialogOpen(true)
  }

  // 연락처 수정 핸들러
  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact)
    setContactDialogOpen(true)
  }

  // 다이얼로그 성공 핸들러
  const handleDialogSuccess = () => {
    setContactDialogOpen(false)
    setEditingContact(null)
    fetchContacts()
    fetchStats()
  }

  // 주소록 내보내기
  const handleExport = () => {
    window.open('/api/mail/address-book/export', '_blank')
  }

  // 가져오기 성공 핸들러
  const handleImportSuccess = () => {
    setImportDialogOpen(false)
    fetchContacts()
    fetchCompanies()
    fetchStats()
  }

  return (
    <>
      <AppHeader />
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <BookUser className="h-8 w-8" />
            <h1 className="text-3xl font-bold">주소록 관리</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              가져오기
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              내보내기
            </Button>
            <Button onClick={handleAddContact}>
              <Plus className="mr-2 h-4 w-4" />
              연락처 추가
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">전체 연락처</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalContacts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">이메일 등록</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.contactsWithEmail}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalContacts > 0
                  ? `${Math.round((stats.contactsWithEmail / stats.totalContacts) * 100)}%`
                  : '0%'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">전화번호 등록</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.contactsWithPhone}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalContacts > 0
                  ? `${Math.round((stats.contactsWithPhone / stats.totalContacts) * 100)}%`
                  : '0%'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>연락처 검색</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="이름, 이메일, 전화번호로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm min-w-[200px]"
              >
                <option value="">모든 업체</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Contacts Table */}
        <Card>
          <CardHeader>
            <CardTitle>연락처 목록</CardTitle>
            <CardDescription>등록된 연락처를 관리하세요</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                등록된 연락처가 없습니다.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>이메일</TableHead>
                      <TableHead>전화번호</TableHead>
                      <TableHead>업체</TableHead>
                      <TableHead>직책</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell className="font-medium">{contact.name}</TableCell>
                        <TableCell>
                          {contact.email ? (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {contact.email}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {contact.phone}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            {contact.company?.name || '-'}
                          </div>
                        </TableCell>
                        <TableCell>{contact.position || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={contact.isActive ? 'default' : 'secondary'}>
                            {contact.isActive ? '활성' : '비활성'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>작업</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleEditContact(contact)}>
                                <Edit className="mr-2 h-4 w-4" />
                                수정
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onSelect={(e) => e.preventDefault()}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    삭제
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>연락처 삭제</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      &apos;{contact.name}&apos; 연락처를 삭제하시겠습니까?
                                      <br />이 작업은 되돌릴 수 없습니다.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>취소</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteContact(contact.id)}
                                      disabled={deletingContact === contact.id}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      {deletingContact === contact.id ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="mr-2 h-4 w-4" />
                                      )}
                                      삭제
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between px-2 py-4">
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  {totalCount}개 중 {totalCount > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-
                  {Math.min(currentPage * itemsPerPage, totalCount)}개 표시
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">페이지당</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="px-2 py-1 border border-input bg-background rounded-md text-sm"
                  >
                    <option value={20}>20개</option>
                    <option value={50}>50개</option>
                    <option value={100}>100개</option>
                  </select>
                </div>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    이전
                  </Button>
                  <span className="text-sm">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    다음
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 연락처 추가/수정 다이얼로그 */}
      <ContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        contact={editingContact}
        companies={companies}
        onSuccess={handleDialogSuccess}
      />

      {/* 주소록 가져오기 다이얼로그 */}
      <AddressBookImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={handleImportSuccess}
      />
    </>
  )
}
