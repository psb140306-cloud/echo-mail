import Imap from 'imap'
import { simpleParser } from 'mailparser'
import { EventEmitter } from 'events'
import { EmailLog } from '@prisma/client'

export interface EmailConfig {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  tls?: boolean
  tlsOptions?: {
    rejectUnauthorized: boolean
  }
}

export interface EmailMessage {
  messageId: string
  subject: string
  from: string
  to: string
  date: Date
  text?: string
  html?: string
  attachments: Attachment[]
}

export interface Attachment {
  filename: string
  contentType: string
  size: number
  content?: Buffer
}

export class ImapClient extends EventEmitter {
  private imap: Imap
  private connected: boolean = false
  private reconnectTimer?: NodeJS.Timeout
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private reconnectDelay: number = 5000

  constructor(private config: EmailConfig) {
    super()
    this.imap = new Imap({
      user: config.user,
      password: config.password,
      host: config.host,
      port: config.port,
      tls: config.secure || config.tls,
      tlsOptions: config.tlsOptions || {
        rejectUnauthorized: false
      },
      keepalive: {
        interval: 10000,
        idleInterval: 30000,
        forceNoop: true
      }
    })

    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    this.imap.once('ready', () => {
      console.log('📧 IMAP connection ready')
      this.connected = true
      this.reconnectAttempts = 0
      this.emit('connected')
      this.openInbox()
    })

    this.imap.once('error', (err: Error) => {
      console.error('❌ IMAP error:', err)
      this.emit('error', err)
      this.handleReconnect()
    })

    this.imap.once('end', () => {
      console.log('📧 IMAP connection ended')
      this.connected = false
      this.emit('disconnected')
      this.handleReconnect()
    })

    this.imap.once('close', (hadError: boolean) => {
      console.log('📧 IMAP connection closed', hadError ? 'with error' : 'normally')
      this.connected = false
      this.emit('closed', hadError)
      if (hadError) {
        this.handleReconnect()
      }
    })
  }

  private handleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Maximum reconnection attempts reached')
      this.emit('max-reconnect-reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * this.reconnectAttempts
    console.log(`⏳ Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    this.reconnectTimer = setTimeout(() => {
      this.connect()
    }, delay)
  }

  public connect(): void {
    if (this.connected) {
      console.log('📧 Already connected to IMAP server')
      return
    }

    console.log('📧 Connecting to IMAP server...')
    this.imap.connect()
  }

  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }

    if (this.connected) {
      console.log('📧 Disconnecting from IMAP server...')
      this.imap.end()
    }
  }

  private openInbox(): void {
    this.imap.openBox('INBOX', false, (err, box) => {
      if (err) {
        console.error('❌ Error opening inbox:', err)
        this.emit('error', err)
        return
      }

      console.log(`📧 Inbox opened: ${box.messages.total} total messages`)
      this.emit('inbox-opened', box)
      this.startListening()
    })
  }

  private startListening(): void {
    this.imap.on('mail', (numNewMail: number) => {
      console.log(`📧 New mail arrived: ${numNewMail} message(s)`)
      this.fetchNewMessages()
    })
  }

  private fetchNewMessages(): void {
    const searchCriteria = ['UNSEEN']

    this.imap.search(searchCriteria, (err, results) => {
      if (err) {
        console.error('❌ Error searching messages:', err)
        this.emit('error', err)
        return
      }

      if (!results || results.length === 0) {
        console.log('📧 No new messages')
        return
      }

      console.log(`📧 Found ${results.length} new message(s)`)

      const fetch = this.imap.fetch(results, {
        bodies: '',
        markSeen: true
      })

      fetch.on('message', (msg, seqno) => {
        let rawEmail = ''

        msg.on('body', (stream, info) => {
          stream.on('data', (chunk) => {
            rawEmail += chunk.toString('utf8')
          })

          stream.once('end', () => {
            this.parseEmail(rawEmail)
          })
        })

        msg.once('error', (err) => {
          console.error(`❌ Error fetching message ${seqno}:`, err)
          this.emit('error', err)
        })
      })

      fetch.once('error', (err) => {
        console.error('❌ Fetch error:', err)
        this.emit('error', err)
      })

      fetch.once('end', () => {
        console.log('✅ Done fetching messages')
      })
    })
  }

  private async parseEmail(rawEmail: string): Promise<void> {
    try {
      const parsed = await simpleParser(rawEmail)

      const email: EmailMessage = {
        messageId: parsed.messageId || `msg-${Date.now()}`,
        subject: parsed.subject || 'No Subject',
        from: this.extractEmailAddress(parsed.from),
        to: this.extractEmailAddress(parsed.to),
        date: parsed.date || new Date(),
        text: parsed.text || undefined,
        html: parsed.html || undefined,
        attachments: this.processAttachments(parsed.attachments)
      }

      console.log(`📧 Parsed email: ${email.subject} from ${email.from}`)
      this.emit('email', email)
    } catch (error) {
      console.error('❌ Error parsing email:', error)
      this.emit('error', error)
    }
  }

  private extractEmailAddress(address: any): string {
    if (!address) return 'unknown'

    if (typeof address === 'string') {
      return address
    }

    if (Array.isArray(address) && address.length > 0) {
      const first = address[0]
      if (typeof first === 'string') {
        return first
      }
      if (first.value && Array.isArray(first.value) && first.value.length > 0) {
        return first.value[0].address || 'unknown'
      }
    }

    if (address.value && Array.isArray(address.value) && address.value.length > 0) {
      return address.value[0].address || 'unknown'
    }

    return 'unknown'
  }

  private processAttachments(attachments: any): Attachment[] {
    if (!attachments || !Array.isArray(attachments)) {
      return []
    }

    return attachments.map((att: any) => ({
      filename: att.filename || 'unnamed',
      contentType: att.contentType || 'application/octet-stream',
      size: att.size || 0,
      content: att.content
    }))
  }

  public isConnected(): boolean {
    return this.connected
  }

  public getStatus(): {
    connected: boolean
    reconnectAttempts: number
    maxReconnectAttempts: number
  } {
    return {
      connected: this.connected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts
    }
  }
}