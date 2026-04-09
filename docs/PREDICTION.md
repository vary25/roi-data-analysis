# ROI 预测方案说明

## 概述

当ROI数据缺失时（如日期不足或数据未更新），系统支持多种预测方案来补全数据。

## 预测方案详解

### 方案1: 生命周期曲线拟合（推荐）

**原理**：ROI随时间增长符合对数曲线规律：ROI(t) = a × ln(t+1) + c

**实现**：
```typescript
import { buildROICurveModel, predictWithCurveModel } from '@/lib/prediction';

// 建立曲线模型
const model = buildROICurveModel(historicalData, 'App-1', '美国', 'CPI');

// 预测day90的ROI
const prediction = predictWithCurveModel(model, currentRoi, 90);
// 返回: { value: 4.1381, method: 'curve_model', confidence: 'high' }
```

**优势**：
- 准确度最高
- 可以跨维度预测（用美国数据预测英国）
- 符合ROI增长的实际规律

**需要数据量**：至少10条历史记录

---

### 方案2: 比例系数推算

**原理**：基于历史数据建立短期到长期的倍数关系

**默认比例系数**：
| 参考周期 | day1 | day3 | day7 | day14 | day30 | day60 | day90 |
|----------|------|------|------|-------|-------|-------|-------|
| day0 | 2.1× | 4.0× | 9.5× | 18× | 32× | 55× | 62× |
| day1 | - | 1.9× | 4.5× | 8.6× | 15× | 26× | 30× |
| day7 | - | - | - | 1.9× | 3.4× | 5.8× | 6.5× |

**实现**：
```typescript
import { predictWithRatio, calibrateRatios } from '@/lib/prediction';

// 使用默认系数预测
const prediction = predictWithRatio(currentRoi, 90);

// 或使用自定义系数（基于你的历史数据校准）
const customRatios = calibrateRatios(historicalData);
const prediction2 = predictWithRatio(currentRoi, 90, customRatios);
```

**优势**：
- 实现简单
- 无需大量历史数据
- 计算速度快

---

### 方案3: 历史同期类比

**原理**：找到历史数据中日期相近的记录，取平均值

**适用场景**：
- 有季节性规律（如周末效应）
- 周期性变化明显

**实现**：
```typescript
import { predictWithHistoricalAverage } from '@/lib/prediction';

const prediction = predictWithHistoricalAverage(
  historicalData,
  new Date('2025-07-12'),
  90,
  3 // 前后3天的窗口
);
```

---

### 方案4: 线性回归外推

**原理**：基于已有数据点拟合线性趋势

**适用场景**：
- 趋势明显的数据
- 短期预测

**实现**：
```typescript
import { predictWithLinearRegression } from '@/lib/prediction';

const prediction = predictWithLinearRegression(currentRoi, 90);
```

**注意**：长期预测准确度会下降

---

### 方案5: 综合预测（自动选择最优方法）

**原理**：系统会自动选择最优的预测方法

**优先级**：
1. 曲线模型（准确度最高）
2. 历史同期类比
3. 比例系数
4. 线性回归（备选）

**实现**：
```typescript
import { predictROI, addPredictionsToRecord } from '@/lib/prediction';

// 单条预测
const result = predictROI(record, historicalData, 90);
// 返回: { value: 4.1381, method: 'curve_model', confidence: 'high' }

// 为整条记录添加所有预测值
const recordWithPredictions = addPredictionsToRecord(record, historicalData);
```

---

## 置信度说明

| 置信度 | 含义 | 适用场景 |
|--------|------|----------|
| **high** | 高准确度 | 有实际数据或曲线模型预测 |
| **medium** | 中等准确度 | 历史类比或比例系数预测 |
| **low** | 低准确度 | 线性回归外推，仅供参考 |

---

## 在图表中显示预测数据

### 方案1: 虚线显示预测部分

```typescript
// 区分实际数据和预测数据
const actualData = data.filter(d => !d.isPredicted);
const predictedData = data.filter(d => d.isPredicted);

// 实际数据用实线
<Line data={actualData} strokeDasharray="0" />

// 预测数据用虚线
<Line data={predictedData} strokeDasharray="5 5" />
```

### 方案2: 不同颜色显示

```typescript
// 高置信度用深色，低置信度用浅色
const getColor = (confidence: string) => {
  if (confidence === 'high') return '#1f77b4';   // 深蓝
  if (confidence === 'medium') return '#87ceeb'; // 浅蓝
  return '#d3d3d3'; // 灰色
};
```

### 方案3: 提示框显示预测信息

```typescript
const formatTooltip = (value: number, name: string, record: any) => {
  if (record.isPredicted) {
    return [`${(value * 100).toFixed(2)}% (预测)`, name];
  }
  return [`${(value * 100).toFixed(2)}%`, name];
};
```

---

## 实际应用建议

### 1. 预测数据存储

```typescript
// 在ROI表中添加预测标记
interface ROIRecord {
  // ... 原有字段
  isPredicted: boolean;           // 是否为预测数据
  predictionMethod?: string;      // 预测方法
  predictionConfidence?: string;  // 置信度
}
```

### 2. 预测数据更新策略

```typescript
// 当实际数据到达时，替换预测值
if (newData.date <= cutoffDate && record.isPredicted) {
  record.roi.day90 = newData.roiDay90;
  record.isPredicted = false;
}
```

### 3. 预测准确度评估

```typescript
// 定期对比预测值和实际值
const evaluatePrediction = (predicted: number, actual: number) => {
  const error = Math.abs(predicted - actual) / actual;
  return {
    accuracy: 1 - error,
    isAcceptable: error < 0.2, // 误差<20%可接受
  };
};
```

---

## 集成到API

在 `/api/roi/route.ts` 中添加预测功能：

```typescript
import { addPredictionsToRecord } from '@/lib/prediction';

// 获取历史数据用于预测
const historicalData = await prisma.rOIData.findMany({
  where: { appKey: filters.appKey },
  orderBy: { date: 'asc' },
});

// 为每条记录添加预测
const recordsWithPredictions = formattedRecords.map(r =>
  addPredictionsToRecord(r, historicalData)
);
```

---

## 注意事项

1. **预测仅供参考**：预测值不能替代实际数据，仅用于趋势判断
2. **定期校准**：随着数据积累，定期重新校准比例系数
3. **区分显示**：在UI上明确标记预测数据，避免误导
4. **业务波动**：特殊活动或节假日期间，预测准确度可能下降
