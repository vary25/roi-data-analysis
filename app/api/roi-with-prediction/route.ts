import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateMovingAverage, classifyROIValue } from '@/lib/dataProcessing';
import { predictROI, addPredictionsToRecord } from '@/lib/prediction';
import { FilterParams } from '@/types';

// 标记为动态路由，避免静态生成警告
export const dynamic = 'force-dynamic';

/**
 * ROI数据查询API（带预测功能）
 *
 * 新增参数:
 * - includePredictions: 是否包含预测数据 (true/false)
 * - predictionDays: 需要预测的天数，如 "60,90"
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // 解析查询参数
    const filters: FilterParams = {
      appKey: searchParams.get('appKey') || undefined,
      countryCode: searchParams.get('countryCode') || undefined,
      bidType: searchParams.get('bidType') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    };

    // 是否包含预测
    const includePredictions = searchParams.get('includePredictions') === 'true';

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

    // 查询当前筛选的数据
    const records = await prisma.rOIData.findMany({
      where,
      orderBy: { date: 'asc' },
      include: {
        app: true,
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
            predictions: 0,
          },
        },
      });
    }

    // 如果需要预测，查询历史数据
    let historicalData: typeof records = [];
    if (includePredictions && filters.appKey) {
      historicalData = await prisma.rOIData.findMany({
        where: {
          appKey: filters.appKey,
          date: {
            lt: new Date(records[0].date),
          },
        },
        orderBy: { date: 'asc' },
        include: { app: true },
      });
    }

    // 转换数据格式
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
        isPredicted: false,
      };
    });

    // 添加预测数据
    let recordsWithPredictions = formattedRecords;
    let predictionCount = 0;

    if (includePredictions && historicalData.length > 0) {
      const historicalFormatted = historicalData.map(r => ({
        id: Number(r.id),
        date: r.date.toISOString().split('T')[0],
        appKey: r.appKey,
        countryCode: r.countryCode,
        bidType: r.bidType,
        installs: r.installs,
        roi: {
          day0: r.roiDay0 === -1 ? null : r.roiDay0,
          day1: r.roiDay1 === -1 ? null : r.roiDay1,
          day3: r.roiDay3 === -1 ? null : r.roiDay3,
          day7: r.roiDay7 === -1 ? null : r.roiDay7,
          day14: r.roiDay14 === -1 ? null : r.roiDay14,
          day30: r.roiDay30 === -1 ? null : r.roiDay30,
          day60: r.roiDay60 === -1 ? null : r.roiDay60,
          day90: r.roiDay90 === -1 ? null : r.roiDay90,
        },
        dataStatus: {
          day0: classifyROIValue(r.roiDay0),
          day1: classifyROIValue(r.roiDay1),
          day3: classifyROIValue(r.roiDay3),
          day7: classifyROIValue(r.roiDay7),
          day14: classifyROIValue(r.roiDay14),
          day30: classifyROIValue(r.roiDay30),
          day60: classifyROIValue(r.roiDay60),
          day90: classifyROIValue(r.roiDay90),
        },
        dataSource: r.dataSource,
        isPredicted: false,
      }));

      recordsWithPredictions = formattedRecords.map(record => {
        const days = [0, 1, 3, 7, 14, 30, 60, 90];
        const predictions: Record<string, { value: number | null; method: string; confidence: string }> = {};

        days.forEach(day => {
          const key = `day${day}`;
          if (record.roi[key as keyof typeof record.roi] === null) {
            const prediction = predictROI(record, historicalFormatted, day);
            if (prediction.value !== null) {
              predictions[key] = prediction;
              predictionCount++;
            }
          }
        });

        if (Object.keys(predictions).length > 0) {
          const newRoi = { ...record.roi };
          const isPredictedFlags: Record<string, boolean> = {};
          const predictionMethods: Record<string, string> = {};

          Object.entries(predictions).forEach(([key, pred]) => {
            newRoi[key as keyof typeof newRoi] = pred.value;
            isPredictedFlags[key] = true;
            predictionMethods[key] = `${pred.method} (${pred.confidence})`;
          });

          return {
            ...record,
            roi: newRoi,
            isPredicted: true,
            predictionDetails: {
              flags: isPredictedFlags,
              methods: predictionMethods,
            },
          };
        }

        return record;
      });
    }

    // 计算移动平均
    const recordsWithMA = calculateMovingAverage(recordsWithPredictions, 7);

    // 生成摘要
    const dateRange = {
      start: formattedRecords[0]?.date || '',
      end: formattedRecords[formattedRecords.length - 1]?.date || '',
    };

    const stats = {
      totalInstalls: records.reduce((sum, r) => sum + r.installs, 0),
      predictionCount,
    };

    return NextResponse.json({
      success: true,
      data: {
        records: recordsWithMA,
        summary: {
          total: records.length,
          dateRange,
          stats,
          includePredictions,
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
