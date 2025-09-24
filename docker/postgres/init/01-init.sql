-- =============================================================================
-- Echo Mail Database Initialization Script
-- PostgreSQL 초기화 스크립트
-- =============================================================================

-- 데이터베이스 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- 한국어 지원을 위한 로케일 설정
-- 이미 초기화 시 설정되지만 명시적으로 확인
SHOW lc_collate;
SHOW lc_ctype;

-- 타임존 설정 (한국 시간)
SET timezone = 'Asia/Seoul';

-- 기본 사용자 권한 설정
GRANT ALL PRIVILEGES ON DATABASE echomail TO postgres;

-- 성능 최적화를 위한 설정
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'all';
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 1000;

-- 메모리 설정 (컨테이너 환경에 맞게 조정)
ALTER SYSTEM SET shared_buffers = '64MB';
ALTER SYSTEM SET effective_cache_size = '192MB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '16MB';

-- 연결 설정
ALTER SYSTEM SET max_connections = 100;

-- WAL 설정
ALTER SYSTEM SET wal_buffers = '2MB';
ALTER SYSTEM SET checkpoint_segments = 8;

-- 로그 설정
ALTER SYSTEM SET log_destination = 'stderr';
ALTER SYSTEM SET logging_collector = on;
ALTER SYSTEM SET log_line_prefix = '%t [%p-%l] %q%u@%d ';

-- 통계 설정
ALTER SYSTEM SET track_activities = on;
ALTER SYSTEM SET track_counts = on;
ALTER SYSTEM SET track_functions = 'all';

-- Echo Mail 애플리케이션을 위한 초기 설정 완료
SELECT 'Echo Mail Database initialized successfully' AS status;