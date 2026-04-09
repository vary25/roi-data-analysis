'use client';

import { FilterOptions, FilterParams } from '@/types';

interface FilterBarProps {
  filters: FilterParams;
  options: FilterOptions;
  onChange: (key: keyof FilterParams, value: string) => void;
}

export default function FilterBar({ filters, options, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
      {/* 应用选择 */}
      <div className="flex flex-col">
        <label className="text-sm font-medium text-gray-700 mb-1">应用</label>
        <select
          value={filters.appKey || ''}
          onChange={(e) => onChange('appKey', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[150px]"
        >
          <option value="">全部应用</option>
          {options.apps?.map((app) => (
            <option key={app} value={app}>
              {app}
            </option>
          ))}
        </select>
      </div>

      {/* 出价类型选择 */}
      <div className="flex flex-col">
        <label className="text-sm font-medium text-gray-700 mb-1">出价类型</label>
        <select
          value={filters.bidType || ''}
          onChange={(e) => onChange('bidType', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[150px]"
        >
          <option value="">全部出价类型</option>
          {options.bidTypes?.map((bidType) => (
            <option key={bidType} value={bidType}>
              {bidType}
            </option>
          ))}
        </select>
      </div>

      {/* 国家选择 */}
      <div className="flex flex-col">
        <label className="text-sm font-medium text-gray-700 mb-1">国家/地区</label>
        <select
          value={filters.countryCode || ''}
          onChange={(e) => onChange('countryCode', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[150px]"
        >
          <option value="">全部国家</option>
          {options.countries?.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>
      </div>

      {/* 开始日期 */}
      <div className="flex flex-col">
        <label className="text-sm font-medium text-gray-700 mb-1">开始日期</label>
        <input
          type="date"
          value={filters.startDate || ''}
          onChange={(e) => onChange('startDate', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 结束日期 */}
      <div className="flex flex-col">
        <label className="text-sm font-medium text-gray-700 mb-1">结束日期</label>
        <input
          type="date"
          value={filters.endDate || ''}
          onChange={(e) => onChange('endDate', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
