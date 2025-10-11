/**
 * Echo Mail Logger System
 * Winston 기반 구조화된 로깅 시스템
 */

import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'

// 로그 레벨 정의
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  VERBOSE = 'verbose',
  DEBUG = 'debug',
  SILLY = 'silly',
}

// 로그 카테고리
export enum LogCategory {
  SYSTEM = 'system',
  EMAIL = 'email',
  NOTIFICATION = 'notification',
  API = 'api',
  AUTH = 'auth',
  DATABASE = 'database',
  EXTERNAL = 'external',
}

// 로그 메타데이터 인터페이스
export interface LogMetadata {
  category?: LogCategory
  requestId?: string
  userId?: string
  companyId?: string
  errorCode?: number
  duration?: number
  endpoint?: string
  method?: string
  statusCode?: number
  [key: string]: any
}

/**
 * 커스텀 로그 포맷터
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, category, requestId, ...meta } = info

    const logObject = {
      timestamp,
      level: level.toUpperCase(),
      category: category || LogCategory.SYSTEM,
      message,
      ...(requestId && { requestId }),
      ...meta,
    }

    return JSON.stringify(logObject)
  })
)

/**
 * 개발 환경용 콘솔 포맷
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss',
  }),
  winston.format.printf((info) => {
    const { timestamp, level, message, category, requestId, ...meta } = info

    let logString = `${timestamp} [${level}]`

    if (category) {
      logString += ` [${category.toUpperCase()}]`
    }

    if (requestId) {
      logString += ` [${requestId}]`
    }

    logString += `: ${message}`

    // 메타데이터가 있으면 추가
    if (Object.keys(meta).length > 0) {
      logString += ` ${JSON.stringify(meta, null, 2)}`
    }

    return logString
  })
)

/**
 * Winston 로거 생성 함수
 */
function createLogger(): winston.Logger {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info')
  const logsDir = process.env.LOGS_DIR || path.join(process.cwd(), 'logs')

  // Transport 설정
  const transports: winston.transport[] = []

  // 콘솔 출력 (개발 환경)
  if (isDevelopment) {
    transports.push(
      new winston.transports.Console({
        level: logLevel,
        format: consoleFormat,
      })
    )
  }

  // 파일 출력 (운영 환경)
  if (!isDevelopment) {
    // 일반 로그 (info 이상)
    transports.push(
      new DailyRotateFile({
        filename: path.join(logsDir, 'echo-mail-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'info',
        format: customFormat,
        maxSize: '100m',
        maxFiles: '30d',
        zippedArchive: true,
      })
    )

    // 에러 로그 (error만)
    transports.push(
      new DailyRotateFile({
        filename: path.join(logsDir, 'echo-mail-error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        format: customFormat,
        maxSize: '100m',
        maxFiles: '30d',
        zippedArchive: true,
      })
    )

    // 디버그 로그 (debug 이상, 개발시에만)
    if (logLevel === 'debug') {
      transports.push(
        new DailyRotateFile({
          filename: path.join(logsDir, 'echo-mail-debug-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          level: 'debug',
          format: customFormat,
          maxSize: '50m',
          maxFiles: '7d',
          zippedArchive: true,
        })
      )
    }
  }

  return winston.createLogger({
    level: logLevel,
    format: customFormat,
    defaultMeta: {
      service: 'echo-mail',
      version: process.env.npm_package_version || '1.0.0',
    },
    transports,
    // Unhandled exception/rejection 처리
    exceptionHandlers: isDevelopment
      ? []
      : [
          new DailyRotateFile({
            filename: path.join(logsDir, 'echo-mail-exceptions-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '50m',
            maxFiles: '30d',
          }),
        ],
    rejectionHandlers: isDevelopment
      ? []
      : [
          new DailyRotateFile({
            filename: path.join(logsDir, 'echo-mail-rejections-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '50m',
            maxFiles: '30d',
          }),
        ],
  })
}

/**
 * 로거 래퍼 클래스
 */
class EchoMailLogger {
  private logger: winston.Logger
  private requestId?: string

  constructor() {
    this.logger = createLogger()
  }

  /**
   * 요청 ID 설정 (체이닝용)
   */
  withRequestId(requestId: string): EchoMailLogger {
    const newInstance = new EchoMailLogger()
    newInstance.logger = this.logger
    newInstance.requestId = requestId
    return newInstance
  }

  /**
   * 카테고리 설정 (체이닝용)
   */
  withCategory(category: LogCategory): EchoMailLogger {
    const newInstance = new EchoMailLogger()
    newInstance.logger = this.logger
    newInstance.requestId = this.requestId
    return newInstance
  }

  /**
   * 로그 메서드들
   */
  error(message: string, meta?: LogMetadata): void {
    this.log(LogLevel.ERROR, message, meta)
  }

  warn(message: string, meta?: LogMetadata): void {
    this.log(LogLevel.WARN, message, meta)
  }

  info(message: string, meta?: LogMetadata): void {
    this.log(LogLevel.INFO, message, meta)
  }

  http(message: string, meta?: LogMetadata): void {
    this.log(LogLevel.HTTP, message, meta)
  }

  verbose(message: string, meta?: LogMetadata): void {
    this.log(LogLevel.VERBOSE, message, meta)
  }

  debug(message: string, meta?: LogMetadata): void {
    this.log(LogLevel.DEBUG, message, meta)
  }

  silly(message: string, meta?: LogMetadata): void {
    this.log(LogLevel.SILLY, message, meta)
  }

  /**
   * 카테고리별 로깅 메서드들
   */
  system = {
    error: (message: string, meta?: LogMetadata) =>
      this.log(LogLevel.ERROR, message, { ...meta, category: LogCategory.SYSTEM }),
    warn: (message: string, meta?: LogMetadata) =>
      this.log(LogLevel.WARN, message, { ...meta, category: LogCategory.SYSTEM }),
    info: (message: string, meta?: LogMetadata) =>
      this.log(LogLevel.INFO, message, { ...meta, category: LogCategory.SYSTEM }),
    debug: (message: string, meta?: LogMetadata) =>
      this.log(LogLevel.DEBUG, message, { ...meta, category: LogCategory.SYSTEM }),
  }

  email = {
    error: (message: string, meta?: LogMetadata) =>
      this.log(LogLevel.ERROR, message, { ...meta, category: LogCategory.EMAIL }),
    warn: (message: string, meta?: LogMetadata) =>
      this.log(LogLevel.WARN, message, { ...meta, category: LogCategory.EMAIL }),
    info: (message: string, meta?: LogMetadata) =>
      this.log(LogLevel.INFO, message, { ...meta, category: LogCategory.EMAIL }),
    debug: (message: string, meta?: LogMetadata) =>
      this.log(LogLevel.DEBUG, message, { ...meta, category: LogCategory.EMAIL }),
  }

  notification = {
    error: (message: string, meta?: LogMetadata) =>
      this.log(LogLevel.ERROR, message, { ...meta, category: LogCategory.NOTIFICATION }),
    warn: (message: string, meta?: LogMetadata) =>
      this.log(LogLevel.WARN, message, { ...meta, category: LogCategory.NOTIFICATION }),
    info: (message: string, meta?: LogMetadata) =>
      this.log(LogLevel.INFO, message, { ...meta, category: LogCategory.NOTIFICATION }),
    debug: (message: string, meta?: LogMetadata) =>
      this.log(LogLevel.DEBUG, message, { ...meta, category: LogCategory.NOTIFICATION }),
  }

  api = {
    error: (message: string, meta?: LogMetadata) =>
      this.log(LogLevel.ERROR, message, { ...meta, category: LogCategory.API }),
    warn: (message: string, meta?: LogMetadata) =>
      this.log(LogLevel.WARN, message, { ...meta, category: LogCategory.API }),
    info: (message: string, meta?: LogMetadata) =>
      this.log(LogLevel.INFO, message, { ...meta, category: LogCategory.API }),
    debug: (message: string, meta?: LogMetadata) =>
      this.log(LogLevel.DEBUG, message, { ...meta, category: LogCategory.API }),
  }

  database = {
    error: (message: string, meta?: LogMetadata) =>
      this.log(LogLevel.ERROR, message, { ...meta, category: LogCategory.DATABASE }),
    warn: (message: string, meta?: LogMetadata) =>
      this.log(LogLevel.WARN, message, { ...meta, category: LogCategory.DATABASE }),
    info: (message: string, meta?: LogMetadata) =>
      this.log(LogLevel.INFO, message, { ...meta, category: LogCategory.DATABASE }),
    debug: (message: string, meta?: LogMetadata) =>
      this.log(LogLevel.DEBUG, message, { ...meta, category: LogCategory.DATABASE }),
  }

  /**
   * 성능 로깅
   */
  performance = {
    start: (operation: string, meta?: LogMetadata): PerformanceTimer => {
      return new PerformanceTimer(this, operation, meta)
    },

    measure: (operation: string, startTime: number, meta?: LogMetadata): void => {
      const duration = Date.now() - startTime
      this.log(LogLevel.INFO, `Performance: ${operation}`, {
        ...meta,
        category: LogCategory.SYSTEM,
        duration,
        operation,
      })
    },
  }

  /**
   * HTTP 요청 로깅
   */
  httpRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    meta?: LogMetadata
  ): void {
    const level = statusCode >= 400 ? LogLevel.ERROR : LogLevel.HTTP
    this.log(level, `${method} ${url} ${statusCode}`, {
      ...meta,
      category: LogCategory.API,
      method,
      endpoint: url,
      statusCode,
      duration,
    })
  }

  /**
   * 에러 로깅 (Error 객체용)
   */
  logError(error: Error, context?: LogMetadata): void {
    this.log(LogLevel.ERROR, error.message, {
      ...context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    })
  }

  /**
   * 내부 로그 메서드
   */
  private log(level: LogLevel, message: string, meta?: LogMetadata): void {
    const logMeta = {
      ...meta,
      ...(this.requestId && { requestId: this.requestId }),
    }

    this.logger.log(level, message, logMeta)
  }

  /**
   * 로그 스트림 (Morgan 등과 연동)
   */
  get stream() {
    return {
      write: (message: string) => {
        this.info(message.trim())
      },
    }
  }
}

/**
 * 성능 측정 타이머
 */
class PerformanceTimer {
  private startTime: number
  private logger: EchoMailLogger
  private operation: string
  private meta?: LogMetadata

  constructor(logger: EchoMailLogger, operation: string, meta?: LogMetadata) {
    this.startTime = Date.now()
    this.logger = logger
    this.operation = operation
    this.meta = meta
  }

  /**
   * 측정 종료 및 로그 출력
   */
  end(additionalMeta?: LogMetadata): number {
    const duration = Date.now() - this.startTime

    this.logger.log(LogLevel.INFO, `Performance: ${this.operation} completed`, {
      ...this.meta,
      ...additionalMeta,
      category: LogCategory.SYSTEM,
      duration,
      operation: this.operation,
    })

    return duration
  }

  /**
   * 중간 체크포인트
   */
  checkpoint(checkpointName: string, additionalMeta?: LogMetadata): number {
    const duration = Date.now() - this.startTime

    this.logger.log(LogLevel.DEBUG, `Performance: ${this.operation} - ${checkpointName}`, {
      ...this.meta,
      ...additionalMeta,
      category: LogCategory.SYSTEM,
      duration,
      operation: this.operation,
      checkpoint: checkpointName,
    })

    return duration
  }
}

/**
 * Express 미들웨어
 */
export function createLoggerMiddleware() {
  return (req: any, res: any, next: any) => {
    const requestId = req.id || req.headers['x-request-id'] || generateRequestId()
    const startTime = Date.now()

    // 요청 로깅
    logger.httpRequest(
      req.method,
      req.originalUrl || req.url,
      0, // 시작 시점에는 status 0
      0,
      {
        requestId,
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress,
        userId: req.user?.id,
      }
    )

    // 응답 완료 시 로깅
    res.on('finish', () => {
      const duration = Date.now() - startTime
      logger.httpRequest(req.method, req.originalUrl || req.url, res.statusCode, duration, {
        requestId,
        contentLength: res.get('content-length'),
      })
    })

    // req 객체에 로거 추가
    req.logger = logger.withRequestId(requestId)

    next()
  }
}

/**
 * 요청 ID 생성
 */
function generateRequestId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
}

/**
 * 로그 분석을 위한 유틸리티 함수들
 */
export const logUtils = {
  /**
   * 로그 파일에서 특정 패턴 검색
   */
  async searchLogs(
    pattern: string,
    options: {
      level?: LogLevel
      category?: LogCategory
      startDate?: Date
      endDate?: Date
      limit?: number
    } = {}
  ): Promise<any[]> {
    // TODO: 실제 로그 파일 검색 구현
    // 파일 시스템 또는 로그 집계 시스템에서 검색
    return []
  },

  /**
   * 로그 통계 생성
   */
  async generateStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalLogs: number
    errorCount: number
    warningCount: number
    categoryStats: Record<LogCategory, number>
    hourlyStats: Array<{ hour: number; count: number }>
  }> {
    // TODO: 로그 통계 생성 구현
    return {
      totalLogs: 0,
      errorCount: 0,
      warningCount: 0,
      categoryStats: {} as Record<LogCategory, number>,
      hourlyStats: [],
    }
  },

  /**
   * 로그 아카이브
   */
  async archiveLogs(olderThanDays: number): Promise<{
    archivedFiles: string[]
    totalSize: number
  }> {
    // TODO: 오래된 로그 파일 아카이브 구현
    return {
      archivedFiles: [],
      totalSize: 0,
    }
  },
}

// 싱글톤 로거 인스턴스
export const logger = new EchoMailLogger()

// 기본 익스포트
export default logger
