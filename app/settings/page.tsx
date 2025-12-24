'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { AppHeader } from '@/components/layout/app-header'
import {
  ArrowLeft,
  Mail,
  Settings,
  Save,
  Link2,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Building2,
  Users,
  Clock,
  FileText,
  Bell,
  RefreshCw,
  Send,
  Inbox,
  Lock,
  Crown,
  Search,
  Plus,
  X,
  Edit3,
  Eye,
  RotateCcw,
  MessageSquare,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Trash2,
  Sparkles,
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { UsageDisplay } from '@/components/subscription/usage-display'

interface TenantSettings {
  mailServer: {
    host: string
    port: number
    username: string
    password: string
    useSSL: boolean
    enabled: boolean
    autoMarkAsRead: boolean
  }
  smtp: {
    host: string
    port: number
    username: string
    password: string
    useSSL: boolean
    useImapCredentials: boolean // IMAP 인증 정보 사용 여부
  }
  notification: {
    defaultSMSEnabled: boolean
    defaultKakaoEnabled: boolean
    notifyOnNewOrder: boolean
    notifyOnError: boolean
    retryEnabled: boolean
    retryInterval: number
    maxRetries: number
  }
  business: {
    companyName: string
    businessNumber: string
    address: string
    contactEmail: string
    contactPhone: string
  }
}

interface MailOptions {
  mailMode: 'ORDER_ONLY' | 'FULL_INBOX'
  mailSendingEnabled: boolean
  permissions: {
    canChangeMailMode: boolean
    canEnableMailSending: boolean
  }
  currentPlan: string
}

interface KeywordSettings {
  keywords: string[]
  keywordsDisabled: boolean
}

interface MessageTemplate {
  id: string
  name: string
  type: 'SMS' | 'KAKAO_ALIMTALK' | 'EMAIL'
  subject?: string
  content: string
  variables: string[]
  isDefault: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<TenantSettings>({
    mailServer: {
      host: '',
      port: 993,
      username: '',
      password: '',
      useSSL: true,
      enabled: false,
      autoMarkAsRead: true, // 기본값 true - 처리된 메일 자동 읽음 처리
    },
    smtp: {
      host: '',
      port: 465,
      username: '',
      password: '',
      useSSL: true,
      useImapCredentials: true, // 기본값: IMAP 인증 정보 사용
    },
    notification: {
      defaultSMSEnabled: true,
      defaultKakaoEnabled: false, // 기본값 false - 카카오 Provider 미설정 시 중복 발송 방지
      notifyOnNewOrder: true,
      notifyOnError: true,
      retryEnabled: false,
      retryInterval: 10,
      maxRetries: 2,
    },
    business: {
      companyName: '',
      businessNumber: '',
      address: '',
      contactEmail: '',
      contactPhone: '',
    },
  })

  const [loading, setLoading] = useState(false)
  const [testingMail, setTestingMail] = useState(false)
  const [testingSmtp, setTestingSmtp] = useState(false)
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [mailboxInfo, setMailboxInfo] = useState<{
    path: string
    exists: number
    messages: number
  } | null>(null)
  const [mailOptions, setMailOptions] = useState<MailOptions>({
    mailMode: 'ORDER_ONLY',
    mailSendingEnabled: false,
    permissions: {
      canChangeMailMode: false,
      canEnableMailSending: false,
    },
    currentPlan: 'FREE_TRIAL',
  })
  const [savingMailOptions, setSavingMailOptions] = useState(false)
  const [keywordSettings, setKeywordSettings] = useState<KeywordSettings>({
    keywords: ['발주', '주문', '구매', '납품', 'order', 'purchase', 'po'],
    keywordsDisabled: false,
  })
  const [newKeyword, setNewKeyword] = useState('')
  const [savingKeywords, setSavingKeywords] = useState(false)

  // 템플릿 관련 state
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null)
  const [previewContent, setPreviewContent] = useState<string>('')
  const [showGuide, setShowGuide] = useState(true)
  const [showNewTemplateDialog, setShowNewTemplateDialog] = useState(false)
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    type: 'SMS' as 'SMS' | 'KAKAO_ALIMTALK' | 'EMAIL',
    content: '',
    subject: '',
  })
  const [creatingTemplate, setCreatingTemplate] = useState(false)
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null)
  const [switchingToTemplateId, setSwitchingToTemplateId] = useState<string | null>(null)

  // 발송에 사용되는 템플릿 이름 (시스템에서 사용)
  const ACTIVE_TEMPLATE_NAMES = {
    SMS: 'ORDER_RECEIVED_SMS',
    KAKAO_ALIMTALK: 'ORDER_RECEIVED_KAKAO',
  } as const

  // 기본 템플릿 정의
  const defaultTemplates = [
    {
      name: 'ORDER_RECEIVED_SMS',
      type: 'SMS' as const,
      content: '[발주접수] {{companyName}} 납품:{{shortDate}}{{deliveryTime}}',
      variables: ['companyName', 'shortDate', 'deliveryTime'],
      description: '발주 접수 시 SMS로 발송되는 기본 알림',
    },
    {
      name: 'ORDER_RECEIVED_KAKAO',
      type: 'KAKAO_ALIMTALK' as const,
      subject: '발주 접수 확인',
      content: '{{companyName}}님의 발주가 정상적으로 접수되었습니다.\n\n📦 납품 예정일: {{deliveryDate}}{{deliveryTime}}\n\n문의사항이 있으시면 언제든 연락 주세요.\n감사합니다.',
      variables: ['companyName', 'deliveryDate', 'deliveryTime'],
      description: '발주 접수 시 카카오 알림톡으로 발송되는 알림',
    },
    {
      name: 'DELIVERY_REMINDER_SMS',
      type: 'SMS' as const,
      content: '[배송안내] {{companyName}}님 오늘 {{deliveryTime}} 배송예정. 문의:{{contactNumber}}',
      variables: ['companyName', 'deliveryTime', 'contactNumber'],
      description: '배송 당일 발송되는 안내 SMS',
    },
    {
      name: 'URGENT_NOTICE_SMS',
      type: 'SMS' as const,
      content: '[긴급공지] {{message}} 문의:{{contactNumber}}',
      variables: ['message', 'contactNumber'],
      description: '긴급 공지 발송용 SMS',
    },
  ]

  const { toast } = useToast()

  useEffect(() => {
    loadSettings()
    loadMailOptions()
    loadKeywordSettings()
    loadTemplates()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const result = await response.json()
        // API 응답이 { data: {...} } 형태인지 확인
        const settingsData = result.data || result
        setSettings((prev) => ({
          ...prev,
          ...settingsData,
        }))
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '설정을 불러오는데 실패했습니다',
        variant: 'destructive',
      })
    }
  }

  const loadMailOptions = async () => {
    try {
      const response = await fetch('/api/settings/mail-options')
      if (response.ok) {
        const result = await response.json()
        const data = result.data || result
        setMailOptions({
          mailMode: data.mailMode || 'ORDER_ONLY',
          mailSendingEnabled: data.mailSendingEnabled || false,
          permissions: data.permissions || {
            canChangeMailMode: false,
            canEnableMailSending: false,
          },
          currentPlan: data.currentPlan || 'FREE_TRIAL',
        })
      }
    } catch (error) {
      console.error('메일 옵션 로드 실패:', error)
    }
  }

  const loadKeywordSettings = async () => {
    try {
      const response = await fetch('/api/settings/keywords')
      if (response.ok) {
        const result = await response.json()
        const data = result.data || result
        setKeywordSettings({
          keywords: data.keywords || ['발주', '주문', '구매', '납품', 'order', 'purchase', 'po'],
          keywordsDisabled: data.keywordsDisabled || false,
        })
      }
    } catch (error) {
      console.error('키워드 설정 로드 실패:', error)
    }
  }

  const loadTemplates = async () => {
    setLoadingTemplates(true)
    try {
      const response = await fetch('/api/notifications/templates')
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          setTemplates(result.data)
        }
      }
    } catch (error) {
      console.error('템플릿 로드 실패:', error)
    } finally {
      setLoadingTemplates(false)
    }
  }

  const saveTemplate = async () => {
    if (!editingTemplate) return

    setSavingTemplate(true)
    try {
      const response = await fetch('/api/notifications/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTemplate.id,
          subject: editingTemplate.subject,
          content: editingTemplate.content,
          variables: editingTemplate.variables,
          isActive: editingTemplate.isActive,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '저장 완료',
          description: '템플릿이 저장되었습니다.',
        })
        setEditingTemplate(null)
        loadTemplates()
      } else {
        toast({
          title: '저장 실패',
          description: result.error || '템플릿 저장에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '템플릿 저장 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setSavingTemplate(false)
    }
  }

  const handlePreview = (template: MessageTemplate) => {
    // 샘플 변수로 미리보기 생성
    const sampleVars: Record<string, string> = {
      companyName: '대한상사',
      deliveryDate: '2025년 1월 20일',
      shortDate: '1/20',
      deliveryTime: '오전',
      contactNumber: '010-1234-5678',
      message: '긴급 공지사항입니다.',
    }

    let preview = template.content
    Object.entries(sampleVars).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
    })

    setPreviewContent(preview)
    setPreviewTemplate(template)
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'SMS':
        return 'SMS'
      case 'KAKAO_ALIMTALK':
        return '카카오 알림톡'
      case 'EMAIL':
        return '이메일'
      default:
        return type
    }
  }

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'SMS':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'KAKAO_ALIMTALK':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'EMAIL':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  // 콘텐츠에서 변수 추출
  const extractVariables = (content: string): string[] => {
    const matches = content.match(/\{\{([^}]+)\}\}/g) || []
    const variables = matches.map(m => m.replace(/\{\{|\}\}/g, ''))
    return [...new Set(variables)]
  }

  // 새 템플릿 생성
  const createNewTemplate = async () => {
    if (!newTemplate.name || !newTemplate.content) {
      toast({
        title: '입력 오류',
        description: '템플릿 이름과 내용을 입력해주세요.',
        variant: 'destructive',
      })
      return
    }

    setCreatingTemplate(true)
    try {
      const variables = extractVariables(newTemplate.content)

      const response = await fetch('/api/notifications/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTemplate.name,
          type: newTemplate.type,
          subject: newTemplate.subject || undefined,
          content: newTemplate.content,
          variables,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '생성 완료',
          description: '새 템플릿이 생성되었습니다.',
        })
        setShowNewTemplateDialog(false)
        setNewTemplate({ name: '', type: 'SMS', content: '', subject: '' })
        loadTemplates()
      } else {
        toast({
          title: '생성 실패',
          description: result.error || '템플릿 생성에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '템플릿 생성 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setCreatingTemplate(false)
    }
  }

  // 템플릿 삭제
  const deleteTemplate = async (templateId: string) => {
    setDeletingTemplateId(templateId)
    try {
      const response = await fetch(`/api/notifications/templates?id=${templateId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '삭제 완료',
          description: '템플릿이 삭제되었습니다.',
        })
        loadTemplates()
      } else {
        toast({
          title: '삭제 실패',
          description: result.error || '템플릿 삭제에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '템플릿 삭제 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setDeletingTemplateId(null)
    }
  }

  // 기본 템플릿 복사하여 내 템플릿으로 추가
  const copyFromDefault = (defaultTemplate: typeof defaultTemplates[0]) => {
    setNewTemplate({
      name: defaultTemplate.name + '_CUSTOM',
      type: defaultTemplate.type,
      content: defaultTemplate.content,
      subject: defaultTemplate.subject || '',
    })
    setShowNewTemplateDialog(true)
  }

  // 기본 템플릿 DB에 등록 (기존 없는 경우)
  const restoreDefaultTemplate = async (defaultTemplate: typeof defaultTemplates[0]) => {
    setCreatingTemplate(true)
    try {
      const response = await fetch('/api/notifications/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: defaultTemplate.name,
          type: defaultTemplate.type,
          subject: defaultTemplate.subject || undefined,
          content: defaultTemplate.content,
          variables: defaultTemplate.variables,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '복원 완료',
          description: `${defaultTemplate.name} 템플릿이 복원되었습니다.`,
        })
        loadTemplates()
      } else {
        toast({
          title: '복원 실패',
          description: result.error || '템플릿 복원에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '템플릿 복원 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setCreatingTemplate(false)
    }
  }

  // 기본 템플릿이 이미 등록되어 있는지 확인
  const isDefaultTemplateRegistered = (name: string) => {
    return templates.some(t => t.name === name)
  }

  // 현재 발송에 사용 중인 템플릿인지 확인
  const isActiveTemplate = (template: MessageTemplate) => {
    return template.name === ACTIVE_TEMPLATE_NAMES.SMS ||
           template.name === ACTIVE_TEMPLATE_NAMES.KAKAO_ALIMTALK
  }

  // 해당 타입의 활성 템플릿 이름 가져오기
  const getActiveTemplateName = (type: 'SMS' | 'KAKAO_ALIMTALK' | 'EMAIL') => {
    if (type === 'SMS') return ACTIVE_TEMPLATE_NAMES.SMS
    if (type === 'KAKAO_ALIMTALK') return ACTIVE_TEMPLATE_NAMES.KAKAO_ALIMTALK
    return null
  }

  // 템플릿 전환 (선택한 템플릿으로 발송 템플릿 변경)
  const switchToTemplate = async (template: MessageTemplate) => {
    const activeTemplateName = getActiveTemplateName(template.type)
    if (!activeTemplateName) {
      toast({
        title: '지원하지 않는 타입',
        description: '이메일 템플릿은 전환 기능을 지원하지 않습니다.',
        variant: 'destructive',
      })
      return
    }

    setSwitchingToTemplateId(template.id)
    try {
      // 1. 기존 활성 템플릿 찾기
      const currentActive = templates.find(t => t.name === activeTemplateName)

      // 2. 기존 활성 템플릿이 있으면 이름 변경 (백업)
      if (currentActive) {
        const backupName = `${activeTemplateName}_BACKUP_${Date.now()}`
        await fetch('/api/notifications/templates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: currentActive.id,
            name: backupName,
          }),
        })
      }

      // 3. 선택한 템플릿 이름을 활성 템플릿 이름으로 변경
      const response = await fetch('/api/notifications/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: template.id,
          name: activeTemplateName,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '전환 완료',
          description: `"${template.name}" 템플릿이 발송 템플릿으로 설정되었습니다.`,
        })
        loadTemplates()
      } else {
        toast({
          title: '전환 실패',
          description: result.error || '템플릿 전환에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '템플릿 전환 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setSwitchingToTemplateId(null)
    }
  }

  const saveKeywordSettings = async () => {
    setSavingKeywords(true)
    try {
      const response = await fetch('/api/settings/keywords', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(keywordSettings),
      })

      const result = await response.json()

      if (response.ok) {
        // 저장 성공 시 응답 데이터로 상태 업데이트
        const savedData = result.data
        if (savedData) {
          setKeywordSettings({
            keywords: savedData.keywords || keywordSettings.keywords,
            keywordsDisabled: savedData.keywordsDisabled ?? keywordSettings.keywordsDisabled,
          })
        }
        toast({
          title: '성공',
          description: result.message || '키워드 설정이 저장되었습니다',
        })
        // 저장 후 다시 로드하여 서버 상태와 동기화
        await loadKeywordSettings()
      } else {
        toast({
          title: '오류',
          description: result.message || '키워드 설정 저장에 실패했습니다',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '키워드 설정 저장 중 오류가 발생했습니다',
        variant: 'destructive',
      })
    } finally {
      setSavingKeywords(false)
    }
  }

  const addKeyword = () => {
    const trimmed = newKeyword.trim()
    if (!trimmed) return
    if (keywordSettings.keywords.includes(trimmed)) {
      toast({
        title: '중복',
        description: '이미 등록된 키워드입니다',
        variant: 'destructive',
      })
      return
    }
    setKeywordSettings({
      ...keywordSettings,
      keywords: [...keywordSettings.keywords, trimmed],
    })
    setNewKeyword('')
  }

  const removeKeyword = (keyword: string) => {
    setKeywordSettings({
      ...keywordSettings,
      keywords: keywordSettings.keywords.filter((k) => k !== keyword),
    })
  }

  const saveMailOptions = async () => {
    setSavingMailOptions(true)
    try {
      const response = await fetch('/api/settings/mail-options', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mailMode: mailOptions.mailMode,
          mailSendingEnabled: mailOptions.mailSendingEnabled,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: '성공',
          description: result.message || '메일 옵션이 저장되었습니다',
        })
      } else {
        toast({
          title: '오류',
          description: result.message || '메일 옵션 저장에 실패했습니다',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '메일 옵션 저장 중 오류가 발생했습니다',
        variant: 'destructive',
      })
    } finally {
      setSavingMailOptions(false)
    }
  }

  const saveSettings = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      })

      if (response.ok) {
        toast({
          title: '성공',
          description: '설정이 저장되었습니다',
        })

        // 메일 서버 설정이 변경되었으면 스케줄러 리로드 (활성화/비활성화 모두)
        // reloadAllSchedules()가 enabled=true인 테넌트만 스케줄 등록하므로
        // 비활성화 시에도 호출해야 기존 스케줄이 제거됨
        await fetch('/api/scheduler/reload', { method: 'POST' })
      } else {
        throw new Error('설정 저장 실패')
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '설정 저장에 실패했습니다',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const testMailConnection = async () => {
    if (!settings.mailServer.host || !settings.mailServer.username || !settings.mailServer.password) {
      toast({
        title: '입력 오류',
        description: '메일 서버 정보를 모두 입력해주세요',
        variant: 'destructive',
      })
      return
    }

    setTestingMail(true)
    try {
      const response = await fetch('/api/settings/test/mail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings.mailServer),
      })

      const result = await response.json()

      if (result.success) {
        // 메일함 정보 저장
        if (result.data?.mailbox) {
          setMailboxInfo(result.data.mailbox)
        }

        toast({
          title: '연결 성공',
          description: result.message,
        })
      } else {
        setMailboxInfo(null)
        toast({
          title: '연결 실패',
          description: result.message || '메일 서버 연결에 실패했습니다',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '연결 테스트 중 오류가 발생했습니다',
        variant: 'destructive',
      })
    } finally {
      setTestingMail(false)
    }
  }

  const testSmtpConnection = async () => {
    // IMAP 인증 사용 시 IMAP 설정 확인
    if (settings.smtp.useImapCredentials) {
      if (!settings.mailServer.host || !settings.mailServer.username || !settings.mailServer.password) {
        toast({
          title: '입력 오류',
          description: 'IMAP 인증 사용 시 메일 서버 정보를 먼저 입력해주세요',
          variant: 'destructive',
        })
        return
      }
    } else {
      if (!settings.smtp.host || !settings.smtp.username || !settings.smtp.password) {
        toast({
          title: '입력 오류',
          description: 'SMTP 서버 정보를 모두 입력해주세요',
          variant: 'destructive',
        })
        return
      }
    }

    setTestingSmtp(true)
    setSmtpTestResult(null)
    try {
      const response = await fetch('/api/settings/test/smtp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...settings.smtp,
          // IMAP 인증 사용 시 IMAP 정보로 대체
          ...(settings.smtp.useImapCredentials && {
            host: settings.mailServer.host.replace('imap.', 'smtp.'),
            username: settings.mailServer.username,
            password: settings.mailServer.password,
          }),
        }),
      })

      const result = await response.json()

      if (result.success) {
        setSmtpTestResult({ success: true, message: 'SMTP 연결 성공' })
        toast({
          title: '연결 성공',
          description: 'SMTP 서버에 정상적으로 연결되었습니다',
        })
      } else {
        setSmtpTestResult({ success: false, message: result.message || 'SMTP 연결 실패' })
        toast({
          title: '연결 실패',
          description: result.message || 'SMTP 서버 연결에 실패했습니다',
          variant: 'destructive',
        })
      }
    } catch (error) {
      setSmtpTestResult({ success: false, message: '연결 테스트 중 오류 발생' })
      toast({
        title: '오류',
        description: 'SMTP 연결 테스트 중 오류가 발생했습니다',
        variant: 'destructive',
      })
    } finally {
      setTestingSmtp(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AppHeader />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              대시보드
            </Button>
          </Link>

          <div>
            <h1 className="text-3xl font-bold tracking-tight">시스템 설정</h1>
            <p className="text-gray-500 mt-1">서비스 설정을 관리합니다</p>
          </div>
        </div>

        <div className="mb-6">
          <UsageDisplay />
        </div>

        <Tabs defaultValue="mail" className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full max-w-[750px]">
            <TabsTrigger value="mail">
              <Mail className="mr-2 h-4 w-4" />
              메일 서버
            </TabsTrigger>
            <TabsTrigger value="keyword">
              <Search className="mr-2 h-4 w-4" />
              키워드
            </TabsTrigger>
            <TabsTrigger value="notification">
              <Bell className="mr-2 h-4 w-4" />
              알림
            </TabsTrigger>
            <TabsTrigger value="business">
              <Building2 className="mr-2 h-4 w-4" />
              사업자 정보
            </TabsTrigger>
            <TabsTrigger value="template">
              <FileText className="mr-2 h-4 w-4" />
              템플릿
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mail">
            <Card>
              <CardHeader>
                <CardTitle>메일 서버 설정</CardTitle>
                <CardDescription>
                  발주 메일을 수신할 메일 서버를 설정합니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mail-enabled">메일 모니터링 활성화</Label>
                  <Switch
                    id="mail-enabled"
                    checked={settings.mailServer.enabled}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        mailServer: { ...settings.mailServer, enabled: checked },
                      })
                    }
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mail-host">IMAP 서버</Label>
                    <Input
                      id="mail-host"
                      placeholder="imap.gmail.com"
                      value={settings.mailServer.host}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          mailServer: { ...settings.mailServer, host: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mail-port">포트</Label>
                    <Input
                      id="mail-port"
                      type="number"
                      placeholder="993"
                      value={settings.mailServer.port}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          mailServer: { ...settings.mailServer, port: parseInt(e.target.value) },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mail-username">이메일 주소</Label>
                  <Input
                    id="mail-username"
                    type="email"
                    placeholder="your@email.com"
                    value={settings.mailServer.username}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        mailServer: { ...settings.mailServer, username: e.target.value },
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mail-password">비밀번호</Label>
                  <Input
                    id="mail-password"
                    type="password"
                    placeholder="앱 비밀번호 입력"
                    value={settings.mailServer.password}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        mailServer: { ...settings.mailServer, password: e.target.value },
                      })
                    }
                  />
                  <p className="text-sm text-gray-500">
                    Gmail의 경우 앱 비밀번호를 사용하세요
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>메일 확인 주기</Label>
                  <p className="text-sm text-muted-foreground">
                    새 메일은 <span className="font-medium text-primary">2분마다</span> 자동으로 확인됩니다
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="use-ssl"
                    checked={settings.mailServer.useSSL}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        mailServer: { ...settings.mailServer, useSSL: checked },
                      })
                    }
                  />
                  <Label htmlFor="use-ssl">SSL/TLS 사용</Label>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-mark-as-read">처리 완료 후 자동 읽음 처리</Label>
                    <p className="text-sm text-muted-foreground">
                      메시지 발송 후 메일을 자동으로 읽음 상태로 변경합니다
                    </p>
                  </div>
                  <Switch
                    id="auto-mark-as-read"
                    checked={settings.mailServer.autoMarkAsRead}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        mailServer: { ...settings.mailServer, autoMarkAsRead: checked },
                      })
                    }
                  />
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={testMailConnection}
                    disabled={testingMail}
                  >
                    {testingMail ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="mr-2 h-4 w-4" />
                    )}
                    연결 테스트
                  </Button>
                </div>

                {/* 메일함 정보 표시 */}
                {mailboxInfo && (
                  <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                          연결 성공
                        </h4>
                        <div className="space-y-1 text-sm text-green-800 dark:text-green-200">
                          <p>
                            <span className="font-medium">메일함:</span> {mailboxInfo.path}
                          </p>
                          <p>
                            <span className="font-medium">전체 메일:</span>{' '}
                            {mailboxInfo.exists === 1000
                              ? '999+개'
                              : `${mailboxInfo.exists.toLocaleString()}개`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SMTP 설정 카드 */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  SMTP 설정 (메일 발신)
                </CardTitle>
                <CardDescription>
                  메일 발신에 사용할 SMTP 서버를 설정합니다. 메일 발신 기능을 사용하려면 SMTP 설정이 필요합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>IMAP 인증 정보 사용</Label>
                    <p className="text-sm text-gray-500">
                      활성화 시 IMAP 설정의 인증 정보를 SMTP에도 사용합니다 (Gmail, Naver 등)
                    </p>
                  </div>
                  <Switch
                    checked={settings.smtp.useImapCredentials}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        smtp: { ...settings.smtp, useImapCredentials: checked },
                      })
                    }
                  />
                </div>

                <Separator />

                {/* IMAP 인증 사용 시 자동 추론 정보 표시 */}
                {settings.smtp.useImapCredentials ? (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h4 className="font-medium mb-2">자동 추론 설정</h4>
                    <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <p>
                        <span className="font-medium">SMTP 호스트:</span>{' '}
                        {settings.mailServer.host
                          ? settings.mailServer.host.replace('imap.', 'smtp.')
                          : '(IMAP 호스트 미설정)'}
                      </p>
                      <p>
                        <span className="font-medium">포트:</span> 465 (SSL)
                      </p>
                      <p>
                        <span className="font-medium">사용자:</span>{' '}
                        {settings.mailServer.username || '(IMAP 사용자 미설정)'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="smtp-host">SMTP 서버</Label>
                        <Input
                          id="smtp-host"
                          placeholder="smtp.gmail.com"
                          value={settings.smtp.host}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              smtp: { ...settings.smtp, host: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtp-port">포트</Label>
                        <Input
                          id="smtp-port"
                          type="number"
                          placeholder="465"
                          value={settings.smtp.port}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              smtp: { ...settings.smtp, port: parseInt(e.target.value) },
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="smtp-username">SMTP 사용자</Label>
                      <Input
                        id="smtp-username"
                        type="email"
                        placeholder="your@email.com"
                        value={settings.smtp.username}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            smtp: { ...settings.smtp, username: e.target.value },
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="smtp-password">SMTP 비밀번호</Label>
                      <Input
                        id="smtp-password"
                        type="password"
                        placeholder="앱 비밀번호 입력"
                        value={settings.smtp.password}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            smtp: { ...settings.smtp, password: e.target.value },
                          })
                        }
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="smtp-ssl"
                        checked={settings.smtp.useSSL}
                        onCheckedChange={(checked) =>
                          setSettings({
                            ...settings,
                            smtp: { ...settings.smtp, useSSL: checked },
                          })
                        }
                      />
                      <Label htmlFor="smtp-ssl">SSL/TLS 사용</Label>
                    </div>
                  </>
                )}

                <Separator />

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={testSmtpConnection}
                    disabled={testingSmtp}
                  >
                    {testingSmtp ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="mr-2 h-4 w-4" />
                    )}
                    SMTP 연결 테스트
                  </Button>
                </div>

                {/* SMTP 테스트 결과 */}
                {smtpTestResult && (
                  <div className={`mt-4 p-4 rounded-lg border ${
                    smtpTestResult.success
                      ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                  }`}>
                    <div className="flex items-center gap-2">
                      {smtpTestResult.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      )}
                      <span className={smtpTestResult.success
                        ? 'text-green-800 dark:text-green-200'
                        : 'text-red-800 dark:text-red-200'
                      }>
                        {smtpTestResult.message}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 메일 기능 옵션 카드 */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Inbox className="h-5 w-5" />
                  메일 기능 옵션
                </CardTitle>
                <CardDescription>
                  메일 수신 범위와 발신 기능을 설정합니다.
                  {!mailOptions.permissions.canChangeMailMode && (
                    <span className="block mt-1 text-amber-600 dark:text-amber-400">
                      <Crown className="inline h-4 w-4 mr-1" />
                      프로페셔널 플랜 이상에서 사용 가능한 기능입니다.
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 메일 모드 선택 */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">메일 수신 범위</Label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* 발주 메일만 */}
                    <div
                      className={`relative rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                        mailOptions.mailMode === 'ORDER_ONLY'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                      onClick={() =>
                        setMailOptions({ ...mailOptions, mailMode: 'ORDER_ONLY' })
                      }
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                          mailOptions.mailMode === 'ORDER_ONLY'
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}>
                          {mailOptions.mailMode === 'ORDER_ONLY' && (
                            <div className="h-2 w-2 rounded-full bg-white" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-medium">발주 메일만</h4>
                          <p className="text-sm text-gray-500 mt-1">
                            발주와 관련된 메일만 수신하고 처리합니다.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 받은 메일 */}
                    <div
                      className={`relative rounded-lg border-2 p-4 transition-colors ${
                        mailOptions.permissions.canChangeMailMode
                          ? 'cursor-pointer hover:border-gray-300'
                          : 'cursor-not-allowed opacity-60'
                      } ${
                        mailOptions.mailMode === 'FULL_INBOX'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                      onClick={() => {
                        if (mailOptions.permissions.canChangeMailMode) {
                          setMailOptions({ ...mailOptions, mailMode: 'FULL_INBOX' })
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                          mailOptions.mailMode === 'FULL_INBOX'
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}>
                          {mailOptions.mailMode === 'FULL_INBOX' && (
                            <div className="h-2 w-2 rounded-full bg-white" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-medium flex items-center gap-2">
                            받은 메일
                            {!mailOptions.permissions.canChangeMailMode && (
                              <Lock className="h-4 w-4 text-gray-400" />
                            )}
                          </h4>
                          <p className="text-sm text-gray-500 mt-1">
                            받은 메일함 수신 메일을 확인할 수 있습니다.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* 메일 발신 기능 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      메일 발신 기능
                      {!mailOptions.permissions.canEnableMailSending && (
                        <Lock className="h-4 w-4 text-gray-400" />
                      )}
                    </Label>
                    <p className="text-sm text-gray-500">
                      메일을 직접 작성하여 발송할 수 있습니다.
                      {!mailOptions.permissions.canEnableMailSending && (
                        <span className="block text-amber-600 dark:text-amber-400">
                          프로페셔널 플랜 이상에서 사용 가능
                        </span>
                      )}
                    </p>
                  </div>
                  <Switch
                    checked={mailOptions.mailSendingEnabled}
                    disabled={!mailOptions.permissions.canEnableMailSending}
                    onCheckedChange={(checked) =>
                      setMailOptions({ ...mailOptions, mailSendingEnabled: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button
                    onClick={saveMailOptions}
                    disabled={savingMailOptions}
                    variant="outline"
                  >
                    {savingMailOptions ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    메일 옵션 저장
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="keyword">
            <Card>
              <CardHeader>
                <CardTitle>발주 키워드 설정</CardTitle>
                <CardDescription>
                  발주 메일 판단에 사용할 키워드를 설정합니다.
                  등록된 업체 이메일에서 온 메일 중 키워드가 포함된 메일만 발주로 처리됩니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 키워드 사용 안함 토글 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>키워드 사용 안함</Label>
                    <p className="text-sm text-gray-500">
                      활성화 시 등록된 업체 이메일에서 온 모든 메일을 발주로 처리합니다
                    </p>
                  </div>
                  <Switch
                    checked={keywordSettings.keywordsDisabled}
                    onCheckedChange={(checked) =>
                      setKeywordSettings({
                        ...keywordSettings,
                        keywordsDisabled: checked,
                      })
                    }
                  />
                </div>

                <Separator />

                {/* 키워드 목록 */}
                <div className={keywordSettings.keywordsDisabled ? 'opacity-50 pointer-events-none' : ''}>
                  <div className="space-y-4">
                    <Label>등록된 키워드</Label>
                    <div className="flex flex-wrap gap-2">
                      {keywordSettings.keywords.map((keyword) => (
                        <Badge
                          key={keyword}
                          variant="secondary"
                          className="px-3 py-1 text-sm flex items-center gap-1"
                        >
                          {keyword}
                          <button
                            type="button"
                            onClick={() => removeKeyword(keyword)}
                            className="ml-1 hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      {keywordSettings.keywords.length === 0 && (
                        <p className="text-sm text-gray-500">등록된 키워드가 없습니다</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Input
                      placeholder="새 키워드 입력"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addKeyword()
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addKeyword}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      추가
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button
                    onClick={saveKeywordSettings}
                    disabled={savingKeywords}
                    variant="outline"
                  >
                    {savingKeywords ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    키워드 설정 저장
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notification">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>알림 설정</CardTitle>
                    <CardDescription>
                      알림 발송 관련 기본 설정을 관리합니다
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/notifications/test">
                      <Link2 className="w-4 h-4 mr-2" />
                      SMS 테스트
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>새 발주 알림</Label>
                      <p className="text-sm text-gray-500">
                        새로운 발주 메일 수신 시 담당자에게 알림을 발송합니다
                      </p>
                    </div>
                    <Switch
                      checked={settings.notification.notifyOnNewOrder}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          notification: { ...settings.notification, notifyOnNewOrder: checked },
                        })
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>오류 알림</Label>
                      <p className="text-sm text-gray-500">
                        시스템 오류 발생 시 관리자에게 알림을 발송합니다
                      </p>
                    </div>
                    <Switch
                      checked={settings.notification.notifyOnError}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          notification: { ...settings.notification, notifyOnError: checked },
                        })
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>기본 SMS 발송</Label>
                      <p className="text-sm text-gray-500">
                        새 담당자 등록 시 기본적으로 SMS 수신을 활성화합니다
                      </p>
                    </div>
                    <Switch
                      checked={settings.notification.defaultSMSEnabled}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          notification: { ...settings.notification, defaultSMSEnabled: checked },
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>기본 카카오톡 발송</Label>
                      <p className="text-sm text-gray-500">
                        새 담당자 등록 시 기본적으로 카카오톡 수신을 활성화합니다
                      </p>
                    </div>
                    <Switch
                      checked={settings.notification.defaultKakaoEnabled}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          notification: { ...settings.notification, defaultKakaoEnabled: checked },
                        })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 발송 실패 재시도 설정 */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  발송 실패 재시도
                </CardTitle>
                <CardDescription>
                  알림 발송 실패 시 자동 재시도 설정을 관리합니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 안내 문구 */}
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>💡 안내:</strong> 재시도 기능은 활성화한 시점 이후 발생하는 알림 실패에만 적용됩니다.
                    이전에 실패한 알림은 재시도되지 않습니다.
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>자동 재시도 활성화</Label>
                    <p className="text-sm text-gray-500">
                      알림 발송 실패 시 설정된 시간 후에 자동으로 재시도합니다
                    </p>
                  </div>
                  <Switch
                    checked={settings.notification.retryEnabled}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        notification: { ...settings.notification, retryEnabled: checked },
                      })
                    }
                  />
                </div>

                {settings.notification.retryEnabled && (
                  <>
                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="retry-interval">재시도 간격 (분)</Label>
                        <Input
                          id="retry-interval"
                          type="number"
                          min="5"
                          max="30"
                          value={settings.notification.retryInterval}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              notification: {
                                ...settings.notification,
                                retryInterval: Math.min(30, Math.max(5, parseInt(e.target.value) || 10)),
                              },
                            })
                          }
                        />
                        <p className="text-xs text-gray-500">5~30분 사이로 설정</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="max-retries">최대 재시도 횟수</Label>
                        <Input
                          id="max-retries"
                          type="number"
                          min="1"
                          max="3"
                          value={settings.notification.maxRetries}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              notification: {
                                ...settings.notification,
                                maxRetries: Math.min(3, Math.max(1, parseInt(e.target.value) || 2)),
                              },
                            })
                          }
                        />
                        <p className="text-xs text-gray-500">1~3회 사이로 설정</p>
                      </div>
                    </div>

                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
                      <p className="text-blue-800 dark:text-blue-200">
                        <strong>설정 요약:</strong> 발송 실패 시{' '}
                        <strong>{settings.notification.retryInterval}분</strong> 후에 재시도하며,{' '}
                        최대 <strong>{settings.notification.maxRetries}회</strong>까지 재시도합니다.
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="business">
            <Card>
              <CardHeader>
                <CardTitle>사업자 정보</CardTitle>
                <CardDescription>
                  서비스 운영 사업자 정보를 입력합니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">회사명</Label>
                  <Input
                    id="company-name"
                    value={settings.business.companyName}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        business: { ...settings.business, companyName: e.target.value },
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="business-number">사업자등록번호</Label>
                  <Input
                    id="business-number"
                    placeholder="000-00-00000"
                    value={settings.business.businessNumber}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        business: { ...settings.business, businessNumber: e.target.value },
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">주소</Label>
                  <Input
                    id="address"
                    value={settings.business.address}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        business: { ...settings.business, address: e.target.value },
                      })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact-email">대표 이메일</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      value={settings.business.contactEmail}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          business: { ...settings.business, contactEmail: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-phone">대표 전화번호</Label>
                    <Input
                      id="contact-phone"
                      type="tel"
                      placeholder="02-0000-0000"
                      value={settings.business.contactPhone}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          business: { ...settings.business, contactPhone: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="template">
            {/* 사용 가이드 섹션 */}
            <Card className="mb-6">
              <Collapsible open={showGuide} onOpenChange={setShowGuide}>
                <CardHeader className="pb-3">
                  <CollapsibleTrigger className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-blue-500" />
                      <CardTitle className="text-lg">템플릿 사용 가이드</CardTitle>
                    </div>
                    {showGuide ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          변수 사용법
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          템플릿에서 {'{{'}<span className="text-blue-600 font-mono">변수명</span>{'}}'}  형식으로 변수를 사용하면 발송 시 실제 값으로 치환됩니다.
                        </p>
                        <div className="flex flex-wrap gap-2 text-sm">
                          <code className="px-2 py-1 bg-white dark:bg-gray-800 rounded border text-xs">{'{{companyName}}'}</code>
                          <code className="px-2 py-1 bg-white dark:bg-gray-800 rounded border text-xs">{'{{deliveryDate}}'}</code>
                          <code className="px-2 py-1 bg-white dark:bg-gray-800 rounded border text-xs">{'{{shortDate}}'}</code>
                          <code className="px-2 py-1 bg-white dark:bg-gray-800 rounded border text-xs">{'{{deliveryTime}}'}</code>
                          <code className="px-2 py-1 bg-white dark:bg-gray-800 rounded border text-xs">{'{{contactNumber}}'}</code>
                          <code className="px-2 py-1 bg-white dark:bg-gray-800 rounded border text-xs">{'{{message}}'}</code>
                        </div>
                      </div>
                      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          SMS 작성 시 주의사항
                        </h4>
                        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          <li>• SMS는 <strong>90자(한글 기준)</strong> 이내로 작성</li>
                          <li>• 90자 초과 시 LMS로 발송되어 추가 요금 발생</li>
                          <li>• 변수가 치환된 후의 최종 길이 고려 필요</li>
                          <li>• 미리보기로 실제 발송될 내용 확인 권장</li>
                        </ul>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <h4 className="font-medium mb-2">템플릿 편집 방법</h4>
                      <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
                        <li><strong>기본 템플릿 사용:</strong> 아래 기본 템플릿 중 필요한 것을 선택하여 &quot;복원&quot; 버튼으로 등록</li>
                        <li><strong>템플릿 수정:</strong> 등록된 템플릿의 <Edit3 className="inline w-4 h-4" /> 버튼을 클릭하여 내용 편집</li>
                        <li><strong>새 템플릿 생성:</strong> &quot;새 템플릿 만들기&quot; 버튼으로 사용자 정의 템플릿 생성</li>
                        <li><strong>미리보기:</strong> <Eye className="inline w-4 h-4" /> 버튼으로 샘플 데이터 적용 결과 확인</li>
                      </ol>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            {/* 기본 템플릿 섹션 */}
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  <CardTitle>기본 템플릿</CardTitle>
                </div>
                <CardDescription>
                  자주 사용되는 알림 템플릿입니다. 복원하여 바로 사용하거나 복사하여 수정할 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {defaultTemplates.map((dt) => {
                    const isRegistered = isDefaultTemplateRegistered(dt.name)
                    return (
                      <div
                        key={dt.name}
                        className={`border rounded-lg p-4 ${isRegistered ? 'border-green-300 bg-green-50/50 dark:bg-green-900/10' : 'border-gray-200 dark:border-gray-700'}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeBadgeColor(dt.type)}`}>
                              {getTypeLabel(dt.type)}
                            </span>
                            <h4 className="font-medium text-sm">{dt.name}</h4>
                            {isRegistered && (
                              <Badge variant="outline" className="text-xs text-green-600 border-green-400">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                등록됨
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{dt.description}</p>
                        <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 p-2 rounded font-mono max-h-24 overflow-y-auto">
                          {dt.content}
                        </div>
                        <div className="mt-3 flex gap-2">
                          {!isRegistered && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => restoreDefaultTemplate(dt)}
                              disabled={creatingTemplate}
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              복원
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyFromDefault(dt)}
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            복사하여 새로 만들기
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 내 템플릿 섹션 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      내 템플릿
                    </CardTitle>
                    <CardDescription>
                      등록된 템플릿을 관리합니다. 편집하거나 새 템플릿을 만들 수 있습니다.
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadTemplates}
                      disabled={loadingTemplates}
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${loadingTemplates ? 'animate-spin' : ''}`} />
                      새로고침
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowNewTemplateDialog(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      새 템플릿 만들기
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingTemplates ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-500">템플릿 로딩 중...</span>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>등록된 템플릿이 없습니다</p>
                    <p className="text-sm mt-1">위의 기본 템플릿을 복원하거나 새 템플릿을 만들어보세요</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {templates.map((template) => {
                      const isActive = isActiveTemplate(template)
                      const activeLabel = template.type === 'SMS' ? 'SMS 발주 알림' :
                                         template.type === 'KAKAO_ALIMTALK' ? '카카오 발주 알림' : null
                      const canSwitchTo = !isActive && (template.type === 'SMS' || template.type === 'KAKAO_ALIMTALK')

                      return (
                        <div
                          key={template.id}
                          className={`border rounded-lg p-4 transition-colors ${
                            isActive
                              ? 'border-green-400 bg-green-50/50 dark:bg-green-900/10'
                              : 'hover:border-blue-300'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeBadgeColor(template.type)}`}>
                                {getTypeLabel(template.type)}
                              </span>
                              <h4 className="font-medium">{template.name}</h4>
                              {template.isDefault && (
                                <Badge variant="secondary" className="text-xs">기본</Badge>
                              )}
                              {!template.isActive && (
                                <Badge variant="outline" className="text-xs text-gray-500">비활성</Badge>
                              )}
                              {isActive && (
                                <Badge className="text-xs bg-green-500 hover:bg-green-600">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  {activeLabel} 사용 중
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePreview(template)}
                                title="미리보기"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingTemplate({ ...template })}
                                title="편집"
                              >
                                <Edit3 className="w-4 h-4" />
                              </Button>
                              {!template.isDefault && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteTemplate(template.id)}
                                  disabled={deletingTemplateId === template.id}
                                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                  title="삭제"
                                >
                                  {deletingTemplateId === template.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* 사용 중 설명 또는 전환 버튼 */}
                          {isActive && (
                            <div className="mb-2 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded text-xs text-green-700 dark:text-green-300">
                              📌 이 템플릿이 {activeLabel}에 사용됩니다. 내용을 편집하면 실제 발송에 반영됩니다.
                            </div>
                          )}

                          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap line-clamp-2">
                            {template.content}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {template.variables.map((v) => (
                              <span
                                key={v}
                                className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400"
                              >
                                {v}
                              </span>
                            ))}
                          </div>

                          {/* 이 템플릿으로 사용하기 버튼 */}
                          {canSwitchTo && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => switchToTemplate(template)}
                                disabled={switchingToTemplateId === template.id}
                                className="w-full sm:w-auto"
                              >
                                {switchingToTemplateId === template.id ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                )}
                                이 템플릿을 {template.type === 'SMS' ? 'SMS' : '카카오'} 발송에 사용하기
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 템플릿 편집 다이얼로그 */}
            <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>템플릿 편집</DialogTitle>
                  <DialogDescription>
                    {editingTemplate?.name} ({getTypeLabel(editingTemplate?.type || '')})
                  </DialogDescription>
                </DialogHeader>
                {editingTemplate && (
                  <div className="space-y-4">
                    {editingTemplate.type === 'EMAIL' && (
                      <div className="space-y-2">
                        <Label>제목</Label>
                        <Input
                          value={editingTemplate.subject || ''}
                          onChange={(e) =>
                            setEditingTemplate({ ...editingTemplate, subject: e.target.value })
                          }
                          placeholder="이메일 제목"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>내용</Label>
                      <Textarea
                        value={editingTemplate.content}
                        onChange={(e) =>
                          setEditingTemplate({ ...editingTemplate, content: e.target.value })
                        }
                        className="min-h-[200px] font-mono text-sm"
                        placeholder="템플릿 내용을 입력하세요"
                      />
                      <p className="text-xs text-gray-500">
                        SMS는 90자(한글 기준) 이내로 작성하세요. 현재: {editingTemplate.content.length}자
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={editingTemplate.isActive}
                          onCheckedChange={(checked) =>
                            setEditingTemplate({ ...editingTemplate, isActive: checked })
                          }
                        />
                        <Label>활성화</Label>
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <h5 className="text-sm font-medium mb-2">사용 변수</h5>
                      <div className="flex flex-wrap gap-1">
                        {editingTemplate.variables.map((v) => (
                          <code
                            key={v}
                            className="text-xs px-2 py-1 bg-white dark:bg-gray-700 rounded border cursor-pointer hover:bg-blue-50"
                            onClick={() => {
                              const textarea = document.querySelector('textarea')
                              if (textarea) {
                                const pos = textarea.selectionStart
                                const before = editingTemplate.content.substring(0, pos)
                                const after = editingTemplate.content.substring(pos)
                                setEditingTemplate({
                                  ...editingTemplate,
                                  content: `${before}{{${v}}}${after}`,
                                })
                              }
                            }}
                          >
                            {`{{${v}}}`}
                          </code>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setEditingTemplate(null)}
                  >
                    취소
                  </Button>
                  <Button
                    onClick={saveTemplate}
                    disabled={savingTemplate}
                  >
                    {savingTemplate ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    저장
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* 미리보기 다이얼로그 */}
            <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>템플릿 미리보기</DialogTitle>
                  <DialogDescription>
                    {previewTemplate?.name} - 샘플 데이터로 렌더링된 결과
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-sm text-gray-500 mb-2">적용된 변수:</div>
                    <div className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
                      <div>companyName → 대한상사</div>
                      <div>deliveryDate → 2025년 1월 20일</div>
                      <div>shortDate → 1/20</div>
                      <div>deliveryTime → 오전</div>
                    </div>
                  </div>
                  <Separator />
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium mb-2">렌더링 결과:</div>
                    <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                      {previewContent}
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => setPreviewTemplate(null)}>
                    닫기
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* 새 템플릿 생성 다이얼로그 */}
            <Dialog open={showNewTemplateDialog} onOpenChange={setShowNewTemplateDialog}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>새 템플릿 만들기</DialogTitle>
                  <DialogDescription>
                    새로운 메시지 템플릿을 생성합니다. 변수는 {'{{'}변수명{'}}'}  형식으로 입력하세요.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>템플릿 이름</Label>
                      <Input
                        value={newTemplate.name}
                        onChange={(e) =>
                          setNewTemplate({ ...newTemplate, name: e.target.value })
                        }
                        placeholder="MY_CUSTOM_TEMPLATE"
                      />
                      <p className="text-xs text-gray-500">영문 대문자, 숫자, 언더스코어(_) 사용 권장</p>
                    </div>
                    <div className="space-y-2">
                      <Label>메시지 유형</Label>
                      <Select
                        value={newTemplate.type}
                        onValueChange={(value: 'SMS' | 'KAKAO_ALIMTALK' | 'EMAIL') =>
                          setNewTemplate({ ...newTemplate, type: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SMS">SMS</SelectItem>
                          <SelectItem value="KAKAO_ALIMTALK">카카오 알림톡</SelectItem>
                          <SelectItem value="EMAIL">이메일</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {(newTemplate.type === 'KAKAO_ALIMTALK' || newTemplate.type === 'EMAIL') && (
                    <div className="space-y-2">
                      <Label>제목</Label>
                      <Input
                        value={newTemplate.subject}
                        onChange={(e) =>
                          setNewTemplate({ ...newTemplate, subject: e.target.value })
                        }
                        placeholder="메시지 제목"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>내용</Label>
                    <Textarea
                      value={newTemplate.content}
                      onChange={(e) =>
                        setNewTemplate({ ...newTemplate, content: e.target.value })
                      }
                      className="min-h-[150px] font-mono text-sm"
                      placeholder="템플릿 내용을 입력하세요. 변수는 {{변수명}} 형식으로 입력합니다."
                    />
                    <p className="text-xs text-gray-500">
                      {newTemplate.type === 'SMS' && 'SMS는 90자(한글 기준) 이내로 작성하세요. '}
                      현재: {newTemplate.content.length}자
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h5 className="text-sm font-medium mb-2">사용 가능한 변수 (클릭하여 삽입)</h5>
                    <div className="flex flex-wrap gap-1">
                      {['companyName', 'deliveryDate', 'shortDate', 'deliveryTime', 'contactNumber', 'message'].map((v) => (
                        <code
                          key={v}
                          className="text-xs px-2 py-1 bg-white dark:bg-gray-700 rounded border cursor-pointer hover:bg-blue-100"
                          onClick={() => {
                            setNewTemplate({
                              ...newTemplate,
                              content: newTemplate.content + `{{${v}}}`,
                            })
                          }}
                        >
                          {`{{${v}}}`}
                        </code>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowNewTemplateDialog(false)
                      setNewTemplate({ name: '', type: 'SMS', content: '', subject: '' })
                    }}
                  >
                    취소
                  </Button>
                  <Button
                    onClick={createNewTemplate}
                    disabled={creatingTemplate || !newTemplate.name || !newTemplate.content}
                  >
                    {creatingTemplate ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    생성
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>

        {/* 저장 버튼 - 페이지 하단 */}
        <div className="mt-8 flex justify-end">
          <Button
            onClick={saveSettings}
            disabled={loading}
            size="lg"
            className="flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            설정 저장
          </Button>
        </div>
      </div>
    </div>
  )
}