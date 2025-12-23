'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface SubscriptionActionsProps {
  subscriptionId: string;
  currentStatus: string;
  tenantId: string;
}

const PLANS = [
  { value: 'FREE_TRIAL', label: '무료 체험', price: 0 },
  { value: 'STARTER', label: '스타터', price: 29000 },
  { value: 'PROFESSIONAL', label: '프로페셔널', price: 79000 },
  { value: 'BUSINESS', label: '비즈니스', price: 149000 },
  { value: 'ENTERPRISE', label: '엔터프라이즈', price: 199000 },
];

export function SubscriptionActions({
  subscriptionId,
  currentStatus,
  tenantId,
}: SubscriptionActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('');

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

  const handleChangePlanSubmit = async () => {
    if (!selectedPlan) {
      alert('플랜을 선택해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/super-admin/subscriptions/${subscriptionId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: selectedPlan }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '플랜 변경 실패');
      }

      setIsPlanModalOpen(false);
      setSelectedPlan('');
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : '플랜 변경 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button
          onClick={() => setIsPlanModalOpen(true)}
          disabled={isLoading}
          variant="default"
        >
          플랜 변경
        </Button>
        {currentStatus === 'active' ? (
          <Button
            onClick={handleCancel}
            disabled={isLoading}
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
          >
            구독 취소
          </Button>
        ) : (
          <Button
            onClick={handleResume}
            disabled={isLoading}
            variant="outline"
            className="border-green-300 text-green-600 hover:bg-green-50"
          >
            구독 재개
          </Button>
        )}
      </div>

      <Dialog open={isPlanModalOpen} onOpenChange={setIsPlanModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>플랜 변경</DialogTitle>
            <DialogDescription>
              새로운 구독 플랜을 선택하세요. 변경 즉시 적용됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">새 플랜 선택</label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger>
                  <SelectValue placeholder="플랜을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {PLANS.map((plan) => (
                    <SelectItem key={plan.value} value={plan.value}>
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">{plan.label}</span>
                        <span className="text-sm text-gray-500 ml-4">
                          {plan.price.toLocaleString()}원/월
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedPlan && (
              <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                <p className="text-sm text-blue-900">
                  <span className="font-medium">
                    {PLANS.find((p) => p.value === selectedPlan)?.label}
                  </span>{' '}
                  플랜으로 즉시 변경됩니다.
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  월 {PLANS.find((p) => p.value === selectedPlan)?.price.toLocaleString()}원
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsPlanModalOpen(false);
                setSelectedPlan('');
              }}
              disabled={isLoading}
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={handleChangePlanSubmit}
              disabled={isLoading || !selectedPlan}
            >
              {isLoading ? '변경 중...' : '변경하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
