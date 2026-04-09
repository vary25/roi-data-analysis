'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { ROIRecord, ROI_COLORS, ROI_DIMENSIONS } from '@/types';

interface ROIChartProps {
  data: ROIRecord[];
  showMovingAverage: boolean;
  yAxisScale: 'linear' | 'log';
  appName: string;
}

interface ChartDataPoint {
  date: string;
  _predicted?: Record<string, boolean>;
  [key: string]: string | number | null | boolean | Record<string, boolean> | undefined;
}

export default function ROIChart({
  data,
  showMovingAverage,
  yAxisScale,
  appName,
}: ROIChartProps) {
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());

  // 当显示模式或刻度变化时，重置隐藏的线
  useEffect(() => {
    setHiddenLines(new Set());
  }, [showMovingAverage, yAxisScale]);

  // 准备图表数据 - 对数刻度时需要过滤掉0值
  const chartData: ChartDataPoint[] = useMemo(() => {
    return data.map((record) => {
      const point: ChartDataPoint = {
        date: record.date,
        _predicted: record.predictedFlags || {}
      };

      ROI_DIMENSIONS.forEach((dim) => {
        const key = dim.key;
        const maKey = `${key}_ma`;
        const realKey = `${key}_real`;  // 真实数据列
        const predKey = `${key}_pred`;  // 预测数据列

        let value: number | null;
        if (showMovingAverage && record.movingAverage) {
          value = record.movingAverage[key as keyof typeof record.movingAverage] ?? null;
        } else {
          value = record.roi[key as keyof typeof record.roi] ?? null;
        }

        // 对数刻度时，将0值转为null（否则Recharts会报错）
        if (yAxisScale === 'log' && value !== null && value <= 0) {
          value = null;
        }

        // 分离真实数据和预测数据到不同列
        const isPredicted = record.predictedFlags?.[key];
        if (showMovingAverage && record.movingAverage) {
          point[maKey] = value;
          // 同时创建分离的列
          point[realKey] = isPredicted ? null : value;
          point[predKey] = isPredicted ? value : null;
        } else {
          point[key] = value;
          // 同时创建分离的列
          point[realKey] = isPredicted ? null : value;
          point[predKey] = isPredicted ? value : null;
        }
      });

      return point;
    });
  }, [data, showMovingAverage, yAxisScale]);

  // 处理图例点击
  const handleLegendClick = (o: any) => {
    const { dataKey } = o;
    const newHidden = new Set(hiddenLines);
    if (newHidden.has(dataKey)) {
      newHidden.delete(dataKey);
    } else {
      newHidden.add(dataKey);
    }
    setHiddenLines(newHidden);
  };

  // 格式化提示框内容
  const formatTooltip = (value: number, name: string, props: any) => {
    if (value === null || value === undefined) return ['数据缺失', name];

    // 检查是否为预测数据（通过数据列名称或_predicted标记）
    const dataKey = props.dataKey;
    // 如果是 _pred 结尾的列，则为预测数据
    const isPredColumn = dataKey?.endsWith('_pred');
    const isRealColumn = dataKey?.endsWith('_real');

    // 提取基础维度键
    let baseKey = dataKey;
    if (isPredColumn || isRealColumn) {
      baseKey = dataKey.replace(/_(pred|real)$/, '');
    } else if (dataKey?.endsWith('_ma')) {
      baseKey = dataKey.replace('_ma', '');
    }

    // 判断是否预测：通过列名或_predicted标记
    const isPredicted = isPredColumn || props.payload?._predicted?.[baseKey];

    const percent = (value * 100).toFixed(2);
    // 如果 name 已经包含 "(预测)"，不再重复添加
    const label = isPredicted && !name?.includes('(预测)')
      ? `${percent}% (预测)`
      : `${percent}%`;

    return [label, name];
  };

  // Y轴刻度格式化
  const formatYAxis = (value: number) => {
    if (value === null) return '';
    return `${(value * 100).toFixed(0)}%`;
  };

  // 确定Y轴范围
  const yDomain = useMemo(() => {
    if (yAxisScale === 'log') {
      return [0.01, 'auto'] as [number, string]; // 对数刻度最小值不能为0
    }
    return [0, 'auto'] as [number, string];
  }, [yAxisScale]);

  if (data.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center text-gray-500 bg-white rounded-lg shadow">
        <div className="text-center">
          <p className="text-lg mb-2">暂无数据</p>
          <p className="text-sm text-gray-400">请导入CSV数据文件或选择筛选条件</p>
        </div>
      </div>
    );
  }

  // 获取当前筛选信息
  const firstRecord = data[0];
  const countryInfo = firstRecord?.countryCode || '';
  const bidTypeInfo = firstRecord?.bidType || '';

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow">
      {/* 筛选信息 */}
      <div className="mb-4 flex items-center gap-4 text-sm text-gray-500">
        {countryInfo && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            国家/地区: {countryInfo}
          </span>
        )}
        {bidTypeInfo && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            出价类型: {bidTypeInfo}
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
          {showMovingAverage ? '7日移动平均' : '原始数据'}
        </span>
      </div>

      {/* 图表区域 */}
      <div className="h-[500px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
              interval="preserveStartEnd"
            />
            <YAxis
              scale={yAxisScale}
              domain={yDomain}
              tickFormatter={formatYAxis}
              tick={{ fontSize: 12 }}
              label={{ value: 'ROI (%)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              formatter={formatTooltip}
              labelStyle={{ color: '#333', fontWeight: 'bold' }}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '8px',
              }}
            />
            <Legend
              onClick={handleLegendClick}
              wrapperStyle={{ paddingTop: '20px' }}
            />

            {/* 100%回本线 */}
            <ReferenceLine
              y={1}
              stroke="#ff0000"
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{
                value: '100%回本线',
                position: 'right',
                fill: '#ff0000',
                fontSize: 12,
              }}
            />

            {/* ROI数据线 */}
            {ROI_DIMENSIONS.map((dim) => {
              const baseKey = dim.key;
              const dataKey = showMovingAverage ? `${baseKey}_ma` : baseKey;
              const realKey = `${baseKey}_real`;
              const predKey = `${baseKey}_pred`;
              const isHidden = hiddenLines.has(dataKey);
              const displayLabel = showMovingAverage
                ? `${dim.label}ROI(7日均值)`
                : `${dim.label}ROI`;

              // 判断这条线是否包含预测数据
              const hasPrediction = chartData.some(
                (d) => d._predicted?.[baseKey] && d[dataKey] !== null
              );

              // 判断这条线是否包含真实数据
              const hasRealData = chartData.some(
                (d) => !d._predicted?.[baseKey] && d[dataKey] !== null
              );

              return (
                <>
                  {/* 真实数据线（实线） */}
                  {hasRealData && (
                    <Line
                      key={`${dataKey}_real`}
                      type="monotone"
                      dataKey={realKey}
                      stroke={ROI_COLORS[baseKey]}
                      strokeWidth={2}
                      dot={false}
                      name={displayLabel}
                      hide={isHidden}
                      connectNulls={false}
                    />
                  )}
                  {/* 预测数据线（虚线） */}
                  {hasPrediction && (
                    <Line
                      key={`${dataKey}_pred`}
                      type="monotone"
                      dataKey={predKey}
                      stroke={ROI_COLORS[baseKey]}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name={`${displayLabel}(预测)`}
                      hide={isHidden}
                      connectNulls={false}
                    />
                  )}
                </>
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 数据说明 */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
        <p>
          <strong>数据说明：</strong>
          -1 表示数据缺失（日期不足）；
          0 表示真实的 0% ROI；
          如果短周期ROI &gt; 0 但长周期为0，则长周期标记为未更新。
          {yAxisScale === 'log' && ' 对数刻度下，0% 数据点不显示。'}
        </p>
      </div>
    </div>
  );
}
