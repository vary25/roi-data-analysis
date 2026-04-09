/**
 * 应用信息
 */
export interface App {
  id: number;
  appKey: string;
  appName: string;
  platform: string;
  appIcon?: string;
  url?: string;
}

/**
 * ROI数据记录（简化版）
 * 使用 -1 表示数据缺失，0 表示真实0%
 */
export interface ROIRecord {
  id: number;
  date: string;

  // 维度字段（字符串类型，直接存储）
  appKey: string;           // 应用标识，如：App-1
  countryCode: string;      // 国家名称，如：美国、英国
  bidType: string;          // 出价类型，如：CPI

  // 基础数据
  installs: number;         // 安装次数

  // ROI数据（8个时间维度，null表示缺失/日期不足，0表示真实0%）
  roi: {
    day0: number | null;
    day1: number | null;
    day3: number | null;
    day7: number | null;
    day14: number | null;
    day30: number | null;
    day60: number | null;
    day90: number | null;
  };

  // 7日移动平均
  movingAverage?: {
    day0: number | null;
    day1: number | null;
    day3: number | null;
    day7: number | null;
    day14: number | null;
    day30: number | null;
    day60: number | null;
    day90: number | null;
  };

  // 数据状态：valid-有效，missing-缺失，real_zero-真实0%
  dataStatus: {
    day0: 'valid' | 'missing' | 'real_zero';
    day1: 'valid' | 'missing' | 'real_zero';
    day3: 'valid' | 'missing' | 'real_zero';
    day7: 'valid' | 'missing' | 'real_zero';
    day14: 'valid' | 'missing' | 'real_zero';
    day30: 'valid' | 'missing' | 'real_zero';
    day60: 'valid' | 'missing' | 'real_zero';
    day90: 'valid' | 'missing' | 'real_zero';
  };

  // 预测标记：true表示该维度是预测值
  predictedFlags?: {
    day0: boolean;
    day1: boolean;
    day3: boolean;
    day7: boolean;
    day14: boolean;
    day30: boolean;
    day60: boolean;
    day90: boolean;
  };

  // 预测方法说明
  predictionMethods?: {
    day0?: string;
    day1?: string;
    day3?: string;
    day7?: string;
    day14?: string;
    day30?: string;
    day60?: string;
    day90?: string;
  };

  dataSource: string;
}

/**
 * 筛选参数（使用字符串维度）
 */
export interface FilterParams {
  appKey?: string;          // 应用标识
  countryCode?: string;     // 国家代码
  bidType?: string;         // 出价类型
  startDate?: string;       // 开始日期
  endDate?: string;         // 结束日期
}

/**
 * 筛选选项
 */
export interface FilterOptions {
  apps: string[];           // 应用标识列表
  countries: string[];      // 国家列表
  bidTypes: string[];       // 出价类型列表
  dateRange: {
    min: string;
    max: string;
  };
}

/**
 * API响应
 */
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 显示模式
 */
export type DisplayMode = 'raw' | 'ma';

/**
 * Y轴刻度类型
 */
export type ScaleType = 'linear' | 'log';

/**
 * ROI维度定义
 */
export const ROI_DIMENSIONS = [
  { key: 'day0', label: '当日', days: 0 },
  { key: 'day1', label: '1日', days: 1 },
  { key: 'day3', label: '3日', days: 3 },
  { key: 'day7', label: '7日', days: 7 },
  { key: 'day14', label: '14日', days: 14 },
  { key: 'day30', label: '30日', days: 30 },
  { key: 'day60', label: '60日', days: 60 },
  { key: 'day90', label: '90日', days: 90 },
] as const;

/**
 * ROI维度颜色映射
 */
export const ROI_COLORS: Record<string, string> = {
  day0: '#1f77b4',
  day1: '#ff7f0e',
  day3: '#2ca02c',
  day7: '#d62728',
  day14: '#9467bd',
  day30: '#8c564b',
  day60: '#e377c2',
  day90: '#7f7f7f',
};

/**
 * 数据状态文本
 */
export const DATA_STATUS_TEXT: Record<string, string> = {
  valid: '有效',
  missing: '数据缺失',
  real_zero: '实际为0%',
};

/**
 * CSV导入结果
 */
export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * ROI数据摘要
 */
export interface ROISummary {
  total: number;
  dateRange: {
    start: string;
    end: string;
  };
  stats?: {
    totalInstalls?: number;
    predictionCount?: number;
    historicalDataCount?: number;
  };
}

/**
 * ROI数据响应
 */
export interface ROIResponseData {
  records: ROIRecord[];
  summary: ROISummary;
}
