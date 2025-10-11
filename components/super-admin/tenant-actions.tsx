'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface TenantActionsProps {
  tenantId: string;
  currentStatus: string;
}

export function TenantActions({ tenantId, currentStatus }: TenantActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleStatusToggle = async () => {
    if (!confirm(`정말로 이 테넌트를 ${currentStatus === 'active' ? '비활성화' : '활성화'}하시겠습니까?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
      const response = await fetch(`/api/super-admin/tenants/${tenantId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('상태 변경 실패');
      }

      router.refresh();
    } catch (error) {
      alert('상태 변경 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('정말로 이 테넌트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/super-admin/tenants/${tenantId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('삭제 실패');
      }

      router.push('/super-admin/tenants');
    } catch (error) {
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={handleStatusToggle}
        disabled={isLoading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? '처리 중...' : currentStatus === 'active' ? '비활성화' : '활성화'}
      </button>
      <button
        onClick={handleDelete}
        disabled={isLoading}
        className="px-4 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
      >
        삭제
      </button>
    </div>
  );
}
