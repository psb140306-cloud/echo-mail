-- 긴급: 메일 스케줄러 즉시 중지
-- Supabase SQL Editor에서 실행하세요

-- 모든 테넌트의 메일 서버 비활성화
UPDATE system_config
SET value = 'false'
WHERE key = 'mailServer.enabled';

-- 확인
SELECT tenant_id, key, value
FROM system_config
WHERE key LIKE 'mailServer.%'
ORDER BY tenant_id, key;
