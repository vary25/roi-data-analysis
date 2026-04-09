# App ROI 数据分析系统

多时间维度ROI（投资回报率）趋势分析系统，支持CSV数据导入、8个时间维度ROI数据可视化、7日移动平均、预测数据等功能。

## 功能特性

- **数据导入**: CSV文件批量导入到MySQL数据库（支持拖拽上传）
- **多维度筛选**: 按应用、国家、出价类型、日期范围筛选
- **8条ROI趋势线**: 当日、1日、3日、7日、14日、30日、60日、90日累计ROI
- **100%回本线**: 红色水平参考线
- **数据模式切换**: 原始数据 / 7日移动平均
- **Y轴刻度切换**: 线性刻度 / 对数刻度
- **图例交互**: 点击图例显示/隐藏对应数据线
- **0%数据处理**: 区分真实0%与日期不足导致的0%

## 技术栈

- **前端**: Next.js 14 + React 18 + TypeScript + Tailwind CSS
- **图表**: Recharts
- **后端**: Next.js API Routes
- **数据库**: MySQL 8.0 + Prisma ORM
- **CSV处理**: fast-csv

## 数据库设计（简化版）

本项目采用简化的数据库设计，便于CSV数据导入：

- **apps** - 应用信息表
- **roi_data** - ROI数据主表（使用字符串维度字段，无外键约束）

维度字段直接使用字符串存储：
- `appKey` - 应用标识（如：App-1）
- `countryCode` - 国家/地区（如：美国、英国）
- `bidType` - 出价类型（如：CPI）

## 快速开始

### 1. 环境准备

确保已安装：
- Node.js 18+
- MySQL 8.0+

### 2. 数据库配置

创建数据库：
```sql
CREATE DATABASE approi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

创建用户（可选）：
```sql
CREATE USER 'approi'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON approi.* TO 'approi'@'localhost';
FLUSH PRIVILEGES;
```

### 3. 项目配置

复制环境变量文件：
```bash
cp .env.local.example .env.local
```

编辑 `.env.local`，配置数据库连接：
```
DATABASE_URL="mysql://username:password@localhost:3306/approi"
```

### 4. 安装依赖

```bash
npm install
```

### 5. 数据库初始化

生成Prisma客户端并创建数据库表：
```bash
npm run db:generate
npx prisma migrate dev --name init
```

### 6. 导入CSV数据

方式一：使用命令行导入
```bash
npm run db:seed -- ../data/app_roi_data.csv
```

方式二：启动服务后通过Web界面上传
```bash
npm run dev
# 然后访问 http://localhost:3000/import
```

方式三：通过API上传
```bash
curl -X POST -F "file=@../data/app_roi_data.csv" http://localhost:3000/api/import
```

### 7. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 项目结构

```
app/
├── api/                    # API路由
│   ├── import/route.ts     # CSV导入API
│   ├── roi/route.ts        # ROI数据查询API
│   └── filters/route.ts    # 筛选选项API
├── components/             # 前端组件
│   ├── FilterBar.tsx       # 筛选器
│   ├── ControlBar.tsx      # 控制器
│   └── ROIChart.tsx        # ROI图表
├── import/
│   └── page.tsx            # CSV导入页面
├── lib/
│   ├── prisma.ts           # Prisma客户端
│   └── dataProcessing.ts   # 数据处理函数
├── types/
│   └── index.ts            # TypeScript类型定义
├── globals.css             # 全局样式
├── layout.tsx              # 根布局
└── page.tsx                # 主页面

prisma/
└── schema.prisma           # 数据库模型定义（简化版，无外键约束）

scripts/
└── import-csv.ts           # CSV导入脚本

data/
└── app_roi_data.csv        # CSV数据源
```

## API接口

### POST /api/import
CSV文件导入

**请求**: `Content-Type: multipart/form-data`
```
file: CSV文件
```

**响应**:
```json
{
  "success": true,
  "data": {
    "imported": 910,
    "skipped": 0,
    "errors": []
  }
}
```

### GET /api/roi
获取ROI数据

**参数**:
- `appKey`: 应用标识（如 App-1）
- `countryCode`: 国家/地区（如 美国）
- `bidType`: 出价类型（如 CPI）
- `startDate`: 开始日期 (YYYY-MM-DD)
- `endDate`: 结束日期 (YYYY-MM-DD)

**响应**:
```json
{
  "success": true,
  "data": {
    "records": [...],
    "summary": {
      "total": 910,
      "dateRange": { "start": "2025-04-13", "end": "2025-07-12" }
    }
  }
}
```

### GET /api/filters
获取筛选选项

**响应**:
```json
{
  "success": true,
  "data": {
    "apps": ["App-1", "App-2", "App-3", "App-4", "App-5"],
    "countries": ["美国", "英国"],
    "bidTypes": ["CPI"],
    "dateRange": { "min": "2025-04-13", "max": "2025-07-12" }
  }
}
```

## CSV文件格式

CSV文件必须包含以下列：

| 列名 | 说明 | 示例 |
|------|------|------|
| 日期 | 数据日期 | 2025-04-13(日) |
| app | 应用名称 | App-1 |
| 出价类型 | 出价方式 | CPI |
| 国家地区 | 投放国家 | 美国 |
| 应用安装.总次数 | 安装数量 | 4849 |
| 当日ROI | 当日ROI百分比 | 6.79% |
| 1日ROI | 1日ROI百分比 | 14.24% |
| 3日ROI | 3日ROI百分比 | 27.3% |
| 7日ROI | 7日ROI百分比 | 64.44% |
| 14日ROI | 14日ROI百分比 | 120.89% |
| 30日ROI | 30日ROI百分比 | 214.65% |
| 60日ROI | 60日ROI百分比 | 368.42% |
| 90日ROI | 90日ROI百分比 | 413.81% |

**注意**：ROI值支持千分位逗号（如 "1,280.47%"）

## 开发命令

```bash
# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start

# 代码检查
npm run lint

# 数据库操作
npm run db:generate    # 生成Prisma客户端
npm run db:migrate     # 执行数据库迁移
npm run db:studio      # 打开Prisma Studio
npm run db:seed        # 导入CSV数据
```

## 数据说明

ROI数据表使用 **-1** 作为默认值表示数据缺失或日期不足，区分三种数据状态：

| 状态 | 值 | 说明 |
|------|-----|------|
| **数据缺失** | -1 | 日期不足或数据未采集 |
| **真实0%** | 0 | 实际ROI为0%（无收益或亏损） |
| **有效数据** | >0 | 正常ROI值 |

## 许可证

MIT
