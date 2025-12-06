'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { X, User, Building2, Loader2 } from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'

interface AddressBookEntry {
  type: 'contact' | 'company'
  id: string
  name: string
  email: string
  companyName?: string
  position?: string
}

interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  id?: string
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = '이메일 주소 입력',
  disabled = false,
  id,
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<AddressBookEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // 이메일 파싱 (쉼표/세미콜론으로 분리)
  const parseEmails = (str: string): string[] => {
    return str
      .split(/[,;]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0)
  }

  // 이메일 배열을 문자열로 변환
  const emailsToString = (emails: string[]): string => {
    return emails.join(', ')
  }

  // 현재 선택된 이메일들
  const selectedEmails = parseEmails(value)

  // 디바운싱된 검색어
  const debouncedSearch = useDebounce(inputValue, 300)

  // 주소록 검색
  const searchAddressBook = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([])
      return
    }

    setLoading(true)
    try {
      const response = await fetch(
        `/api/mail/address-book?q=${encodeURIComponent(query)}&limit=8`
      )
      if (response.ok) {
        const result = await response.json()
        setSuggestions(result.data || [])
      }
    } catch (error) {
      console.error('주소록 검색 실패:', error)
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  // 검색어 변경 시 검색
  useEffect(() => {
    if (debouncedSearch) {
      searchAddressBook(debouncedSearch)
    } else {
      setSuggestions([])
    }
  }, [debouncedSearch, searchAddressBook])

  // 제안 선택
  const selectSuggestion = (entry: AddressBookEntry) => {
    const newEmails = [...selectedEmails]
    if (!newEmails.includes(entry.email)) {
      newEmails.push(entry.email)
    }
    onChange(emailsToString(newEmails))
    setInputValue('')
    setSuggestions([])
    setShowSuggestions(false)
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  // 이메일 제거
  const removeEmail = (email: string) => {
    const newEmails = selectedEmails.filter((e) => e !== email)
    onChange(emailsToString(newEmails))
  }

  // 입력 핸들러
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setShowSuggestions(true)
    setSelectedIndex(-1)

    // 쉼표나 세미콜론 입력 시 현재 값 추가
    if (newValue.endsWith(',') || newValue.endsWith(';')) {
      const emailPart = newValue.slice(0, -1).trim()
      if (emailPart && emailPart.includes('@')) {
        const newEmails = [...selectedEmails, emailPart]
        onChange(emailsToString(newEmails))
        setInputValue('')
      }
    }
  }

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      // Enter 키로 직접 입력한 이메일 추가
      if (e.key === 'Enter' && inputValue.trim()) {
        e.preventDefault()
        if (inputValue.includes('@')) {
          const newEmails = [...selectedEmails, inputValue.trim()]
          onChange(emailsToString(newEmails))
          setInputValue('')
        }
      }
      // Backspace로 마지막 이메일 삭제
      if (e.key === 'Backspace' && !inputValue && selectedEmails.length > 0) {
        removeEmail(selectedEmails[selectedEmails.length - 1])
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          selectSuggestion(suggestions[selectedIndex])
        } else if (inputValue.includes('@')) {
          // 제안이 없으면 직접 입력한 이메일 추가
          const newEmails = [...selectedEmails, inputValue.trim()]
          onChange(emailsToString(newEmails))
          setInputValue('')
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
      case 'Tab':
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          e.preventDefault()
          selectSuggestion(suggestions[selectedIndex])
        }
        break
    }
  }

  // 외부 클릭 시 제안 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative">
      {/* 선택된 이메일 태그들 */}
      <div className="flex flex-wrap gap-1 mb-2">
        {selectedEmails.map((email) => (
          <Badge
            key={email}
            variant="secondary"
            className="pl-2 pr-1 py-1 text-sm flex items-center gap-1"
          >
            {email}
            <button
              type="button"
              onClick={() => removeEmail(email)}
              className="ml-1 hover:text-red-500 rounded-full"
              disabled={disabled}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      {/* 입력 필드 */}
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={selectedEmails.length > 0 ? '추가 입력...' : placeholder}
          disabled={disabled}
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* 제안 목록 */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {suggestions.map((entry, index) => (
            <div
              key={entry.id}
              className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${
                index === selectedIndex
                  ? 'bg-accent'
                  : 'hover:bg-accent/50'
              } ${selectedEmails.includes(entry.email) ? 'opacity-50' : ''}`}
              onClick={() => selectSuggestion(entry)}
            >
              <div className="flex-shrink-0">
                {entry.type === 'contact' ? (
                  <User className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">
                  {entry.name}
                  {entry.position && (
                    <span className="text-muted-foreground ml-1">
                      ({entry.position})
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {entry.email}
                  {entry.companyName && entry.type === 'contact' && (
                    <span className="ml-1">- {entry.companyName}</span>
                  )}
                </div>
              </div>
              {selectedEmails.includes(entry.email) && (
                <span className="text-xs text-muted-foreground">선택됨</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
