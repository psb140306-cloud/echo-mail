'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
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
  MapPin,
  Loader2,
  Building2,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { AppHeader } from '@/components/layout/app-header'

interface Company {
  id: string
  name: string
  email: string
  region: string
  isActive: boolean
  contacts: Contact[]
  _count: {
    contacts: number
  }
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

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('')
  const [deletingCompany, setDeletingCompany] = useState<string | null>(null)
  const [regions, setRegions] = useState<string[]>([])
  const { toast } = useToast()

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const itemsPerPage = 10

  // 업체 목록 조회
  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      })

      if (searchTerm) params.append('search', searchTerm)
      if (selectedRegion) params.append('region', selectedRegion)

      const response = await fetch(`/api/companies?${params}`)
      const data = await response.json()

      if (data.success) {
        setCompanies(data.data)
        setTotalPages(data.pagination.pages)
        setTotalCount(data.pagination.total)
      } else {
        toast({
          title: '오류',
          description: data.error || '업체 목록을 불러오는데 실패했습니다.',
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
  }, [currentPage, searchTerm, selectedRegion, itemsPerPage, toast])

  // 업체 삭제
  const deleteCompany = async (companyId: string) => {
    try {
      setDeletingCompany(companyId)

      const response = await fetch(`/api/companies/${companyId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '성공',
          description: data.message,
        })

        // 목록 새로고침
        fetchCompanies()
      } else {
        toast({
          title: '오류',
          description: data.error || '업체 삭제에 실패했습니다.',
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
      setDeletingCompany(null)
    }
  }

  // 검색 및 필터 적용
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1) // 검색 시 첫 페이지로
      fetchCompanies()
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm, selectedRegion, fetchCompanies])

  // 페이지 변경
  useEffect(() => {
    fetchCompanies()
  }, [currentPage, fetchCompanies])

  // 초기 데이터 로드
  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  // 지역 목록 조회
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const response = await fetch('/api/regions')
        const data = await response.json()
        if (data.success) {
          setRegions(data.data.allRegions)
        }
      } catch (error) {
        console.error('Failed to fetch regions:', error)
        // 기본 지역 사용
        setRegions([
          '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
          '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'
        ])
      }
    }
    fetchRegions()
  }, [])

  return (
    <>
      <AppHeader />
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            <h1 className="text-3xl font-bold">업체 관리</h1>
          </div>
          <Button asChild>
            <Link href="/companies/new">
              <Plus className="mr-2 h-4 w-4" />새 업체 추가
            </Link>
          </Button>
        </div>
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">전체 업체</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">활성 업체</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{companies.filter((c) => c.isActive).length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 담당자</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {companies.reduce((sum, c) => sum + c._count.contacts, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>업체 검색</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="업체명 또는 이메일로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="">모든 지역</option>
                {regions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Companies Table */}
        <Card>
          <CardHeader>
            <CardTitle>업체 목록</CardTitle>
            <CardDescription>등록된 업체와 담당자 정보를 관리하세요</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : companies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">등록된 업체가 없습니다.</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>업체명</TableHead>
                      <TableHead>이메일</TableHead>
                      <TableHead>지역</TableHead>
                      <TableHead>담당자</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>등록일</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/companies/${company.id}`}
                            className="hover:text-blue-600 hover:underline"
                          >
                            {company.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {company.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {company.region}
                          </div>
                        </TableCell>
                        <TableCell>
                          {company.contacts.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-medium">
                                {company.contacts[0].name}
                              </span>
                              {company.contacts.length > 1 && (
                                <span className="text-xs text-muted-foreground">
                                  외 {company.contacts.length - 1}명
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">담당자 없음</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={company.isActive ? 'default' : 'secondary'}>
                            {company.isActive ? '활성' : '비활성'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(company.createdAt).toLocaleDateString('ko-KR')}
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
                              <DropdownMenuItem asChild>
                                <Link href={`/companies/${company.id}`}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  수정
                                </Link>
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
                                        <AlertDialogTitle>업체 삭제</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          &apos;{company.name}&apos; 업체를 삭제하시겠습니까?
                                          <br />이 작업은 되돌릴 수 없으며, 관련된 모든 담당자
                                          정보도 함께 삭제됩니다.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>취소</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteCompany(company.id)}
                                          disabled={deletingCompany === company.id}
                                          className="bg-red-600 hover:bg-red-700"
                                        >
                                          {deletingCompany === company.id ? (
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
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2 py-4">
                <div className="text-sm text-muted-foreground">
                  {totalCount}개 중 {(currentPage - 1) * itemsPerPage + 1}-
                  {Math.min(currentPage * itemsPerPage, totalCount)}개 표시
                </div>
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
