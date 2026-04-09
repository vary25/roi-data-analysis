import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import { parse } from 'fast-csv';

const prisma = new PrismaClient();

// 数据截止日期
const DATA_END_DATE = new Date('2025-07-12');

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

/**
 * 确保应用数据存在
 */
async function ensureApps() {
  console.log('检查应用数据...');

  const apps = [
    { appKey: 'App-1', appName: 'App-1', platform: 'iOS' },
    { appKey: 'App-2', appName: 'App-2', platform: 'iOS' },
    { appKey: 'App-3', appName: 'App-3', platform: 'iOS' },
    { appKey: 'App-4', appName: 'App-4', platform: 'iOS' },
    { appKey: 'App-5', appName: 'App-5', platform: 'iOS' },
  ];

  for (const app of apps) {
    await prisma.app.upsert({
      where: { appKey: app.appKey },
      update: {},
      create: app,
    });
  }

  console.log('应用数据检查完成');
}

/**
 * 逐条插入记录（避免事务冲突）
 */
async function insertRecord(record: any) {
  try {
    await prisma.rOIData.upsert({
      where: {
        date_appKey_countryCode_bidType: {
          date: record.date,
          appKey: record.appKey,
          countryCode: record.countryCode,
          bidType: record.bidType,
        },
      },
      update: record,
      create: record,
    });
    return true;
  } catch (error) {
    console.error('Insert error:', error);
    return false;
  }
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

/**
 * 导入CSV文件
 */
async function importCSV(filePath: string) {
  console.log(`开始导入: ${filePath}`);

  // 确保应用数据存在
  await ensureApps();

  return new Promise((resolve, reject) => {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    let headers: string[] | null = null;
    let rowCount = 0;
    let hasError = false;

    const stream = fs.createReadStream(filePath)
      .pipe(parse({ headers: true, trim: true }));

    stream
      .on('error', (error: Error) => reject(error))
      .on('data', async (row: any) => {
        // 如果有错误，停止处理
        if (hasError) return;

        rowCount++;

        // 获取并验证表头（第一行）
        if (!headers) {
          headers = Object.keys(row);
          const formatCheck = validateCSVFormat(headers);
          if (!formatCheck.valid) {
            hasError = true;
            stream.destroy();
            reject(new Error(formatCheck.error));
            return;
          }
        }

        // 验证数据完整性
        const dataCheck = validateDataRow(row, rowCount);
        if (!dataCheck.valid) {
          hasError = true;
          stream.destroy();
          reject(new Error(`数据不完整，停止导入。${dataCheck.error}`));
          return;
        }

        // 暂停流以处理异步操作
        stream.pause();

        try {
          // 解析日期
          const date = parseChineseDate(row['日期']);
          if (!date) {
            skipped++;
            stream.resume();
            return;
          }

          // 计算距离截止日期的天数
          const daysToEnd = Math.floor(
            (DATA_END_DATE.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
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
            stream.resume();
            return;
          }

          // 插入记录
          const success = await insertRecord(record);
          if (success) {
            imported++;
            if (imported % 100 === 0) {
              console.log(`已导入 ${imported} 条记录...`);
            }
          } else {
            skipped++;
          }
        } catch (error) {
          skipped++;
          errors.push(`Row error: ${error instanceof Error ? error.message : 'Unknown'}`);
        }

        stream.resume();
      })
      .on('end', async () => {
        try {
          console.log(`\n导入完成:`);
          console.log(`  成功: ${imported} 条`);
          console.log(`  跳过: ${skipped} 条`);
          console.log(`  错误: ${errors.length} 条`);

          if (errors.length > 0) {
            console.log('\n前10个错误:');
            errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
          }

          resolve({ imported, skipped, errors: errors.length });
        } catch (error) {
          reject(error);
        } finally {
          await prisma.$disconnect();
        }
      });
  });
}

/**
 * 主函数
 */
async function main() {
  const filePath = process.argv[2] || '../data/app_roi_data.csv';

  if (!fs.existsSync(filePath)) {
    console.error(`文件不存在: ${filePath}`);
    console.log('用法: npx tsx scripts/import-csv.ts <csv文件路径>');
    process.exit(1);
  }

  try {
    await importCSV(filePath);
  } catch (error) {
    console.error('导入失败:', error);
    process.exit(1);
  }
}

main();
