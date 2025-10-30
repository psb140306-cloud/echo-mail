'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  ArrowLeft,
  MoreHorizontal,
  Trash2,
  Mail,
  Shield,
  User,
  Crown,
  Settings,
  Eye,
  UserPlus,
  Activity,
  Loader2,
  Users,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { AppHeader } from '@/components/layout/app-header'

interface TeamMember {
  id: string
  email: string
  name?: string
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER'
  status: 'ACTIVE' | 'INVITED' | 'INACTIVE'
  invitedAt?: string
  joinedAt?: string
  lastActive?: string
}

interface TeamInvitation {
  id: string
  email: string
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER'
  status: 'PENDING' | 'EXPIRED' | 'ACCEPTED' | 'DECLINED'
  invitedBy: string
  createdAt: string
  expiresAt: string
}

interface ActivityLog {
  id: string
  userId: string
  userName: string
  action: string
  description: string
  createdAt: string
}

export default function TeamPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<TeamInvitation[]>([])
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // 초대 폼 상태
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'VIEWER' as const,
  })

  // 데이터 로딩
  useEffect(() => {
    loadTeamData()
  }, [])

  const loadTeamData = async () => {
    try {
      setLoading(true)

      const [membersRes, invitationsRes, activitiesRes] = await Promise.all([
        fetch('/api/team/members'),
        fetch('/api/team/invitations'),
        fetch('/api/team/activities?limit=10'),
      ])

      if (membersRes.ok) {
        const data = await membersRes.json()
        setTeamMembers(data.data || [])
      }

      if (invitationsRes.ok) {
        const data = await invitationsRes.json()
        setInvitations(data.data || [])
      }

      if (activitiesRes.ok) {
        const data = await activitiesRes.json()
        setActivities(data.data || [])
      }
    } catch (error) {
      console.error('Failed to load team data:', error)
      toast({
        title: '오류',
        description: '팀 정보를 불러오는데 실패했습니다.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // 사용자 초대
  const inviteUser = async () => {
    try {
      setActionLoading('invite')

      const response = await fetch('/api/team/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inviteForm),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '✅ 성공',
          description: '초대 이메일이 발송되었습니다.',
        })

        setShowInviteDialog(false)
        setInviteForm({ email: '', role: 'VIEWER' })
        loadTeamData()
      } else {
        toast({
          title: '❌ 오류',
          description: data.error || '초대 발송에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '❌ 오류',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(null)
    }
  }

  // 사용자 역할 변경
  const changeUserRole = async (userId: string, newRole: string) => {
    try {
      setActionLoading(`role-${userId}`)

      const response = await fetch(`/api/team/members/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '✅ 성공',
          description: '사용자 역할이 변경되었습니다.',
        })
        loadTeamData()
      } else {
        toast({
          title: '❌ 오류',
          description: data.error || '역할 변경에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '❌ 오류',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(null)
    }
  }

  // 사용자 제거
  const removeUser = async (userId: string) => {
    try {
      setActionLoading(`remove-${userId}`)

      const response = await fetch(`/api/team/members/${userId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '✅ 성공',
          description: '사용자가 팀에서 제거되었습니다.',
        })
        loadTeamData()
      } else {
        toast({
          title: '❌ 오류',
          description: data.error || '사용자 제거에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '❌ 오류',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(null)
    }
  }

  // 초대 취소
  const cancelInvitation = async (invitationId: string) => {
    try {
      setActionLoading(`cancel-${invitationId}`)

      const response = await fetch(`/api/team/invitations/${invitationId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '✅ 성공',
          description: '초대가 취소되었습니다.',
        })
        loadTeamData()
      } else {
        toast({
          title: '❌ 오류',
          description: data.error || '초대 취소에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '❌ 오류',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      OWNER: { label: '소유자', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: Crown },
      ADMIN: { label: '관리자', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: Shield },
      MANAGER: { label: '매니저', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Settings },
      OPERATOR: { label: '운영자', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: User },
      VIEWER: { label: '뷰어', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400', icon: Eye },
    }

    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.VIEWER
    const Icon = config.icon

    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    )
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      ACTIVE: { label: '활성', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
      INVITED: { label: '초대됨', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Mail },
      INACTIVE: { label: '비활성', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400', icon: XCircle },
    }

    const config = statusConfig[status as keyof typeof statusConfig]
    if (!config) return <Badge variant="secondary">{status}</Badge>

    const Icon = config.icon

    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm text-muted-foreground">팀 정보를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <AppHeader />

      {/* Sub Header */}
      <div className="border-b border-border bg-white dark:bg-card">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard"
              className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>대시보드</span>
            </Link>
            <div>
              <h1 className="text-lg font-semibold dark:text-foreground">팀 관리</h1>
              <p className="text-xs text-muted-foreground">팀 멤버와 권한을 관리하세요</p>
            </div>
          </div>
          <Button
            onClick={() => setShowInviteDialog(true)}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            사용자 초대
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <main className="container py-8">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card className="border-none shadow-lg bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">팀 멤버</CardTitle>
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{teamMembers.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                활성: {teamMembers.filter((m) => m.status === 'ACTIVE').length}명
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/50 dark:to-purple-900/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">대기중 초대</CardTitle>
              <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
                <Mail className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">
                {invitations.filter((i) => i.status === 'PENDING').length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">총 {invitations.length}개 초대</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/50 dark:to-green-900/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">최근 활동</CardTitle>
              <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
                <Activity className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{activities.length}</div>
              <p className="text-xs text-muted-foreground mt-1">오늘</p>
            </CardContent>
          </Card>
        </div>

        {/* Team Members */}
        <Card className="mb-8 border-none shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              팀 멤버
            </CardTitle>
            <CardDescription>현재 팀에 소속된 사용자들을 관리하세요</CardDescription>
          </CardHeader>
          <CardContent>
            {teamMembers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-muted-foreground">팀 멤버가 없습니다.</p>
                <Button
                  onClick={() => setShowInviteDialog(true)}
                  variant="outline"
                  className="mt-4"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  첫 멤버 초대하기
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 dark:bg-gray-900">
                      <TableHead>사용자</TableHead>
                      <TableHead>역할</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>가입일</TableHead>
                      <TableHead>최근 활동</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map((member) => (
                      <TableRow key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                              <span className="text-white font-semibold text-sm">
                                {(member.name || member.email).charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">{member.name || member.email}</p>
                              {member.name && (
                                <p className="text-sm text-muted-foreground">{member.email}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(member.role)}</TableCell>
                        <TableCell>{getStatusBadge(member.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {member.joinedAt
                              ? new Date(member.joinedAt).toLocaleDateString('ko-KR')
                              : '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Activity className="w-3 h-3" />
                            {member.lastActive
                              ? new Date(member.lastActive).toLocaleDateString('ko-KR')
                              : '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {member.role !== 'OWNER' && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>작업</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => changeUserRole(member.id, 'ADMIN')}
                                  disabled={actionLoading === `role-${member.id}`}
                                >
                                  <Shield className="mr-2 h-4 w-4" />
                                  관리자로 변경
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => changeUserRole(member.id, 'MANAGER')}
                                  disabled={actionLoading === `role-${member.id}`}
                                >
                                  <Settings className="mr-2 h-4 w-4" />
                                  매니저로 변경
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => changeUserRole(member.id, 'VIEWER')}
                                  disabled={actionLoading === `role-${member.id}`}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  뷰어로 변경
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem
                                      className="text-red-600"
                                      onSelect={(e) => e.preventDefault()}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      팀에서 제거
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>사용자 제거</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {member.name || member.email}님을 팀에서 제거하시겠습니까?
                                        <br />이 작업은 되돌릴 수 없습니다.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>취소</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => removeUser(member.id)}
                                        disabled={actionLoading === `remove-${member.id}`}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        {actionLoading === `remove-${member.id}` ? (
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="mr-2 h-4 w-4" />
                                        )}
                                        제거
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <Card className="mb-8 border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-purple-600" />
                대기중인 초대
              </CardTitle>
              <CardDescription>아직 수락되지 않은 초대들입니다</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 dark:bg-gray-900">
                      <TableHead>이메일</TableHead>
                      <TableHead>역할</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>초대일</TableHead>
                      <TableHead>만료일</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((invitation) => (
                      <TableRow key={invitation.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                        <TableCell className="font-medium">{invitation.email}</TableCell>
                        <TableCell>{getRoleBadge(invitation.role)}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              invitation.status === 'PENDING'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                : invitation.status === 'EXPIRED'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                  : invitation.status === 'ACCEPTED'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                            }
                          >
                            {invitation.status === 'PENDING'
                              ? '대기중'
                              : invitation.status === 'EXPIRED'
                                ? '만료됨'
                                : invitation.status === 'ACCEPTED'
                                  ? '수락됨'
                                  : '거절됨'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(invitation.createdAt).toLocaleDateString('ko-KR')}
                        </TableCell>
                        <TableCell>
                          {new Date(invitation.expiresAt).toLocaleDateString('ko-KR')}
                        </TableCell>
                        <TableCell>
                          {invitation.status === 'PENDING' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => cancelInvitation(invitation.id)}
                              disabled={actionLoading === `cancel-${invitation.id}`}
                              className="hover:text-red-600"
                            >
                              {actionLoading === `cancel-${invitation.id}`? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Activity Log */}
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-600" />
              활동 로그
            </CardTitle>
            <CardDescription>팀 멤버들의 최근 활동 내역입니다</CardDescription>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-muted-foreground">활동 내역이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 p-4 border rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Activity className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-semibold">{activity.userName}</span>{' '}
                        <span className="text-muted-foreground">{activity.description}</span>
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {new Date(activity.createdAt).toLocaleString('ko-KR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Invite User Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
              사용자 초대
            </DialogTitle>
            <DialogDescription>
              새로운 팀 멤버를 초대하세요. 초대 이메일이 발송됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">역할</Label>
              <Select
                value={inviteForm.role}
                onValueChange={(role) => setInviteForm({ ...inviteForm, role: role as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIEWER">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      <div>
                        <div className="font-medium">뷰어</div>
                        <div className="text-xs text-muted-foreground">보기만 가능</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="OPERATOR">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <div>
                        <div className="font-medium">운영자</div>
                        <div className="text-xs text-muted-foreground">기본 작업 수행</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="MANAGER">
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      <div>
                        <div className="font-medium">매니저</div>
                        <div className="text-xs text-muted-foreground">관리 기능 접근</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="ADMIN">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      <div>
                        <div className="font-medium">관리자</div>
                        <div className="text-xs text-muted-foreground">모든 기능 접근</div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowInviteDialog(false)
                setInviteForm({ email: '', role: 'VIEWER' })
              }}
            >
              취소
            </Button>
            <Button
              onClick={inviteUser}
              disabled={!inviteForm.email || actionLoading === 'invite'}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {actionLoading === 'invite' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              초대 발송
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
