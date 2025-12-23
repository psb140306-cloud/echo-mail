'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Health 페이지는 Monitoring으로 통합되었습니다.
 * /admin/monitoring으로 리다이렉트합니다.
 */
export default function HealthRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/monitoring');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">페이지 이동 중...</h2>
        <p className="text-gray-500">Health 기능은 Monitoring 페이지로 통합되었습니다.</p>
      </div>
    </div>
  );
}
