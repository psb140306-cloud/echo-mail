'use client';

import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Clock, Wrench } from 'lucide-react';

/**
 * 에러 로그 페이지 - 준비 중
 * 실제 에러 추적 시스템은 추후 구현 예정
 */
export default function LogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">에러 로그</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          시스템 에러 로그를 조회하고 분석합니다
        </p>
      </div>

      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-blue-100 dark:bg-blue-900/50 p-4 mb-4">
              <Wrench className="w-12 h-12 text-blue-600 dark:text-blue-400" />
            </div>

            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
              에러 로그 기능 준비 중
            </h3>

            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
              실시간 에러 추적 및 로그 분석 기능은 현재 개발 중입니다.
              <br />
              추후 업데이트를 통해 제공될 예정입니다.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mt-8">
              <div className="flex items-start gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <h4 className="font-medium text-sm mb-1 text-gray-900 dark:text-gray-100">
                    실시간 에러 추적
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    시스템 에러를 실시간으로 감지하고 DB에 저장
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <h4 className="font-medium text-sm mb-1 text-gray-900 dark:text-gray-100">
                    로그 분석 및 통계
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    에러 패턴 분석, 카테고리별 통계 제공
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 text-sm text-gray-500 dark:text-gray-400">
              현재 데이터베이스 상태는{' '}
              <a
                href="/admin/monitoring"
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                모니터링 페이지
              </a>
              에서 확인하실 수 있습니다.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
