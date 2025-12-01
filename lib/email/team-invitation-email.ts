import nodemailer from 'nodemailer'
import { logger } from '@/lib/utils/logger'

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

interface InvitationEmailParams {
  email: string
  inviteUrl: string
  role: string
  inviterName?: string
  tenantName?: string
}

const roleLabels: Record<string, string> = {
  ADMIN: '관리자',
  MANAGER: '매니저',
  OPERATOR: '운영자',
  VIEWER: '뷰어',
}

export async function sendTeamInvitationEmail(
  params: InvitationEmailParams
): Promise<{ success: boolean; error?: string }> {
  const { email, inviteUrl, role, inviterName, tenantName } = params

  try {
    const config: EmailConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || process.env.MAIL_USER || '',
        pass: process.env.SMTP_PASS || process.env.MAIL_PASSWORD || '',
      },
    }

    // SMTP 설정 확인
    if (!config.auth.user || !config.auth.pass) {
      logger.warn('SMTP credentials not configured, skipping email send', { email })
      return { success: true } // 이메일 설정 없어도 초대는 생성됨
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    })

    const roleLabel = roleLabels[role] || role
    const teamName = tenantName || 'Echo Mail'
    const inviter = inviterName || '팀 관리자'

    const subject = `[Echo Mail] ${teamName} 팀에 초대되었습니다`
    const htmlContent = generateInvitationEmailHTML({
      email,
      inviteUrl,
      roleLabel,
      teamName,
      inviter,
    })

    const mailOptions = {
      from: {
        name: 'Echo Mail',
        address: config.auth.user,
      },
      to: email,
      subject,
      html: htmlContent,
    }

    const result = await transporter.sendMail(mailOptions)

    logger.info('Team invitation email sent successfully', {
      email,
      role,
      messageId: result.messageId,
    })

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    logger.error('Failed to send team invitation email', {
      email,
      role,
      error: errorMessage,
    })

    return { success: false, error: errorMessage }
  }
}

interface EmailHTMLParams {
  email: string
  inviteUrl: string
  roleLabel: string
  teamName: string
  inviter: string
}

function generateInvitationEmailHTML(params: EmailHTMLParams): string {
  const { inviteUrl, roleLabel, teamName, inviter } = params

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Echo Mail 팀 초대</title>
      <style>
        body {
          font-family: 'Apple SD Gothic Neo', -apple-system, BlinkMacSystemFont, sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 0;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .card {
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .logo {
          font-size: 32px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .header-subtitle {
          font-size: 16px;
          opacity: 0.9;
        }
        .content {
          padding: 40px 30px;
        }
        .highlight-box {
          background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
          border: 1px solid #c4b5fd;
          border-radius: 12px;
          padding: 24px;
          margin: 24px 0;
          text-align: center;
        }
        .role-badge {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 8px 20px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          margin-top: 12px;
        }
        .btn {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white !important;
          padding: 16px 40px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          margin: 20px 0;
          transition: transform 0.2s;
        }
        .btn:hover {
          transform: translateY(-2px);
        }
        .info-text {
          color: #6b7280;
          font-size: 14px;
          margin-top: 16px;
        }
        .expire-notice {
          background: #fef3c7;
          border: 1px solid #fcd34d;
          border-radius: 8px;
          padding: 12px 16px;
          margin: 24px 0;
          font-size: 14px;
          color: #92400e;
        }
        .footer {
          background: #f9fafb;
          padding: 24px 30px;
          text-align: center;
          font-size: 13px;
          color: #6b7280;
          border-top: 1px solid #e5e7eb;
        }
        .footer a {
          color: #667eea;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <div class="logo">Echo Mail</div>
            <div class="header-subtitle">발주 확인 자동 알림 서비스</div>
          </div>

          <div class="content">
            <h2 style="margin: 0 0 16px 0; color: #1f2937;">팀에 초대되었습니다!</h2>

            <p style="color: #4b5563; margin-bottom: 24px;">
              안녕하세요!<br>
              <strong>${inviter}</strong>님이 <strong>${teamName}</strong> 팀에 초대했습니다.
            </p>

            <div class="highlight-box">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">부여된 역할</p>
              <span class="role-badge">${roleLabel}</span>
            </div>

            <div style="text-align: center;">
              <a href="${inviteUrl}" class="btn">초대 수락하기</a>
              <p class="info-text">
                버튼이 작동하지 않으면 아래 링크를 브라우저에 직접 입력해주세요:
              </p>
              <p style="font-size: 12px; color: #9ca3af; word-break: break-all;">
                ${inviteUrl}
              </p>
            </div>

            <div class="expire-notice">
              ⏰ 이 초대는 <strong>7일</strong> 후에 만료됩니다. 기간 내에 수락해주세요.
            </div>

            <p style="color: #6b7280; font-size: 14px;">
              이 초대를 요청하지 않으셨다면, 이 이메일을 무시하셔도 됩니다.
            </p>
          </div>

          <div class="footer">
            <p>이 이메일은 Echo Mail에서 자동으로 발송되었습니다.</p>
            <p>문의사항이 있으시면 <a href="mailto:support@echomail.co.kr">support@echomail.co.kr</a>로 연락주세요.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
}
