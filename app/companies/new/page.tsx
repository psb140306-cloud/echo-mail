'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Loader2, Save, Search, BookUser, X } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { AppHeader } from '@/components/layout/app-header'

interface AddressBookContact {
  id: string
  name: string
  email: string | null
  phone: string
  position: string | null
}

// 기본 지역 목록 (배송 규칙과 동일)
const DEFAULT_REGIONS = [
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
] as const

export default function NewCompanyPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [isCustomRegion, setIsCustomRegion] = useState(false) // 커스텀 지역 입력 여부
  const [allRegions, setAllRegions] = useState<string[]>([...DEFAULT_REGIONS]) // 기본 + 커스텀 지역
  const [formData, setFormData] = useState({
    // 업체 정보
    name: '',
    email: '',
    region: '',
    // 담당자 정보
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    contactPosition: '',
    smsEnabled: true,
    kakaoEnabled: false,
  })

  // 주소록 선택 관련 상태
  const [isAddressBookOpen, setIsAddressBookOpen] = useState(false)
  const [addressBookContacts, setAddressBookContacts] = useState<AddressBookContact[]>([])
  const [addressBookSearch, setAddressBookSearch] = useState('')
  const [addressBookLoading, setAddressBookLoading] = useState(false)
  const [selectedContact, setSelectedContact] = useState<AddressBookContact | null>(null)

  // 주소록 연락처 검색
  const searchAddressBook = useCallback(async (search: string) => {
    try {
      setAddressBookLoading(true)
      const params = new URLSearchParams({
        page: '1',
        limit: '20',
      })
      if (search) {
        params.append('search', search)
      }

      const response = await fetch(`/api/address-book?${params}`)
      const data = await response.json()

      if (data.success) {
        setAddressBookContacts(data.data)
      }
    } catch (error) {
      console.error('주소록 검색 실패:', error)
    } finally {
      setAddressBookLoading(false)
    }
  }, [])

  // 주소록 다이얼로그 열릴 때 초기 로드
  useEffect(() => {
    if (isAddressBookOpen) {
      searchAddressBook(addressBookSearch)
    }
  }, [isAddressBookOpen, searchAddressBook, addressBookSearch])

  // 주소록에서 연락처 선택
  const handleSelectContact = (contact: AddressBookContact) => {
    setSelectedContact(contact)
    setFormData({
      ...formData,
      contactName: contact.name,
      contactPhone: contact.phone,
      contactEmail: contact.email || '',
      contactPosition: contact.position || '',
    })
    setIsAddressBookOpen(false)
    toast({
      title: '담당자 선택됨',
      description: `${contact.name}님이 담당자로 선택되었습니다.`,
    })
  }

  // 선택된 연락처 해제
  const handleClearContact = () => {
    setSelectedContact(null)
    setFormData({
      ...formData,
      contactName: '',
      contactPhone: '',
      contactEmail: '',
      contactPosition: '',
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData({
      ...formData,
      [name]: checked,
    })
  }

  // 지역 목록 조회
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const response = await fetch('/api/regions')
        const data = await response.json()
        if (data.success) {
          setAllRegions(data.data.allRegions)
        }
      } catch (error) {
        console.error('Failed to fetch regions:', error)
      }
    }
    fetchRegions()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 필수 필드 검증
    if (!formData.name || !formData.email || !formData.region) {
      toast({
        title: '입력 오류',
        description: '업체명, 이메일, 지역은 필수 입력 항목입니다.',
        variant: 'destructive',
      })
      return
    }

    if (!formData.contactName || !formData.contactPhone) {
      toast({
        title: '입력 오류',
        description: '담당자 이름과 전화번호는 필수 입력 항목입니다.',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)

      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '성공',
          description: '업체가 성공적으로 등록되었습니다.',
        })
        router.push('/companies')
      } else {
        toast({
          title: '오류',
          description: data.error || '업체 등록에 실패했습니다.',
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
    <>
      <AppHeader />
      <div className="min-h-screen bg-gray-50/40">
        {/* Main Content */}
        <main className="container max-w-2xl py-6">
          <h1 className="text-2xl font-bold mb-6">새 업체 추가</h1>
        <Card>
          <CardHeader>
            <CardTitle>업체 정보</CardTitle>
            <CardDescription>새로운 업체의 기본 정보를 입력하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 업체명 */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  업체명 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="주식회사 에코메일"
                  required
                />
              </div>

              {/* 이메일 */}
              <div className="space-y-2">
                <Label htmlFor="email">
                  이메일 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="contact@company.com"
                  required
                />
              </div>

              {/* 지역 */}
              <div className="space-y-2">
                <Label htmlFor="region">
                  지역 <span className="text-red-500">*</span>
                </Label>
                {!isCustomRegion ? (
                  <Select
                    value={formData.region || undefined}
                    onValueChange={(value) => {
                      if (value === '__custom__') {
                        setIsCustomRegion(true)
                        setFormData({ ...formData, region: '' })
                      } else {
                        setFormData({ ...formData, region: value })
                      }
                    }}
                  >
                    <SelectTrigger id="region">
                      <SelectValue placeholder="지역 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {allRegions.map((region) => (
                        <SelectItem key={region} value={region}>
                          {region}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom__">🔧 직접 입력...</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      id="region"
                      value={formData.region}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                      placeholder="예: 송도, 판교, 분당"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsCustomRegion(false)
                        setFormData({ ...formData, region: '' })
                      }}
                    >
                      취소
                    </Button>
                  </div>
                )}
              </div>

              {/* 구분선 */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">담당자 정보</h3>
                  <Dialog open={isAddressBookOpen} onOpenChange={setIsAddressBookOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" size="sm">
                        <BookUser className="mr-2 h-4 w-4" />
                        주소록에서 선택
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>주소록에서 담당자 선택</DialogTitle>
                        <DialogDescription>
                          주소록에 등록된 연락처에서 담당자를 선택하세요.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="이름, 이메일, 전화번호로 검색..."
                            value={addressBookSearch}
                            onChange={(e) => setAddressBookSearch(e.target.value)}
                            className="pl-8"
                          />
                        </div>
                        <div className="max-h-[300px] overflow-y-auto border rounded-md">
                          {addressBookLoading ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                          ) : addressBookContacts.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              검색 결과가 없습니다.
                            </div>
                          ) : (
                            <div className="divide-y">
                              {addressBookContacts.map((contact) => (
                                <button
                                  key={contact.id}
                                  type="button"
                                  className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                                  onClick={() => handleSelectContact(contact)}
                                >
                                  <div className="font-medium">{contact.name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {contact.phone}
                                    {contact.email && ` · ${contact.email}`}
                                    {contact.position && ` · ${contact.position}`}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* 선택된 연락처 표시 */}
                {selectedContact && (
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="text-sm text-blue-600 dark:text-blue-400">
                        주소록에서 선택됨:
                      </span>
                      <span className="ml-2 font-medium">{selectedContact.name}</span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {selectedContact.phone}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearContact}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* 담당자 이름 */}
                <div className="space-y-2 mb-4">
                  <Label htmlFor="contactName">
                    담당자 이름 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="contactName"
                    name="contactName"
                    value={formData.contactName}
                    onChange={handleChange}
                    placeholder="홍길동"
                    required
                  />
                </div>

                {/* 담당자 전화번호 */}
                <div className="space-y-2 mb-4">
                  <Label htmlFor="contactPhone">
                    전화번호 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="contactPhone"
                    name="contactPhone"
                    type="tel"
                    value={formData.contactPhone}
                    onChange={handleChange}
                    placeholder="010-1234-5678"
                    required
                  />
                </div>

                {/* 담당자 이메일 */}
                <div className="space-y-2 mb-4">
                  <Label htmlFor="contactEmail">담당자 이메일</Label>
                  <Input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    value={formData.contactEmail}
                    onChange={handleChange}
                    placeholder="contact@company.com"
                  />
                </div>

                {/* 담당자 직책 */}
                <div className="space-y-2 mb-4">
                  <Label htmlFor="contactPosition">직책</Label>
                  <Input
                    id="contactPosition"
                    name="contactPosition"
                    value={formData.contactPosition}
                    onChange={handleChange}
                    placeholder="대표, 영업팀장, 구매담당 등"
                  />
                </div>

                {/* 알림 설정 */}
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="text-sm font-medium">알림 설정</h4>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="smsEnabled">SMS 알림</Label>
                      <p className="text-sm text-muted-foreground">
                        문자 메시지로 알림을 받습니다
                      </p>
                    </div>
                    <Switch
                      id="smsEnabled"
                      checked={formData.smsEnabled}
                      onCheckedChange={(checked) => handleSwitchChange('smsEnabled', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="kakaoEnabled">카카오톡 알림</Label>
                      <p className="text-sm text-muted-foreground">
                        카카오톡으로 알림을 받습니다
                      </p>
                    </div>
                    <Switch
                      id="kakaoEnabled"
                      checked={formData.kakaoEnabled}
                      onCheckedChange={(checked) => handleSwitchChange('kakaoEnabled', checked)}
                    />
                  </div>
                </div>
              </div>

              {/* 버튼 */}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
                  취소
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      등록 중...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      등록
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        </main>
      </div>
    </>
  )
}
