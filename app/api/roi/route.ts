import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateMovingAverage, classifyROIValue } from '@/lib/dataProcessing';
import { predictROI } from '@/lib/prediction';
import { FilterParams, ROIRecord } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // 解析查询参数（字符串维度）
    const filters: FilterParams = {
      appKey: searchParams.get('appKey') || undefined,
      countryCode: searchParams.get('countryCode') || undefined,
      bidType: searchParams.get('bidType') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    };

    // 构建查询条件
    const where: any = {};

    if (filters.appKey) {
      where.appKey = filters.appKey;
    }

    if (filters.countryCode) {
      where.countryCode = filters.countryCode;
    }

    if (filters.bidType) {
      where.bidType = filters.bidType;
    }

    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) {
        where.date.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.date.lte = new Date(filters.endDate);
      }
    }

    // 查询数据（简化版，无关联表）
    const records = await prisma.rOIData.findMany({
      where,
      orderBy: { date: 'asc' },
      include: {
        app: true,  // 可选关联
      },
    });

    if (records.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          records: [],
          summary: {
            total: 0,
            dateRange: { start: '', end: '' },
          },
        },
      });
    }

    // 查询历史数据用于预测（查询当前数据日期之前的历史数据，最多90天）
    let historicalData: typeof records = [];
    if (filters.appKey && records.length > 0) {
      const earliestDate = new Date(records[0].date);
      const historicalStartDate = new Date(earliestDate);
      historicalStartDate.setDate(historicalStartDate.getDate() - 90); // 最多查90天历史

      historicalData = await prisma.rOIData.findMany({
        where: {
          appKey: filters.appKey,
          countryCode: filters.countryCode || undefined,
          bidType: filters.bidType || undefined,
          date: {
            gte: historicalStartDate,
            lt: earliestDate,
          },
        },
        orderBy: { date: 'asc' },
        include: {
          app: true,
        },
      });
    }

    // 转换历史数据格式
    let historicalFormatted = historicalData.map(r => {
      const rawRoi = {
        day0: r.roiDay0,
        day1: r.roiDay1,
        day3: r.roiDay3,
        day7: r.roiDay7,
        day14: r.roiDay14,
        day30: r.roiDay30,
        day60: r.roiDay60,
        day90: r.roiDay90,
      };

      // 处理异常0值
      const processedRoi = { ...rawRoi };
      const roiValues = [
        { key: 'day0', value: rawRoi.day0 },
        { key: 'day1', value: rawRoi.day1 },
        { key: 'day3', value: rawRoi.day3 },
        { key: 'day7', value: rawRoi.day7 },
        { key: 'day14', value: rawRoi.day14 },
        { key: 'day30', value: rawRoi.day30 },
        { key: 'day60', value: rawRoi.day60 },
        { key: 'day90', value: rawRoi.day90 },
      ];

      for (let i = 0; i < roiValues.length; i++) {
        const current = roiValues[i];
        if (current.value === 0) {
          const hasPositiveBefore = roiValues.slice(0, i).some(
            v => v.value !== null && v.value !== undefined && v.value > 0
          );
          if (hasPositiveBefore) {
            processedRoi[current.key as keyof typeof processedRoi] = -1;
          }
        }
      }

      return {
        id: Number(r.id),
        date: r.date.toISOString().split('T')[0],
        appKey: r.appKey,
        countryCode: r.countryCode,
        bidType: r.bidType,
        installs: r.installs,
        roi: {
          day0: processedRoi.day0 === -1 ? null : processedRoi.day0,
          day1: processedRoi.day1 === -1 ? null : processedRoi.day1,
          day3: processedRoi.day3 === -1 ? null : processedRoi.day3,
          day7: processedRoi.day7 === -1 ? null : processedRoi.day7,
          day14: processedRoi.day14 === -1 ? null : processedRoi.day14,
          day30: processedRoi.day30 === -1 ? null : processedRoi.day30,
          day60: processedRoi.day60 === -1 ? null : processedRoi.day60,
          day90: processedRoi.day90 === -1 ? null : processedRoi.day90,
        },
        dataStatus: {
          day0: classifyROIValue(processedRoi.day0),
          day1: classifyROIValue(processedRoi.day1),
          day3: classifyROIValue(processedRoi.day3),
          day7: classifyROIValue(processedRoi.day7),
          day14: classifyROIValue(processedRoi.day14),
          day30: classifyROIValue(processedRoi.day30),
          day60: classifyROIValue(processedRoi.day60),
          day90: classifyROIValue(processedRoi.day90),
        },
        dataSource: r.dataSource,
      };
    });

    // 如果没有外部历史数据，使用当前数据的前30%作为历史参考（用于预测后面的数据）
    const useInternalHistory = historicalFormatted.length < 10 && records.length > 30;
    if (useInternalHistory) {
      const historyCount = Math.floor(records.length * 0.3);
      const internalHistory = records.slice(0, historyCount);

      historicalFormatted = internalHistory.map(r => {
        const rawRoi = {
          day0: r.roiDay0,
          day1: r.roiDay1,
          day3: r.roiDay3,
          day7: r.roiDay7,
          day14: r.roiDay14,
          day30: r.roiDay30,
          day60: r.roiDay60,
          day90: r.roiDay90,
        };

        const processedRoi = { ...rawRoi };
        const roiValues = [
          { key: 'day0', value: rawRoi.day0 },
          { key: 'day1', value: rawRoi.day1 },
          { key: 'day3', value: rawRoi.day3 },
          { key: 'day7', value: rawRoi.day7 },
          { key: 'day14', value: rawRoi.day14 },
          { key: 'day30', value: rawRoi.day30 },
          { key: 'day60', value: rawRoi.day60 },
          { key: 'day90', value: rawRoi.day90 },
        ];

        for (let i = 0; i < roiValues.length; i++) {
          const current = roiValues[i];
          if (current.value === 0) {
            const hasPositiveBefore = roiValues.slice(0, i).some(
              v => v.value !== null && v.value !== undefined && v.value > 0
            );
            if (hasPositiveBefore) {
              processedRoi[current.key as keyof typeof processedRoi] = -1;
            }
          }
        }

        return {
          id: Number(r.id),
          date: r.date.toISOString().split('T')[0],
          appKey: r.appKey,
          countryCode: r.countryCode,
          bidType: r.bidType,
          installs: r.installs,
          roi: {
            day0: processedRoi.day0 === -1 ? null : processedRoi.day0,
            day1: processedRoi.day1 === -1 ? null : processedRoi.day1,
            day3: processedRoi.day3 === -1 ? null : processedRoi.day3,
            day7: processedRoi.day7 === -1 ? null : processedRoi.day7,
            day14: processedRoi.day14 === -1 ? null : processedRoi.day14,
            day30: processedRoi.day30 === -1 ? null : processedRoi.day30,
            day60: processedRoi.day60 === -1 ? null : processedRoi.day60,
            day90: processedRoi.day90 === -1 ? null : processedRoi.day90,
          },
          dataStatus: {
            day0: classifyROIValue(processedRoi.day0),
            day1: classifyROIValue(processedRoi.day1),
            day3: classifyROIValue(processedRoi.day3),
            day7: classifyROIValue(processedRoi.day7),
            day14: classifyROIValue(processedRoi.day14),
            day30: classifyROIValue(processedRoi.day30),
            day60: classifyROIValue(processedRoi.day60),
            day90: classifyROIValue(processedRoi.day90),
          },
          dataSource: r.dataSource,
        };
      });
    }

    // 转换数据格式（处理异常0值，并生成预测）
    const formattedRecords = records.map(r => {
      // 原始ROI值
      const rawRoi = {
        day0: r.roiDay0,
        day1: r.roiDay1,
        day3: r.roiDay3,
        day7: r.roiDay7,
        day14: r.roiDay14,
        day30: r.roiDay30,
        day60: r.roiDay60,
        day90: r.roiDay90,
      };

      // 处理异常0值：如果短周期 > 0 但长周期 === 0，则长周期可能是未更新
      const processedRoi = { ...rawRoi };
      const roiValues = [
        { key: 'day0', value: rawRoi.day0 },
        { key: 'day1', value: rawRoi.day1 },
        { key: 'day3', value: rawRoi.day3 },
        { key: 'day7', value: rawRoi.day7 },
        { key: 'day14', value: rawRoi.day14 },
        { key: 'day30', value: rawRoi.day30 },
        { key: 'day60', value: rawRoi.day60 },
        { key: 'day90', value: rawRoi.day90 },
      ];

      // 检查每个0值：如果前面有任何有效的正值，则此0可能是未更新
      for (let i = 0; i < roiValues.length; i++) {
        const current = roiValues[i];
        if (current.value === 0) {
          // 检查前面是否有大于0的值
          const hasPositiveBefore = roiValues.slice(0, i).some(
            v => v.value !== null && v.value !== undefined && v.value > 0
          );
          if (hasPositiveBefore) {
            // 标记为 -1（数据缺失）
            processedRoi[current.key as keyof typeof processedRoi] = -1;
          }
        }
      }

      // 构建基础记录（用于预测）
      const baseRecord = {
        id: Number(r.id),
        date: r.date.toISOString().split('T')[0],
        appKey: r.appKey,
        countryCode: r.countryCode,
        bidType: r.bidType,
        installs: r.installs,
        // ROI数据（-1转为null）
        roi: {
          day0: processedRoi.day0 === -1 ? null : processedRoi.day0,
          day1: processedRoi.day1 === -1 ? null : processedRoi.day1,
          day3: processedRoi.day3 === -1 ? null : processedRoi.day3,
          day7: processedRoi.day7 === -1 ? null : processedRoi.day7,
          day14: processedRoi.day14 === -1 ? null : processedRoi.day14,
          day30: processedRoi.day30 === -1 ? null : processedRoi.day30,
          day60: processedRoi.day60 === -1 ? null : processedRoi.day60,
          day90: processedRoi.day90 === -1 ? null : processedRoi.day90,
        },
        dataStatus: {
          day0: classifyROIValue(processedRoi.day0),
          day1: classifyROIValue(processedRoi.day1),
          day3: classifyROIValue(processedRoi.day3),
          day7: classifyROIValue(processedRoi.day7),
          day14: classifyROIValue(processedRoi.day14),
          day30: classifyROIValue(processedRoi.day30),
          day60: classifyROIValue(processedRoi.day60),
          day90: classifyROIValue(processedRoi.day90),
        },
        dataSource: r.dataSource,
      };

      // 生成预测值（基于历史数据）
      const predictedRoi = { ...baseRecord.roi };
      const predictedFlags: Record<string, boolean> = {};
      const predictionMethods: Record<string, string> = {};
      const days = [0, 1, 3, 7, 14, 30, 60, 90];

      // 只有当有历史数据时才进行预测
      if (historicalFormatted.length > 0) {
        days.forEach(day => {
          const key = `day${day}`;
          // 只对缺失值进行预测
          if (predictedRoi[key as keyof typeof predictedRoi] === null) {
            const prediction = predictROI(baseRecord, historicalFormatted, day);
            if (prediction.value !== null) {
              predictedRoi[key as keyof typeof predictedRoi] = prediction.value;
              predictedFlags[key] = true;
              predictionMethods[key] = `${prediction.method} (${prediction.confidence})`;
            }
          }
        });

        // **修正：确保预测值满足单调递增约束**
        // ROI应该随时间递增：day0 <= day1 <= day3 <= day7 <= day14 <= day30 <= day60 <= day90
        const dayKeys = ['day0', 'day1', 'day3', 'day7', 'day14', 'day30', 'day60', 'day90'];
        let maxSoFar: number | null = null;

        // 正向遍历：确保每个值不小于前一个值
        for (const key of dayKeys) {
          const currentValue = predictedRoi[key as keyof typeof predictedRoi];
          if (currentValue !== null) {
            if (maxSoFar !== null && currentValue < maxSoFar) {
              // 当前值小于之前的最大值，需要修正
              predictedRoi[key as keyof typeof predictedRoi] = maxSoFar;
            } else {
              maxSoFar = currentValue;
            }
          }
        }
      }

      // 额外：对每个维度，如果历史记录中有真实值，则使用历史数据作为"真实数据"参考
      // 这样可以在图表上显示从真实数据到预测数据的过渡
      const enhancedPredictedFlags = { ...predictedFlags };
      const enhancedPredictionMethods = { ...predictionMethods };

      // 计算每个维度在查询窗口内有多少真实值
      days.forEach(day => {
        const key = `day${day}`;
        if (predictedRoi[key as keyof typeof predictedRoi] !== null) {
          // 检查这个值是真实的还是预测的
          const isPredicted = predictedFlags[key];
          if (isPredicted) {
            // 这是一个预测值，标记它
            enhancedPredictionMethods[key] = predictionMethods[key] || '预测';
          }
        }
      });

      return {
        ...baseRecord,
        roi: predictedRoi,
        predictedFlags: enhancedPredictedFlags as ROIRecord['predictedFlags'],
        predictionMethods: Object.keys(enhancedPredictionMethods).length > 0 ? enhancedPredictionMethods : undefined,
      } as ROIRecord;
    });

    // 计算移动平均
    const recordsWithMA = calculateMovingAverage(formattedRecords, 7);

    // 生成摘要
    const dateRange = {
      start: formattedRecords[0]?.date || '',
      end: formattedRecords[formattedRecords.length - 1]?.date || '',
    };

    // 计算统计信息
    const predictionCount = formattedRecords.reduce(
      (sum, r) => sum + Object.keys(r.predictedFlags || {}).length,
      0
    );

    const stats = {
      totalInstalls: records.reduce((sum, r) => sum + r.installs, 0),
      predictionCount,
      historicalDataCount: historicalFormatted.length,
    };

    return NextResponse.json({
      success: true,
      data: {
        records: recordsWithMA,
        summary: {
          total: records.length,
          dateRange,
          stats,
        },
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch ROI data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
