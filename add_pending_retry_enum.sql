-- PENDING_RETRY 상태를 NotificationStatus enum에 추가
-- Supabase SQL Editor에서 실행하세요

-- NotificationStatus enum에 PENDING_RETRY 값 추가
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'PENDING_RETRY';

-- 확인 쿼리
SELECT enumlabel FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationStatus');
