'use client';

import { useState, useEffect, useCallback } from 'react';
import FilterBar from './components/FilterBar';
import ControlBar from './components/ControlBar';
import ROIChart from './components/ROIChart';
import { ROIRecord, FilterOptions, FilterParams, APIResponse, ROIResponseData, ROISummary } from '@/types';

export default function Home() {
  // 筛选状态（使用字符串维度）
  const [filters, setFilters] = useState<FilterParams>({
    appKey: '',
    countryCode: '',
    bidType: '',
    startDate: '',
    endDate: '',
  });

  // 筛选选项
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    apps: [],
    countries: [],
    bidTypes: [],
    dateRange: { min: '', max: '' },
  });

  // 显示控制
  const [showMovingAverage, setShowMovingAverage] = useState(true);
  const [yAxisScale, setYAxisScale] = useState<'linear' | 'log'>('linear');

  // 数据状态
  const [roiData, setRoiData] = useState<ROIRecord[]>([]);
  const [summaryStats, setSummaryStats] = useState<ROISummary['stats'] | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载筛选选项
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const response = await fetch('/api/filters');
        const result: APIResponse<FilterOptions> = await response.json();
        if (result.success && result.data) {
          setFilterOptions(result.data);

          // 设置默认值 - 默认加载最近90天数据以支持预测
          const data = result.data;
          const maxDate = new Date(data.dateRange.max);
          const minDate = new Date(maxDate);
          minDate.setDate(minDate.getDate() - 90);

          // 确保不超过数据范围
          const dataMinDate = new Date(data.dateRange.min);
          if (minDate < dataMinDate) {
            minDate.setTime(dataMinDate.getTime());
          }

          setFilters((prev) => ({
            ...prev,
            appKey: data.apps[0] || '',
            countryCode: data.countries[0] || '',
            bidType: data.bidTypes[0] || '',
            startDate: minDate.toISOString().split('T')[0],
            endDate: maxDate.toISOString().split('T')[0],
          }));
        }
      } catch (err) {
        console.error('Failed to load filter options:', err);
        setError('加载筛选选项失败');
      }
    };

    loadFilterOptions();
  }, []);

  // 加载ROI数据
  const loadROIData = useCallback(async () => {
    // 如果没有选择必要筛选项，不加载
    if (!filters.appKey) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.appKey) params.append('appKey', filters.appKey);
      if (filters.countryCode) params.append('countryCode', filters.countryCode);
      if (filters.bidType) params.append('bidType', filters.bidType);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await fetch(`/api/roi?${params.toString()}`);
      const result: APIResponse<ROIResponseData> = await response.json();

      if (result.success && result.data) {
        setRoiData(result.data.records);
        setSummaryStats(result.data.summary.stats);
      } else {
        setError(result.error || 'Failed to load data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // 筛选变化时重新加载数据
  useEffect(() => {
    loadROIData();
  }, [loadROIData]);

  // 处理筛选变化
  const handleFilterChange = (key: keyof FilterParams, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // 获取当前应用显示名称
  const currentAppName = filters.appKey || '全部应用';

  // 获取数据日期范围
  const dataDateRange = roiData.length > 0
    ? `${roiData[0]?.date} ~ ${roiData[roiData.length - 1]?.date}`
    : filters.startDate && filters.endDate
      ? `${filters.startDate} ~ ${filters.endDate}`
      : '';

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {currentAppName} - 多时间维度ROI趋势
          </h1>
          <p className="text-gray-600 mt-2">
            {showMovingAverage ? '(7日移动平均)' : '(原始数据)'}
          </p>
          {dataDateRange && (
            <p className="text-sm text-gray-500 mt-1">
              数据范围: {dataDateRange}
            </p>
          )}
        </div>

        {/* 数据导入链接 */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a
              href="/import"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              导入CSV数据
            </a>
            <span className="text-sm text-gray-500">
              或直接将CSV文件放入 data/ 目录后执行导入
            </span>
          </div>

          {/* 数据提示 */}
          <div className="text-sm text-gray-500">
            ROI数据使用 -1 作为默认值表示数据缺失，0 表示真实的 0% ROI
          </div>
        </div>

        {/* 筛选器 */}
        <FilterBar
          filters={filters}
          options={filterOptions}
          onChange={handleFilterChange}
        />

        {/* 控制器 */}
        <ControlBar
          showMovingAverage={showMovingAverage}
          yAxisScale={yAxisScale}
          onShowMChange={setShowMovingAverage}
          onScaleChange={setYAxisScale}
        />

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">错误: {error}</p>
          </div>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className="mb-6 p-4 text-center bg-white rounded-lg shadow">
            <div className="inline-flex items-center">
              <svg className="animate-spin h-5 w-5 text-blue-600 mr-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-gray-600">加载数据中...</span>
            </div>
          </div>
        )}

        {/* 图表区域 */}
        <ROIChart
          data={roiData}
          showMovingAverage={showMovingAverage}
          yAxisScale={yAxisScale}
          appName={currentAppName}
        />

        {/* 数据统计摘要 */}
        {roiData.length > 0 && (
          <div className="mt-6 p-4 bg-white rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">数据统计</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-500 block">总记录数</span>
                <span className="text-xl font-medium text-gray-900">{roiData.length}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-500 block">日期范围</span>
                <span className="text-sm font-medium text-gray-900">
                  {roiData[0]?.date} ~ {roiData[roiData.length - 1]?.date}
                </span>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-500 block">应用</span>
                <span className="text-lg font-medium text-gray-900">
                  {filters.appKey || '-'}
                </span>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-500 block">国家/地区</span>
                <span className="text-lg font-medium text-gray-900">
                  {filters.countryCode || '-'}
                </span>
              </div>
            </div>
            {/* 预测统计 */}
            {summaryStats && summaryStats.predictionCount ? (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="font-medium text-blue-900">预测数据</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-blue-600 block">预测数据点</span>
                    <span className="text-lg font-medium text-blue-800">{summaryStats.predictionCount}</span>
                  </div>
                  <div>
                    <span className="text-blue-600 block">历史数据参考</span>
                    <span className="text-lg font-medium text-blue-800">{summaryStats.historicalDataCount || 0} 条</span>
                  </div>
                  <div>
                    <span className="text-blue-600 block">预测方法</span>
                    <span className="text-sm font-medium text-blue-800">曲线模型拟合</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-blue-500">
                  预测数据显示为虚线，悬停查看详细信息
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
