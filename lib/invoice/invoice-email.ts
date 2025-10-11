import nodemailer from 'nodemailer'
import { generateInvoicePDF, InvoiceData } from './invoice-generator'
import { logger } from '@/lib/utils/logger'

// 이메일 설정
interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

// 인보이스 이메일 전송
export async function sendInvoiceEmail(
  invoice: InvoiceData,
  recipientEmail: string,
  emailConfig?: EmailConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    // 기본 이메일 설정 (환경변수에서 가져오기)
    const config: EmailConfig = emailConfig || {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || process.env.MAIL_USER || '',
        pass: process.env.SMTP_PASS || process.env.MAIL_PASSWORD || '',
      },
    }

    // nodemailer 트랜스포터 생성
    const transporter = nodemailer.createTransporter({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    })

    // PDF 생성
    const pdfBlob = await generateInvoicePDF(invoice)
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

    // 이메일 제목 및 내용
    const subject = `[Echo Mail] 인보이스 #${invoice.invoiceNumber} - ${invoice.customer.name}`
    const htmlContent = generateInvoiceEmailHTML(invoice)

    // 이메일 발송 옵션
    const mailOptions = {
      from: {
        name: 'Echo Mail 빌링팀',
        address: config.auth.user,
      },
      to: recipientEmail,
      subject,
      html: htmlContent,
      attachments: [
        {
          filename: `invoice-${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    }

    // 이메일 전송
    const result = await transporter.sendMail(mailOptions)

    logger.info('Invoice email sent successfully', {
      invoiceNumber: invoice.invoiceNumber,
      recipient: recipientEmail,
      messageId: result.messageId,
    })

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    logger.error('Failed to send invoice email', {
      invoiceNumber: invoice.invoiceNumber,
      recipient: recipientEmail,
      error: errorMessage,
    })

    return { success: false, error: errorMessage }
  }
}

// 인보이스 이메일 HTML 템플릿
function generateInvoiceEmailHTML(invoice: InvoiceData): string {
  const statusText = invoice.status === 'PAID' ? '결제완료' :
                    invoice.status === 'PENDING' ? '결제대기' : '연체'

  const statusColor = invoice.status === 'PAID' ? '#10B981' :
                     invoice.status === 'PENDING' ? '#F59E0B' : '#EF4444'

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Echo Mail 인보이스</title>
      <style>
        body { font-family: 'Apple SD Gothic Neo', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
        .content { padding: 30px; background: #ffffff; }
        .invoice-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .status-badge { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; color: white; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #e9ecef; }
        .table th { background: #f8f9fa; font-weight: 600; }
        .total { background: #667eea; color: white; font-weight: bold; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #6c757d; }
        .btn { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Echo Mail</div>
          <div>발주 확인 자동 알림 서비스</div>
        </div>

        <div class="content">
          <h2>인보이스가 발행되었습니다</h2>
          <p>안녕하세요, ${invoice.customer.name} 고객님!</p>
          <p>Echo Mail 서비스 이용에 대한 인보이스를 발송드립니다.</p>

          <div class="invoice-info">
            <h3>인보이스 정보</h3>
            <p><strong>인보이스 번호:</strong> #${invoice.invoiceNumber}</p>
            <p><strong>발행일:</strong> ${invoice.issueDate}</p>
            <p><strong>만료일:</strong> ${invoice.dueDate}</p>
            <p><strong>상태:</strong> <span class="status-badge" style="background-color: ${statusColor}">${statusText}</span></p>
          </div>

          <table class="table">
            <thead>
              <tr>
                <th>서비스</th>
                <th>이용기간</th>
                <th>금액</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.period}</td>
                  <td>₩${item.amount.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="text-align: right;"><strong>소계:</strong></td>
                <td><strong>₩${invoice.subtotal.toLocaleString()}</strong></td>
              </tr>
              <tr>
                <td colspan="2" style="text-align: right;"><strong>부가세(${invoice.vatRate}%):</strong></td>
                <td><strong>₩${invoice.vatAmount.toLocaleString()}</strong></td>
              </tr>
              <tr class="total">
                <td colspan="2" style="text-align: right;"><strong>총 금액:</strong></td>
                <td><strong>₩${invoice.total.toLocaleString()}</strong></td>
              </tr>
            </tfoot>
          </table>

          ${invoice.status === 'PENDING' ? `
            <div style="text-align: center; margin: 30px 0;">
              <p><strong>결제가 필요합니다</strong></p>
              <p>만료일까지 결제를 완료해주시기 바랍니다.</p>
              <a href="#" class="btn">결제하기</a>
            </div>
          ` : ''}

          <p>첨부된 PDF 파일에서 상세한 인보이스를 확인하실 수 있습니다.</p>

          <p>
            문의사항이 있으시면 언제든지 연락주세요.<br>
            이메일: billing@echomail.co.kr<br>
            전화: 02-1234-5678
          </p>

          <p>
            감사합니다.<br>
            <strong>Echo Mail 팀</strong>
          </p>
        </div>

        <div class="footer">
          <p>이 이메일은 Echo Mail 빌링 시스템에서 자동으로 발송되었습니다.</p>
          <p>Echo Mail Co., Ltd. | 서울특별시 강남구 테헤란로 123, 12층</p>
        </div>
      </div>
    </body>
    </html>
  `
}

// 인보이스 리마인더 이메일 발송
export async function sendInvoiceReminder(
  invoice: InvoiceData,
  recipientEmail: string,
  daysOverdue: number = 0
): Promise<{ success: boolean; error?: string }> {
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

    const transporter = nodemailer.createTransporter(config)

    const subject = daysOverdue > 0
      ? `[Echo Mail] 연체 알림 - 인보이스 #${invoice.invoiceNumber}`
      : `[Echo Mail] 결제 리마인더 - 인보이스 #${invoice.invoiceNumber}`

    const htmlContent = generateReminderEmailHTML(invoice, daysOverdue)

    const mailOptions = {
      from: {
        name: 'Echo Mail 빌링팀',
        address: config.auth.user,
      },
      to: recipientEmail,
      subject,
      html: htmlContent,
    }

    const result = await transporter.sendMail(mailOptions)

    logger.info('Invoice reminder sent successfully', {
      invoiceNumber: invoice.invoiceNumber,
      recipient: recipientEmail,
      daysOverdue,
      messageId: result.messageId,
    })

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    logger.error('Failed to send invoice reminder', {
      invoiceNumber: invoice.invoiceNumber,
      recipient: recipientEmail,
      error: errorMessage,
    })

    return { success: false, error: errorMessage }
  }
}

// 리마인더 이메일 HTML 템플릿
function generateReminderEmailHTML(invoice: InvoiceData, daysOverdue: number): string {
  const isOverdue = daysOverdue > 0
  const urgencyColor = isOverdue ? '#EF4444' : '#F59E0B'
  const urgencyText = isOverdue ? '연체' : '결제 예정'

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Echo Mail 결제 ${urgencyText} 알림</title>
      <style>
        body { font-family: 'Apple SD Gothic Neo', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .urgent { background: ${urgencyColor}; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; }
        .btn { background: ${urgencyColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="urgent">
          <h2>${isOverdue ? '⚠️ 결제 연체 알림' : '⏰ 결제 리마인더'}</h2>
          <p>인보이스 #${invoice.invoiceNumber}</p>
        </div>

        <div class="content">
          <p>안녕하세요, ${invoice.customer.name} 고객님!</p>

          ${isOverdue ? `
            <p><strong>인보이스가 ${daysOverdue}일 연체되었습니다.</strong></p>
            <p>서비스 중단을 방지하기 위해 즉시 결제를 완료해주시기 바랍니다.</p>
          ` : `
            <p>결제 기한이 다가왔습니다.</p>
            <p>만료일: ${invoice.dueDate}</p>
          `}

          <p><strong>결제 금액:</strong> ₩${invoice.total.toLocaleString()}</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="#" class="btn">즉시 결제하기</a>
          </div>

          <p>문의사항: billing@echomail.co.kr | 02-1234-5678</p>
        </div>
      </div>
    </body>
    </html>
  `
}