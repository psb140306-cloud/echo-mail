'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

export default function NewCompanyPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [availableRegions, setAvailableRegions] = useState<string[]>([])
  const [loadingRegions, setLoadingRegions] = useState(true)
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

  // 배송 가능 지역 조회
  useEffect(() => {
    const fetchAvailableRegions = async () => {
      try {
        setLoadingRegions(true)
        const response = await fetch('/api/delivery-rules/regions')
        const data = await response.json()

        if (data.success) {
          setAvailableRegions(data.data)
        } else {
          toast({
            title: '알림',
            description: '배송 가능 지역을 불러오지 못했습니다. 배송 규칙을 먼저 등록해주세요.',
            variant: 'default',
          })
        }
      } catch (error) {
        console.error('Failed to fetch regions:', error)
      } finally {
        setLoadingRegions(false)
      }
    }

    fetchAvailableRegions()
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
            <h1 className="text-lg font-semibold">새 업체 추가</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-2xl py-6">
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
                {loadingRegions ? (
                  <div className="flex items-center gap-2 px-3 py-2 border border-input bg-muted rounded-md text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    배송 가능 지역 불러오는 중...
                  </div>
                ) : availableRegions.length === 0 ? (
                  <div className="space-y-2">
                    <div className="px-3 py-2 border border-yellow-200 bg-yellow-50 rounded-md text-sm text-yellow-800">
                      ⚠️ 배송 가능한 지역이 없습니다. 먼저 배송 규칙을 등록해주세요.
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/delivery-rules')}
                    >
                      배송 규칙 등록하러 가기
                    </Button>
                  </div>
                ) : (
                  <select
                    id="region"
                    name="region"
                    value={formData.region}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                    required
                  >
                    <option value="">지역 선택</option>
                    {availableRegions.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 구분선 */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">담당자 정보</h3>

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
  )
}
