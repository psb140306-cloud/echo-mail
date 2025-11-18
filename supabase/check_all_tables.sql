-- 모든 테이블의 tenantId 컬럼명 확인
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name LIKE '%tenant%'
ORDER BY table_name, ordinal_position;
