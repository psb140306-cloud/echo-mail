import { ImapClient, EmailConfig, EmailMessage } from './imap-client'
import { EventEmitter } from 'events'

interface PoolConfig {
  minConnections: number
  maxConnections: number
  idleTimeout: number
  connectionTimeout: number
}

interface PooledConnection {
  client: ImapClient
  id: string
  inUse: boolean
  lastUsed: Date
  created: Date
}

export class ImapConnectionPool extends EventEmitter {
  private connections: Map<string, PooledConnection> = new Map()
  private waitingQueue: Array<(conn: PooledConnection) => void> = []
  private cleanupInterval?: NodeJS.Timer
  private readonly defaultPoolConfig: PoolConfig = {
    minConnections: 1,
    maxConnections: 5,
    idleTimeout: 300000, // 5 minutes
    connectionTimeout: 30000, // 30 seconds
  }

  constructor(
    private emailConfig: EmailConfig,
    private poolConfig: Partial<PoolConfig> = {}
  ) {
    super()
    this.poolConfig = { ...this.defaultPoolConfig, ...poolConfig }
    this.initialize()
  }

  private async initialize(): Promise<void> {
    console.log('🔧 Initializing IMAP connection pool...')

    // Create minimum number of connections
    const minConns = this.poolConfig.minConnections || this.defaultPoolConfig.minConnections
    for (let i = 0; i < minConns; i++) {
      await this.createConnection()
    }

    // Start cleanup interval
    this.startCleanup()
  }

  private async createConnection(): Promise<PooledConnection | null> {
    const maxConns = this.poolConfig.maxConnections || this.defaultPoolConfig.maxConnections

    if (this.connections.size >= maxConns) {
      console.warn(`⚠️ Maximum connections (${maxConns}) reached`)
      return null
    }

    const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const client = new ImapClient(this.emailConfig)

    // Setup client event handlers
    client.on('connected', () => {
      console.log(`✅ Connection ${connectionId} established`)
      this.emit('connection-created', connectionId)
    })

    client.on('error', (error) => {
      console.error(`❌ Connection ${connectionId} error:`, error)
      this.emit('connection-error', { connectionId, error })
      this.removeConnection(connectionId)
    })

    client.on('disconnected', () => {
      console.log(`📧 Connection ${connectionId} disconnected`)
      this.removeConnection(connectionId)
    })

    client.on('email', (email: EmailMessage) => {
      this.emit('email', email)
    })

    // Connect the client
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'))
      }, this.poolConfig.connectionTimeout || this.defaultPoolConfig.connectionTimeout)

      client.once('connected', () => {
        clearTimeout(timeout)
        resolve()
      })

      client.once('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })

      client.connect()
    })

    const pooledConnection: PooledConnection = {
      client,
      id: connectionId,
      inUse: false,
      lastUsed: new Date(),
      created: new Date(),
    }

    this.connections.set(connectionId, pooledConnection)
    console.log(
      `📧 Added connection ${connectionId} to pool (${this.connections.size}/${maxConns})`
    )

    return pooledConnection
  }

  private removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId)
    if (!connection) return

    connection.client.disconnect()
    this.connections.delete(connectionId)
    console.log(
      `🗑️ Removed connection ${connectionId} from pool (${this.connections.size} remaining)`
    )

    // Create a new connection if we're below minimum
    const minConns = this.poolConfig.minConnections || this.defaultPoolConfig.minConnections
    if (this.connections.size < minConns) {
      this.createConnection().catch((err) => {
        console.error('❌ Failed to create replacement connection:', err)
      })
    }
  }

  public async getConnection(): Promise<PooledConnection> {
    // Find an available connection
    for (const [id, conn] of this.connections.entries()) {
      if (!conn.inUse && conn.client.isConnected()) {
        conn.inUse = true
        conn.lastUsed = new Date()
        console.log(`🔄 Reusing connection ${id}`)
        return conn
      }
    }

    // Try to create a new connection if possible
    const newConn = await this.createConnection()
    if (newConn) {
      newConn.inUse = true
      return newConn
    }

    // Wait for a connection to become available
    console.log('⏳ Waiting for available connection...')
    return new Promise((resolve) => {
      this.waitingQueue.push(resolve)
    })
  }

  public releaseConnection(connection: PooledConnection): void {
    connection.inUse = false
    connection.lastUsed = new Date()
    console.log(`✅ Released connection ${connection.id}`)

    // Check if anyone is waiting for a connection
    if (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift()
      if (waiter) {
        connection.inUse = true
        waiter(connection)
      }
    }
  }

  private startCleanup(): void {
    // Clean up idle connections every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections()
    }, 60000)
  }

  private cleanupIdleConnections(): void {
    const now = new Date()
    const idleTimeout = this.poolConfig.idleTimeout || this.defaultPoolConfig.idleTimeout
    const minConns = this.poolConfig.minConnections || this.defaultPoolConfig.minConnections

    for (const [id, conn] of this.connections.entries()) {
      if (this.connections.size <= minConns) {
        break // Don't go below minimum connections
      }

      if (!conn.inUse) {
        const idleTime = now.getTime() - conn.lastUsed.getTime()
        if (idleTime > idleTimeout) {
          console.log(`🧹 Cleaning up idle connection ${id}`)
          this.removeConnection(id)
        }
      }
    }
  }

  public async shutdown(): Promise<void> {
    console.log('🛑 Shutting down connection pool...')

    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    // Clear waiting queue
    this.waitingQueue = []

    // Disconnect all connections
    const disconnectPromises = Array.from(this.connections.values()).map((conn) => {
      return new Promise<void>((resolve) => {
        conn.client.disconnect()
        resolve()
      })
    })

    await Promise.all(disconnectPromises)
    this.connections.clear()

    console.log('✅ Connection pool shut down')
  }

  public getStatus(): {
    totalConnections: number
    activeConnections: number
    idleConnections: number
    waitingQueue: number
  } {
    let activeCount = 0
    let idleCount = 0

    for (const conn of this.connections.values()) {
      if (conn.inUse) {
        activeCount++
      } else {
        idleCount++
      }
    }

    return {
      totalConnections: this.connections.size,
      activeConnections: activeCount,
      idleConnections: idleCount,
      waitingQueue: this.waitingQueue.length,
    }
  }
}
