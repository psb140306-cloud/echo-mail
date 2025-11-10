# =============================================================================
# Echo Mail Next.js Application Dockerfile
# =============================================================================

# Node.js 베이스 이미지
FROM node:18-alpine AS base

# 필요한 패키지 설치
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 패키지 관리자 설정
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# =============================================================================
# 의존성 설치 단계
# =============================================================================
FROM base AS deps
WORKDIR /app

# 패키지 파일 및 Prisma 스키마 복사
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
COPY prisma ./prisma/

# 의존성 설치
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# =============================================================================
# 빌드 단계
# =============================================================================
FROM base AS builder
WORKDIR /app

# 의존성 복사
COPY --from=deps /app/node_modules ./node_modules

# 소스 코드 복사
COPY . .

# 환경변수 설정 (빌드용)
ENV NEXT_TELEMETRY_DISABLED 1

# Next.js 빌드
RUN \
  if [ -f yarn.lock ]; then yarn build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then pnpm build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# =============================================================================
# 개발 단계
# =============================================================================
FROM base AS development
WORKDIR /app

# 의존성 복사
COPY --from=deps /app/node_modules ./node_modules

# 소스 코드 복사
COPY . .

# 환경변수 설정
ENV NODE_ENV development
ENV NEXT_TELEMETRY_DISABLED 1

# 포트 노출
EXPOSE 3000

# 개발 서버 실행
CMD \
  if [ -f yarn.lock ]; then yarn dev; \
  elif [ -f package-lock.json ]; then npm run dev; \
  elif [ -f pnpm-lock.yaml ]; then pnpm dev; \
  else echo "Lockfile not found." && exit 1; \
  fi

# =============================================================================
# 프로덕션 런너 단계
# =============================================================================
FROM base AS runner
WORKDIR /app

# 프로덕션 환경 설정
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# 사용자 생성
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 빌드 결과물 복사
COPY --from=builder /app/public ./public

# Next.js 정적 파일 복사 (소유권 설정)
RUN mkdir .next
RUN chown nextjs:nodejs .next

# 빌드 결과물 복사 (자동으로 standalone으로 복사)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 사용자 변경
USER nextjs

# 포트 노출
EXPOSE 3000

# 환경변수 설정
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# 애플리케이션 실행
CMD ["node", "server.js"]