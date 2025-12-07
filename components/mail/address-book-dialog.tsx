'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, Users, Building2, Clock, X, Upload, Download } from 'lucide-react'
import { AddressBookImportDialog } from './address-book-import-dialog'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'

interface Contact {
  id: string
  name: string
  email: string | null
  phone: string
  position: string | null
  company: {
    id: string
    name: string
  }
}

interface Company {
  id: string
  name: string
  _count: {
    contacts: number
  }
}

type RecipientType = 'to' | 'cc' | 'bcc'

interface SelectedRecipients {
  to: Contact[]
  cc: Contact[]
  bcc: Contact[]
}

interface AddressBookDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (recipients: { to: string[]; cc: string[]; bcc: string[] }) => void
  initialTo?: string[]
  initialCc?: string[]
  initialBcc?: string[]
}

export function AddressBookDialog({
  open,
  onOpenChange,
  onConfirm,
  initialTo = [],
  initialCc = [],
  initialBcc = [],
}: AddressBookDialogProps) {
  // 상태
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)

  const [contacts, setContacts] = useState<Contact[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [recentContacts, setRecentContacts] = useState<Contact[]>([])

  const [selectedFilter, setSelectedFilter] = useState<'all' | 'recent' | string>('all')
  const [activeRecipientType, setActiveRecipientType] = useState<RecipientType>('to')
  const [importDialogOpen, setImportDialogOpen] = useState(false)

  const [selectedRecipients, setSelectedRecipients] = useState<SelectedRecipients>({
    to: [],
    cc: [],
    bcc: [],
  })

  // 연락처 로드
  const loadContacts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) {
        params.set('q', debouncedSearch)
      }
      if (selectedFilter !== 'all' && selectedFilter !== 'recent') {
        params.set('companyId', selectedFilter)
      }
      params.set('limit', '100')

      const response = await fetch(`/api/mail/address-book?${params.toString()}`)
      if (response.ok) {
        const result = await response.json()
        const data = result.data || result  // createSuccessResponse가 { data: ... } 형태로 감쌈
        setContacts(data.contacts || [])

        // 처음 로드 시에만 회사 목록과 최근 연락처 설정
        if (!companies.length) {
          setCompanies(data.companies || [])
        }
        if (!recentContacts.length && data.recentContacts) {
          setRecentContacts(data.recentContacts)
        }
      }
    } catch (error) {
      console.error('연락처 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, selectedFilter, companies.length, recentContacts.length])

  // 초기 로드
  useEffect(() => {
    if (open) {
      loadContacts()
    }
  }, [open, loadContacts])

  // 필터 변경 시 연락처 다시 로드
  useEffect(() => {
    if (open) {
      loadContacts()
    }
  }, [selectedFilter, debouncedSearch])

  // 연락처 선택/해제
  const toggleContact = (contact: Contact) => {
    if (!contact.email) return

    setSelectedRecipients(prev => {
      const current = prev[activeRecipientType]
      const exists = current.some(c => c.id === contact.id)

      if (exists) {
        return {
          ...prev,
          [activeRecipientType]: current.filter(c => c.id !== contact.id),
        }
      } else {
        return {
          ...prev,
          [activeRecipientType]: [...current, contact],
        }
      }
    })
  }

  // 선택된 연락처 제거
  const removeRecipient = (type: RecipientType, contactId: string) => {
    setSelectedRecipients(prev => ({
      ...prev,
      [type]: prev[type].filter(c => c.id !== contactId),
    }))
  }

  // 연락처가 선택되었는지 확인
  const isSelected = (contactId: string): RecipientType | null => {
    if (selectedRecipients.to.some(c => c.id === contactId)) return 'to'
    if (selectedRecipients.cc.some(c => c.id === contactId)) return 'cc'
    if (selectedRecipients.bcc.some(c => c.id === contactId)) return 'bcc'
    return null
  }

  // 확인 버튼 핸들러
  const handleConfirm = () => {
    onConfirm({
      to: selectedRecipients.to.map(c => c.email!).filter(Boolean),
      cc: selectedRecipients.cc.map(c => c.email!).filter(Boolean),
      bcc: selectedRecipients.bcc.map(c => c.email!).filter(Boolean),
    })
    onOpenChange(false)
  }

  // 초기화
  const handleReset = () => {
    setSelectedRecipients({ to: [], cc: [], bcc: [] })
    setSearchQuery('')
    setSelectedFilter('all')
  }

  // 표시할 연락처 목록
  const displayContacts = selectedFilter === 'recent' ? recentContacts : contacts

  // 주소록 내보내기
  const handleExport = () => {
    window.open('/api/mail/address-book/export', '_blank')
  }

  // 가져오기 성공 시 연락처 다시 로드
  const handleImportSuccess = () => {
    setCompanies([]) // 회사 목록도 다시 로드하기 위해 초기화
    setRecentContacts([])
    loadContacts()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[600px] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>메일 주소록</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportDialogOpen(true)}
              >
                <Upload className="h-4 w-4 mr-1" />
                가져오기
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
              >
                <Download className="h-4 w-4 mr-1" />
                내보내기
              </Button>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="이메일 주소 검색"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* 왼쪽: 분류 */}
          <div className="w-48 border-r bg-muted/30">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                <Button
                  variant={selectedFilter === 'all' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSelectedFilter('all')}
                >
                  <Users className="mr-2 h-4 w-4" />
                  전체
                  <Badge variant="outline" className="ml-auto">
                    {contacts.length}
                  </Badge>
                </Button>

                <Button
                  variant={selectedFilter === 'recent' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSelectedFilter('recent')}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  최근 사용
                  <Badge variant="outline" className="ml-auto">
                    {recentContacts.length}
                  </Badge>
                </Button>

                <div className="pt-2 pb-1 px-2">
                  <span className="text-xs font-medium text-muted-foreground">업체별</span>
                </div>

                {companies.map((company) => (
                  <Button
                    key={company.id}
                    variant={selectedFilter === company.id ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setSelectedFilter(company.id)}
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    <span className="truncate flex-1 text-left">{company.name}</span>
                    <Badge variant="outline" className="ml-1">
                      {company._count.contacts}
                    </Badge>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* 중앙: 연락처 목록 */}
          <div className="flex-1 flex flex-col">
            <div className="p-2 border-b bg-muted/20">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={displayContacts.length > 0 && displayContacts.every(c => c.email && isSelected(c.id))}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      const emailContacts = displayContacts.filter(c => c.email)
                      setSelectedRecipients(prev => ({
                        ...prev,
                        [activeRecipientType]: [
                          ...prev[activeRecipientType],
                          ...emailContacts.filter(c => !prev[activeRecipientType].some(p => p.id === c.id))
                        ],
                      }))
                    } else {
                      setSelectedRecipients(prev => ({
                        ...prev,
                        [activeRecipientType]: prev[activeRecipientType].filter(
                          c => !displayContacts.some(dc => dc.id === c.id)
                        ),
                      }))
                    }
                  }}
                />
                <label htmlFor="select-all" className="text-sm text-muted-foreground">
                  전체 선택
                </label>
              </div>
            </div>

            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : displayContacts.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  연락처가 없습니다
                </div>
              ) : (
                <div className="divide-y">
                  {displayContacts.map((contact) => {
                    const selectedType = isSelected(contact.id)
                    const hasEmail = !!contact.email

                    return (
                      <div
                        key={contact.id}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer',
                          !hasEmail && 'opacity-50 cursor-not-allowed',
                          selectedType && 'bg-primary/5'
                        )}
                        onClick={() => hasEmail && toggleContact(contact)}
                      >
                        <Checkbox
                          checked={selectedType === activeRecipientType}
                          disabled={!hasEmail}
                          className={cn(
                            selectedType && selectedType !== activeRecipientType && 'opacity-50'
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{contact.name}</span>
                            {contact.position && (
                              <span className="text-xs text-muted-foreground">
                                {contact.position}
                              </span>
                            )}
                            {selectedType && (
                              <Badge variant="outline" className="text-xs">
                                {selectedType === 'to' ? '받는 사람' : selectedType === 'cc' ? '참조' : '숨은참조'}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {contact.email || '이메일 없음'}
                            {contact.company && (
                              <span className="ml-2">• {contact.company.name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* 오른쪽: 선택된 수신자 */}
          <div className="w-56 border-l bg-muted/30">
            <div className="h-full flex flex-col">
              {/* 받는 사람 */}
              <div
                className={cn(
                  'flex-1 p-3 cursor-pointer border-b',
                  activeRecipientType === 'to' && 'bg-primary/10'
                )}
                onClick={() => setActiveRecipientType('to')}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">받는 사람</span>
                  <Badge variant={activeRecipientType === 'to' ? 'default' : 'outline'}>
                    {selectedRecipients.to.length}
                  </Badge>
                </div>
                <ScrollArea className="h-24">
                  <div className="space-y-1">
                    {selectedRecipients.to.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center gap-1 text-xs bg-background rounded px-2 py-1"
                      >
                        <span className="truncate flex-1">{contact.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeRecipient('to', contact.id)
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* 참조 */}
              <div
                className={cn(
                  'flex-1 p-3 cursor-pointer border-b',
                  activeRecipientType === 'cc' && 'bg-primary/10'
                )}
                onClick={() => setActiveRecipientType('cc')}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">참조</span>
                  <Badge variant={activeRecipientType === 'cc' ? 'default' : 'outline'}>
                    {selectedRecipients.cc.length}
                  </Badge>
                </div>
                <ScrollArea className="h-24">
                  <div className="space-y-1">
                    {selectedRecipients.cc.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center gap-1 text-xs bg-background rounded px-2 py-1"
                      >
                        <span className="truncate flex-1">{contact.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeRecipient('cc', contact.id)
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* 숨은참조 */}
              <div
                className={cn(
                  'flex-1 p-3 cursor-pointer',
                  activeRecipientType === 'bcc' && 'bg-primary/10'
                )}
                onClick={() => setActiveRecipientType('bcc')}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">숨은 참조</span>
                  <Badge variant={activeRecipientType === 'bcc' ? 'default' : 'outline'}>
                    {selectedRecipients.bcc.length}
                  </Badge>
                </div>
                <ScrollArea className="h-24">
                  <div className="space-y-1">
                    {selectedRecipients.bcc.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center gap-1 text-xs bg-background rounded px-2 py-1"
                      >
                        <span className="truncate flex-1">{contact.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeRecipient('bcc', contact.id)
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <div className="flex-1 text-sm text-muted-foreground">
            받는 사람/참조/숨은참조 영역을 선택 후 좌측의 주소를 선택하면 해당 영역에 입력됩니다.
          </div>
          <Button variant="outline" onClick={handleReset}>
            초기화
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleConfirm}>
            확인
          </Button>
        </DialogFooter>

        {/* 가져오기 다이얼로그 */}
        <AddressBookImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onSuccess={handleImportSuccess}
        />
      </DialogContent>
    </Dialog>
  )
}
