declare namespace NodeJS {
  interface ProcessEnv {
    // 애플리케이션
    NODE_ENV: 'development' | 'production' | 'test'
    APP_URL: string
    PORT: string

    // 데이터베이스
    DATABASE_URL: string
    DB_POOL_MIN: string
    DB_POOL_MAX: string

    // Redis
    REDIS_URL: string
    REDIS_PASSWORD?: string
    REDIS_DB: string

    // 메일 서버
    MAIL_HOST: string
    MAIL_PORT: string
    MAIL_SECURE: string
    MAIL_USER: string
    MAIL_PASSWORD: string
    MAIL_CHECK_INTERVAL: string
    MAIL_IDLE_TIMEOUT: string

    // SMS API
    SMS_PROVIDER: 'aligo' | 'solutionlink' | 'ncp'
    ALIGO_API_KEY?: string
    ALIGO_USER_ID?: string
    ALIGO_SENDER?: string
    SOLUTIONLINK_API_KEY?: string
    SOLUTIONLINK_API_SECRET?: string
    SOLUTIONLINK_SENDER?: string
    NCP_ACCESS_KEY?: string
    NCP_SECRET_KEY?: string
    NCP_SERVICE_ID?: string
    NCP_SENDER?: string

    // 카카오톡 API
    KAKAO_API_KEY: string
    KAKAO_API_SECRET: string
    KAKAO_SENDER_KEY: string
    KAKAO_TEMPLATE_ORDER_RECEIVED: string
    KAKAO_TEMPLATE_DELIVERY_NOTICE: string
    KAKAO_PLUS_FRIEND_ID: string

    // 공휴일 API
    HOLIDAY_API_KEY: string
    HOLIDAY_API_URL: string

    // 보안
    JWT_SECRET: string
    JWT_EXPIRES_IN: string
    SESSION_SECRET: string
    ENCRYPTION_KEY: string
    NEXTAUTH_URL: string
    NEXTAUTH_SECRET: string

    // 로깅
    LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug'
    SENTRY_DSN?: string
    ENABLE_METRICS: string
    METRICS_PORT: string

    // 알림 설정
    SMS_RATE_LIMIT: string
    KAKAO_RATE_LIMIT: string
    NOTIFICATION_RETRY_COUNT: string
    NOTIFICATION_RETRY_DELAY: string
    ENABLE_SMS_FALLBACK: string

    // 파일 업로드
    UPLOAD_DIR: string
    MAX_FILE_SIZE: string
    ALLOWED_FILE_TYPES: string

    // 개발/테스트
    ENABLE_REAL_NOTIFICATIONS: string
    ENABLE_MAIL_MONITORING: string
    USE_MOCK_DATA: string

    // CORS
    CORS_ORIGIN: string
    CORS_CREDENTIALS: string

    // MCP 서버
    GITHUB_TOKEN?: string
    GITHUB_REPO_OWNER?: string
    GITHUB_REPO_NAME?: string
    CONTEXT7_API_KEY?: string
    SUPABASE_URL?: string
    SUPABASE_ANON_KEY?: string
    SUPABASE_SERVICE_ROLE_KEY?: string
    SUPABASE_PROJECT_REF?: string
    VERCEL_TOKEN?: string
    VERCEL_TEAM_ID?: string
    VERCEL_PROJECT_ID?: string
    VERCEL_ORG_ID?: string
    SHADCN_REGISTRY_URL?: string
    SHADCN_COMPONENTS_PATH?: string
    SHADCN_UTILS_PATH?: string
  }
}
