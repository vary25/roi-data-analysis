import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'fast-csv';
import { Readable } from 'stream';
import { prisma } from '@/lib/prisma';

/**
 * 解析CSV中的百分比字符串
 * 处理千分位逗号，如 "1,280.47%"
 */
function parsePercent(value: string, daysToEnd: number, periodDays: number): number {
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
 * 解析日期字符串
 * 格式：2025-04-13(日) -> Date
 */
function parseChineseDate(dateStr: string): Date | null {
  // 提取日期部分（去掉星期）
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    const date = new Date(match[1]);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
}

// 必需的CSV列
const REQUIRED_COLUMNS = [
  '日期',
  'app',
  '出价类型',
  '国家地区',
  '应用安装.总次数',
  '当日ROI',
  '1日ROI',
  '3日ROI',
  '7日ROI',
  '14日ROI',
  '30日ROI',
  '60日ROI',
  '90日ROI',
];

/**
 * 验证CSV格式和必要列
 */
function validateCSVFormat(headers: string[]): { valid: boolean; error?: string } {
  const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
  if (missingColumns.length > 0) {
    return {
      valid: false,
      error: `CSV文件格式错误，缺少以下列: ${missingColumns.join(', ')}`,
    };
  }
  return { valid: true };
}

/**
 * 验证数据行是否完整
 */
function validateDataRow(row: any, rowIndex: number): { valid: boolean; error?: string } {
  // 检查必要字段是否为空
  if (!row['日期'] || row['日期'].trim() === '') {
    return { valid: false, error: `第 ${rowIndex + 1} 行: 日期不能为空` };
  }
  if (!row['app'] || row['app'].trim() === '') {
    return { valid: false, error: `第 ${rowIndex + 1} 行: app不能为空` };
  }
  if (!row['国家地区'] || row['国家地区'].trim() === '') {
    return { valid: false, error: `第 ${rowIndex + 1} 行: 国家地区不能为空` };
  }

  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // 检查文件类型
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { success: false, error: 'File must be a CSV' },
        { status: 400 }
      );
    }

    // 读取文件内容
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const stream = Readable.from(buffer.toString());

    const records: any[] = [];
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    let headers: string[] | null = null;
    let rowCount = 0;

    // 数据截止日期（从文件名或请求中获取，默认为90天前）
    const dataEndDate = new Date('2025-07-12');

    // 解析CSV
    const parser = stream.pipe(parse({ headers: true, trim: true }));

    for await (const row of parser) {
      rowCount++;

      // 获取并验证表头（第一行）
      if (!headers) {
        headers = Object.keys(row);
        const formatCheck = validateCSVFormat(headers);
        if (!formatCheck.valid) {
          return NextResponse.json(
            { success: false, error: formatCheck.error },
            { status: 400 }
          );
        }
      }

      // 验证数据完整性
      const dataCheck = validateDataRow(row, rowCount);
      if (!dataCheck.valid) {
        return NextResponse.json(
          { success: false, error: `数据不完整，停止导入。${dataCheck.error}` },
          { status: 400 }
        );
      }
      try {
        // 解析日期
        const date = parseChineseDate(row['日期']);
        if (!date) {
          skipped++;
          continue;
        }

        // 计算距离截止日期的天数
        const daysToEnd = Math.floor(
          (dataEndDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
        );

        // 解析安装次数
        const installs = parseInt(row['应用安装.总次数'] || '0', 10) || 0;

        // 构建记录
        const record = {
          date: date,
          appKey: row['app'] || '',
          bidType: row['出价类型'] || 'CPI',
          countryCode: row['国家地区'] || '',
          installs: installs,
          roiDay0: parsePercent(row['当日ROI'] || '', daysToEnd, 0),
          roiDay1: parsePercent(row['1日ROI'] || '', daysToEnd, 1),
          roiDay3: parsePercent(row['3日ROI'] || '', daysToEnd, 3),
          roiDay7: parsePercent(row['7日ROI'] || '', daysToEnd, 7),
          roiDay14: parsePercent(row['14日ROI'] || '', daysToEnd, 14),
          roiDay30: parsePercent(row['30日ROI'] || '', daysToEnd, 30),
          roiDay60: parsePercent(row['60日ROI'] || '', daysToEnd, 60),
          roiDay90: parsePercent(row['90日ROI'] || '', daysToEnd, 90),
          dataSource: 'csv',
        };

        // 验证必要字段
        if (!record.appKey || !record.countryCode) {
          skipped++;
          continue;
        }

        records.push(record);
        imported++;

        // 批量upsert（每100条）
        if (records.length >= 100) {
          await Promise.all(
            records.map(r =>
              prisma.rOIData.upsert({
                where: {
                  date_appKey_countryCode_bidType: {
                    date: r.date,
                    appKey: r.appKey,
                    countryCode: r.countryCode,
                    bidType: r.bidType,
                  },
                },
                update: r,
                create: r,
              })
            )
          );
          records.length = 0;
        }
      } catch (error) {
        skipped++;
        errors.push(`Row error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // upsert剩余记录
    if (records.length > 0) {
      await Promise.all(
        records.map(r =>
          prisma.rOIData.upsert({
            where: {
              date_appKey_countryCode_bidType: {
                date: r.date,
                appKey: r.appKey,
                countryCode: r.countryCode,
                bidType: r.bidType,
              },
            },
            update: r,
            create: r,
          })
        )
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        imported,
        skipped,
        errors: errors.slice(0, 10), // 只返回前10个错误
      },
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to import CSV',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
