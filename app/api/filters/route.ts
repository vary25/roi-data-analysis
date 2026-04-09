import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // 从 roi_data 表中获取唯一的维度值
    const [apps, countries, bidTypes, dateRange] = await Promise.all([
      // 获取所有应用（从 apps 表）
      prisma.app.findMany({
        where: { status: 1 },
        orderBy: { appKey: 'asc' },
        select: { appKey: true },
      }),

      // 从 roi_data 获取唯一国家列表
      prisma.rOIData.groupBy({
        by: ['countryCode'],
        orderBy: { countryCode: 'asc' },
      }),

      // 从 roi_data 获取唯一出价类型列表
      prisma.rOIData.groupBy({
        by: ['bidType'],
        orderBy: { bidType: 'asc' },
      }),

      // 获取日期范围
      prisma.rOIData.aggregate({
        _min: { date: true },
        _max: { date: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        apps: apps.map((a: { appKey: string }) => a.appKey),
        countries: countries.map((c: { countryCode: string }) => c.countryCode),
        bidTypes: bidTypes.map((b: { bidType: string }) => b.bidType),
        dateRange: {
          min: dateRange._min.date?.toISOString().split('T')[0] || '2025-04-13',
          max: dateRange._max.date?.toISOString().split('T')[0] || '2025-07-12',
        },
      },
    });
  } catch (error) {
    console.error('Filters API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch filter options',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
