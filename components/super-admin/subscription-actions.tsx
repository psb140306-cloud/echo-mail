'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SubscriptionActionsProps {
  subscriptionId: string;
  currentStatus: string;
  tenantId: string;
}

export function SubscriptionActions({
  subscriptionId,
  currentStatus,
  tenantId,
}: SubscriptionActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleCancel = async () => {
    if (!confirm('정말로 이 구독을 취소하시겠습니까?')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/super-admin/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('구독 취소 실패');
      }

      router.refresh();
    } catch (error) {
      alert('구독 취소 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    if (!confirm('이 구독을 다시 활성화하시겠습니까?')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/super-admin/subscriptions/${subscriptionId}/resume`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('구독 재개 실패');
      }

      router.refresh();
    } catch (error) {
      alert('구독 재개 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePlan = async () => {
    const newPlan = prompt('새 플랜을 입력하세요 (starter, professional, enterprise):');
    if (!newPlan) return;

    if (!['starter', 'professional', 'enterprise'].includes(newPlan)) {
      alert('유효하지 않은 플랜입니다.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/super-admin/subscriptions/${subscriptionId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: newPlan }),
      });

      if (!response.ok) {
        throw new Error('플랜 변경 실패');
      }

      router.refresh();
    } catch (error) {
      alert('플랜 변경 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={handleChangePlan}
        disabled={isLoading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        플랜 변경
      </button>
      {currentStatus === 'active' ? (
        <button
          onClick={handleCancel}
          disabled={isLoading}
          className="px-4 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
        >
          구독 취소
        </button>
      ) : (
        <button
          onClick={handleResume}
          disabled={isLoading}
          className="px-4 py-2 border border-green-300 text-green-600 rounded hover:bg-green-50 disabled:opacity-50"
        >
          구독 재개
        </button>
      )}
    </div>
  );
}
