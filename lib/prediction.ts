import { ROIRecord, ROI_DIMENSIONS } from '@/types';

/**
 * 方案1: 生命周期曲线（LTV曲线）拟合预测
 *
 * 原理：ROI随时间呈S型增长曲线，可以使用对数或幂函数拟合
 * 公式：ROI(t) = a * ln(t + b) + c  或  ROI(t) = a * t^b + c
 *
 * 适用：有一定历史数据积累，可以建立应用/国家的ROI曲线模型
 */

interface ROICurveModel {
  appKey: string;
  countryCode: string;
  bidType: string;
  // 曲线参数: ROI(t) = a * ln(t + b) + c
  params: {
    a: number;  // 增长系数
    b: number;  // 时间偏移
    c: number;  // 基准值
  };
  // 各时间点的平均ROI倍数关系（相对于day0）
  ratios: Record<string, number>;
}

/**
 * 从历史数据建立ROI曲线模型
 */
export function buildROICurveModel(
  historicalData: ROIRecord[],
  appKey: string,
  countryCode: string,
  bidType: string
): ROICurveModel | null {
  // 筛选有效数据（排除null和0的异常值）
  const validData = historicalData.filter(r => {
    const roi = r.roi;
    return roi.day0 !== null && roi.day0 > 0;
  });

  if (validData.length < 10) {
    return null; // 数据不足
  }

  // 计算各时间点的平均ROI
  const avgRoi: Record<string, number> = {};
  const days = [0, 1, 3, 7, 14, 30, 60, 90];

  days.forEach(day => {
    const key = `day${day}` as keyof typeof ROI_DIMENSIONS[number];
    const values = validData
      .map(r => r.roi[key as keyof typeof r.roi])
      .filter((v): v is number => v !== null && v > 0);

    if (values.length > 0) {
      avgRoi[key] = values.reduce((a, b) => a + b, 0) / values.length;
    }
  });

  // 计算相对于day0的倍数关系
  const day0Avg = avgRoi['day0'];
  if (!day0Avg || day0Avg <= 0) return null;

  const ratios: Record<string, number> = {};
  Object.entries(avgRoi).forEach(([key, value]) => {
    ratios[key] = value / day0Avg;
  });

  // 使用最小二乘法拟合对数曲线: ROI(t) = a * ln(t + 1) + c
  // 简化为线性回归: y = a * x + c, 其中 x = ln(t + 1)
  const points = days
    .map(day => ({
      t: day,
      x: Math.log(day + 1),
      y: avgRoi[`day${day}`] || 0,
    }))
    .filter(p => p.y > 0);

  if (points.length < 3) return null;

  // 线性回归计算参数
  const n = points.length;
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0);

  const a = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const c = (sumY - a * sumX) / n;

  return {
    appKey,
    countryCode,
    bidType,
    params: { a, b: 1, c },
    ratios,
  };
}

/**
 * 使用曲线模型预测ROI
 */
export function predictWithCurveModel(
  model: ROICurveModel,
  currentRoi: Record<string, number | null>,
  targetDay: number
): number | null {
  // 如果有实际值，直接返回
  const dayKey = `day${targetDay}` as keyof typeof currentRoi;
  if (currentRoi[dayKey] !== null && currentRoi[dayKey] !== undefined) {
    return currentRoi[dayKey];
  }

  // 使用已有最短周期的数据进行预测
  const availableDays = [0, 1, 3, 7, 14, 30, 60, 90];
  let referenceDay: number | null = null;
  let referenceValue: number | null = null;

  for (const day of availableDays) {
    const key = `day${day}` as keyof typeof currentRoi;
    const value = currentRoi[key];
    if (value !== null && value !== undefined && value >= 0) {
      referenceDay = day;
      referenceValue = value;
      break; // 取最短周期作为参考
    }
  }

  if (referenceDay === null || referenceValue === null) {
    return null;
  }

  // 使用倍数关系预测
  const targetRatio = model.ratios[`day${targetDay}`];
  const referenceRatio = model.ratios[`day${referenceDay}`];

  if (!targetRatio || !referenceRatio || referenceRatio === 0) {
    return null;
  }

  // 预测值 = 参考值 × (目标倍数 / 参考倍数)
  const predictedValue = referenceValue * (targetRatio / referenceRatio);

  return Math.max(0, Number(predictedValue.toFixed(4)));
}

/**
 * 方案2: 简单比例系数预测
 *
 * 原理：基于历史数据，建立短期ROI到长期ROI的倍数关系
 * 例如：day7 ROI ≈ day1 ROI × 4.5
 *
 * 适用：数据量不足，但需要快速预测的场景
 */

// 默认比例系数（基于行业经验，应通过历史数据校准）
const DEFAULT_RATIOS: Record<string, Record<string, number>> = {
  // 从day0推算其他天数
  day0: { day0: 1, day1: 2.1, day3: 4.0, day7: 9.5, day14: 18, day30: 32, day60: 55, day90: 62 },
  // 从day1推算其他天数
  day1: { day1: 1, day3: 1.9, day7: 4.5, day14: 8.6, day30: 15, day60: 26, day90: 30 },
  // 从day7推算其他天数
  day7: { day7: 1, day14: 1.9, day30: 3.4, day60: 5.8, day90: 6.5 },
};

/**
 * 使用比例系数预测
 */
export function predictWithRatio(
  currentRoi: Record<string, number | null>,
  targetDay: number,
  customRatios?: Record<string, Record<string, number>>
): number | null {
  const ratios = customRatios || DEFAULT_RATIOS;

  // 找到最短的可用参考周期
  const referenceDays = ['day0', 'day1', 'day3', 'day7', 'day14', 'day30', 'day60'];

  for (const refDay of referenceDays) {
    const refValue = currentRoi[refDay as keyof typeof currentRoi];
    if (refValue !== null && refValue !== undefined && refValue >= 0) {
      const ratioMap = ratios[refDay];
      if (ratioMap) {
        const targetKey = `day${targetDay}`;
        const ratio = ratioMap[targetKey];
        if (ratio) {
          return Number((refValue * ratio).toFixed(4));
        }
      }
    }
  }

  return null;
}

/**
 * 方案3: 历史同期类比预测
 *
 * 原理：找到历史数据中日期相近的记录，取平均值作为预测
 * 适用：有季节性规律或周期性变化的业务
 */
export function predictWithHistoricalAverage(
  historicalData: ROIRecord[],
  targetDate: Date,
  targetDay: number,
  daysWindow: number = 3 // 前后3天的窗口
): number | null {
  const targetTime = targetDate.getTime();
  const windowMs = daysWindow * 24 * 60 * 60 * 1000;

  // 找到日期相近的历史记录
  const similarRecords = historicalData.filter(r => {
    const recordDate = new Date(r.date).getTime();
    const diff = Math.abs(recordDate - targetTime);
    return diff <= windowMs;
  });

  if (similarRecords.length < 3) {
    return null;
  }

  // 计算目标天数的平均ROI
  const dayKey = `day${targetDay}` as keyof ROIRecord['roi'];
  const values = similarRecords
    .map(r => r.roi[dayKey])
    .filter((v): v is number => v !== null && v > 0);

  if (values.length === 0) {
    return null;
  }

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Number(avg.toFixed(4));
}

/**
 * 方案4: 线性回归外推
 *
 * 原理：基于已有的短期数据点，拟合线性趋势并外推
 * 适用：趋势明显的数据，但长期预测准确度下降
 */
export function predictWithLinearRegression(
  currentRoi: Record<string, number | null>,
  targetDay: number
): number | null {
  // 收集可用数据点
  const points: { t: number; y: number }[] = [];
  const days = [0, 1, 3, 7, 14, 30, 60, 90];

  days.forEach(day => {
    const key = `day${day}` as keyof typeof currentRoi;
    const value = currentRoi[key];
    if (value !== null && value !== undefined && value >= 0) {
      points.push({ t: day, y: value });
    }
  });

  if (points.length < 2) {
    return null;
  }

  // 线性回归: y = at + b
  const n = points.length;
  const sumT = points.reduce((sum, p) => sum + p.t, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumTY = points.reduce((sum, p) => sum + p.t * p.y, 0);
  const sumTT = points.reduce((sum, p) => sum + p.t * p.t, 0);

  const denominator = n * sumTT - sumT * sumT;
  if (denominator === 0) {
    return null;
  }

  const a = (n * sumTY - sumT * sumY) / denominator;
  const b = (sumY - a * sumT) / n;

  // 预测
  const predicted = a * targetDay + b;
  return Math.max(0, Number(predicted.toFixed(4)));
}

/**
 * 方案5: 综合预测（结合多种方法）
 *
 * 优先使用准确度高的方法，备选其他方法
 */
export function predictROI(
  record: ROIRecord,
  historicalData: ROIRecord[],
  targetDay: number
): { value: number | null; method: string; confidence: 'high' | 'medium' | 'low' } {
  // 如果有实际值，直接返回
  const dayKey = `day${targetDay}` as keyof typeof record.roi;
  const actualValue = record.roi[dayKey];
  if (actualValue !== null && actualValue !== undefined) {
    return { value: actualValue, method: 'actual', confidence: 'high' };
  }

  // 方法1: 使用曲线模型（准确度最高）
  const model = buildROICurveModel(
    historicalData,
    record.appKey,
    record.countryCode,
    record.bidType
  );

  if (model) {
    const predicted = predictWithCurveModel(model, record.roi, targetDay);
    if (predicted !== null) {
      return { value: predicted, method: 'curve_model', confidence: 'high' };
    }
  }

  // 方法2: 历史同期类比
  const historicalPrediction = predictWithHistoricalAverage(
    historicalData,
    new Date(record.date),
    targetDay
  );

  if (historicalPrediction !== null) {
    return { value: historicalPrediction, method: 'historical_avg', confidence: 'medium' };
  }

  // 方法3: 比例系数预测
  const ratioPrediction = predictWithRatio(record.roi, targetDay);
  if (ratioPrediction !== null) {
    return { value: ratioPrediction, method: 'ratio', confidence: 'medium' };
  }

  // 方法4: 线性回归（作为最后备选）
  const linearPrediction = predictWithLinearRegression(record.roi, targetDay);
  if (linearPrediction !== null) {
    return { value: linearPrediction, method: 'linear', confidence: 'low' };
  }

  return { value: null, method: 'none', confidence: 'low' };
}

/**
 * 为数据记录添加预测值
 */
export function addPredictionsToRecord(
  record: ROIRecord,
  historicalData: ROIRecord[]
): ROIRecord {
  const predictedRoi: Record<string, number | null> = { ...record.roi };
  const predictionMethods: Record<string, string> = {};
  const predictionConfidence: Record<string, 'high' | 'medium' | 'low'> = {};

  const days = [0, 1, 3, 7, 14, 30, 60, 90];

  days.forEach(day => {
    const key = `day${day}`;
    if (predictedRoi[key] === null || predictedRoi[key] === undefined) {
      const prediction = predictROI(record, historicalData, day);
      if (prediction.value !== null) {
        predictedRoi[key] = prediction.value;
        predictionMethods[key] = prediction.method;
        predictionConfidence[key] = prediction.confidence;
      }
    }
  });

  return {
    ...record,
    roi: predictedRoi as typeof record.roi,
    // 添加预测元数据（可以通过扩展类型来存储）
    // @ts-ignore
    predictions: {
      methods: predictionMethods,
      confidence: predictionConfidence,
    },
  };
}

/**
 * 校准比例系数
 * 基于历史数据生成更准确的比例系数
 */
export function calibrateRatios(historicalData: ROIRecord[]): Record<string, Record<string, number>> {
  const calibrated: Record<string, Record<string, number>> = {};

  const referenceDays = ['day0', 'day1', 'day7'];
  const targetDays = [0, 1, 3, 7, 14, 30, 60, 90];

  referenceDays.forEach(refDay => {
    calibrated[refDay] = {};

    // 筛选有参考值的数据
    const validRecords = historicalData.filter(r => {
      const refValue = r.roi[refDay as keyof typeof r.roi];
      return refValue !== null && refValue !== undefined && refValue > 0;
    });

    if (validRecords.length < 5) return;

    targetDays.forEach(targetDay => {
      const targetKey = `day${targetDay}`;

      // 计算平均倍数
      const ratios: number[] = [];
      validRecords.forEach(r => {
        const refValue = r.roi[refDay as keyof typeof r.roi] as number;
        const targetValue = r.roi[targetKey as keyof typeof r.roi];
        if (targetValue !== null && targetValue !== undefined && targetValue > 0) {
          ratios.push(targetValue / refValue);
        }
      });

      if (ratios.length > 0) {
        const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
        calibrated[refDay][targetKey] = Number(avgRatio.toFixed(2));
      }
    });
  });

  return calibrated;
}
