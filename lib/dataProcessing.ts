import { ROIRecord, ROI_DIMENSIONS } from '@/types';

/**
 * 计算7日移动平均
 * @param data 原始数据数组
 * @param windowSize 窗口大小（默认7）
 * @returns 包含移动平均的数据
 */
export function calculateMovingAverage(
  data: ROIRecord[],
  windowSize: number = 7
): ROIRecord[] {
  if (data.length < windowSize) {
    return data.map(d => ({
      ...d,
      movingAverage: {
        day0: null,
        day1: null,
        day3: null,
        day7: null,
        day14: null,
        day30: null,
        day60: null,
        day90: null,
      },
    }));
  }

  const result: ROIRecord[] = [];

  for (let i = 0; i < data.length; i++) {
    const ma: Record<string, number | null> = {};

    ROI_DIMENSIONS.forEach(dim => {
      const key = dim.key;

      if (i < windowSize - 1) {
        // 前windowSize-1天数据不足
        ma[key] = null;
      } else {
        // 计算窗口内平均值（只计算有效值，-1/null表示缺失）
        const window = data.slice(i - windowSize + 1, i + 1);
        const values = window
          .map(d => d.roi[key as keyof typeof d.roi])
          .filter((v): v is number => v !== null && v !== undefined && v !== -1);

        if (values.length === 0) {
          ma[key] = null;
        } else {
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          ma[key] = Number(avg.toFixed(4));
        }
      }
    });

    result.push({
      ...data[i],
      movingAverage: {
        day0: ma.day0 ?? null,
        day1: ma.day1 ?? null,
        day3: ma.day3 ?? null,
        day7: ma.day7 ?? null,
        day14: ma.day14 ?? null,
        day30: ma.day30 ?? null,
        day60: ma.day60 ?? null,
        day90: ma.day90 ?? null,
      },
    });
  }

  return result;
}

/**
 * 判断ROI数据状态
 * @param value ROI值（-1表示缺失）
 */
export function classifyROIValue(value: number | null): 'valid' | 'missing' | 'real_zero' {
  if (value === null || value === -1) return 'missing';
  if (value === 0) return 'real_zero';
  return 'valid';
}

/**
 * 格式化百分比显示
 * @param value 小数形式（如0.0679）
 * @returns 百分比字符串（如"6.79%"）
 */
export function formatPercent(value: number | null): string {
  if (value === null || value === undefined || value === -1) return '-';
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * 解析CSV中的百分比字符串
 * 处理千分位逗号，如 "1,280.47%"
 * @param value 百分比字符串
 * @param daysToEnd 距离截止日期天数
 * @param periodDays ROI周期天数
 * @returns 小数形式（如0.0679）或 -1
 */
export function parsePercent(
  value: string,
  daysToEnd: number,
  periodDays: number
): number {
  // 如果日期不足，返回 -1
  if (daysToEnd < periodDays) {
    return -1;
  }

  // 数据为空
  if (!value || value === '-' || value === '') {
    return -1;
  }

  // 处理0%
  if (value === '0%') return 0;

  // 处理百分比格式（移除千分位逗号）
  const cleanValue = value.replace(/,/g, '');
  const match = cleanValue.match(/^([\d.]+)%$/);
  if (match) {
    return parseFloat(match[1]) / 100;
  }

  return -1;
}

/**
 * 过滤有效的ROI数据（排除 -1）
 * @param data ROI数据数组
 * @returns 有效数据
 */
export function filterValidData(data: (number | null)[]): number[] {
  return data.filter((v): v is number =>
    v !== null && v !== undefined && v !== -1
  );
}

/**
 * 计算ROI统计信息
 * @param values ROI值数组
 */
export function calculateStats(values: (number | null)[]) {
  const validData = filterValidData(values);

  if (validData.length === 0) {
    return {
      count: 0,
      min: null,
      max: null,
      avg: null,
      median: null,
    };
  }

  const sorted = [...validData].sort((a, b) => a - b);
  const sum = validData.reduce((a, b) => a + b, 0);
  const avg = sum / validData.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  return {
    count: validData.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Number(avg.toFixed(4)),
    median: Number(median.toFixed(4)),
  };
}

/**
 * 预测ROI数据（简单线性回归）
 * 只对有效数据进行预测
 * @param historicalData 历史数据（已过滤-1）
 * @param daysToPredict 预测天数
 */
export function predictROI(
  historicalData: number[],
  daysToPredict: number = 7
): number[] {
  // 过滤 -1 值
  const validData = historicalData.filter(v => v !== null && v !== undefined && v !== -1);
  const n = validData.length;

  if (n < 2) {
    return Array(daysToPredict).fill(validData[0] ?? 0);
  }

  const x = Array.from({ length: n }, (_, i) => i);
  const y = validData;

  // 简单线性回归: y = ax + b
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
  const sumXX = x.reduce((total, xi) => total + xi * xi, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) {
    return Array(daysToPredict).fill(sumY / n);
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // 生成预测值
  const predictions: number[] = [];
  for (let i = 0; i < daysToPredict; i++) {
    const predictedValue = slope * (n + i) + intercept;
    predictions.push(Math.max(0, Number(predictedValue.toFixed(4))));
  }

  return predictions;
}
