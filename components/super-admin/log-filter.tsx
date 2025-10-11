'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';

interface LogFilterProps {
  filters: {
    level: string;
    category: string;
    period: string;
    search: string;
  };
  setFilters: (filters: any) => void;
}

export function LogFilter({ filters, setFilters }: LogFilterProps) {
  const handleReset = () => {
    setFilters({
      level: 'all',
      category: 'all',
      period: '24h',
      search: '',
    });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid gap-4 md:grid-cols-5">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="에러 메시지 또는 코드 검색..."
                className="pl-10"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
              {filters.search && (
                <button
                  onClick={() => setFilters({ ...filters, search: '' })}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
          </div>

          <Select
            value={filters.level}
            onValueChange={(value) => setFilters({ ...filters, level: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="심각도" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">모든 레벨</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.category}
            onValueChange={(value) => setFilters({ ...filters, category: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="카테고리" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">모든 카테고리</SelectItem>
              <SelectItem value="system">시스템</SelectItem>
              <SelectItem value="database">데이터베이스</SelectItem>
              <SelectItem value="api">API</SelectItem>
              <SelectItem value="email">이메일</SelectItem>
              <SelectItem value="notification">알림</SelectItem>
              <SelectItem value="payment">결제</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.period}
            onValueChange={(value) => setFilters({ ...filters, period: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="기간" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">최근 1시간</SelectItem>
              <SelectItem value="24h">최근 24시간</SelectItem>
              <SelectItem value="7d">최근 7일</SelectItem>
              <SelectItem value="30d">최근 30일</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <X className="w-4 h-4 mr-1" />
            필터 초기화
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
