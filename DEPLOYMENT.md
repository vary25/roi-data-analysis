# 部署说明文档

## 环境要求

### 服务器配置

| 组件 | 版本 | 说明 |
|------|------|------|
| Node.js | 18.x 或更高 | 运行Next.js应用 |
| MySQL | 8.0+ | 数据存储 |
| Nginx | 任意 | 反向代理（生产环境） |
| PM2 | 任意 | 进程管理（可选） |

### 开发环境

| 组件 | 版本 | 说明 |
|------|------|------|
| Node.js | 18.x+ | 必需 |
| npm | 9.x+ | 包管理器 |
| MySQL | 8.0+ | 必需 |

## 环境配置

### 1. 安装Node.js

```bash
# 使用nvm安装（推荐）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# 验证安装
node -v
npm -v
```

### 2. 安装MySQL

#### Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install mysql-server
sudo mysql_secure_installation
```

#### CentOS/RHEL

```bash
sudo yum install mysql-server
sudo systemctl start mysqld
sudo systemctl enable mysqld
```

#### macOS

```bash
brew install mysql
brew services start mysql
```

### 3. 配置MySQL

创建数据库和用户：

```bash
sudo mysql -u root -p
```

```sql
-- 创建数据库
CREATE DATABASE approi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户（可选）
CREATE USER 'approi'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON approi.* TO 'approi'@'localhost';
FLUSH PRIVILEGES;

-- 或使用root用户
-- 修改root密码
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'your_password';
FLUSH PRIVILEGES;
```

## 项目安装

### 1. 克隆项目

```bash
git clone <repository-url>
cd approi-system/my-app
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

创建 `.env.local` 文件：

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```env
# 数据库连接字符串
DATABASE_URL="mysql://username:password@localhost:3306/approi"

# 示例：
# DATABASE_URL="mysql://root:password@localhost:3306/approi"
# DATABASE_URL="mysql://approi:your_password@localhost:3306/approi"
```

## 数据库初始化

### 1. 生成Prisma客户端

```bash
npm run db:generate
```

### 2. 执行数据库迁移

```bash
npm run db:migrate
```

执行后会自动创建数据库表结构。

### 3. 验证数据库连接

```bash
npm run db:studio
```

这将打开Prisma Studio，可以在浏览器中查看和编辑数据。

### 4. 导入CSV数据

将数据文件放入项目目录：

```bash
# 假设CSV文件为 app_roi_data.csv
npm run db:seed -- ./app_roi_data.csv
```

或通过API上传：

```bash
curl -X POST -F "file=@app_roi_data.csv" http://localhost:3000/api/import
```

## 开发环境启动

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 代码检查

```bash
npm run lint
```

## 生产环境部署

### 1. 构建应用

```bash
npm run build
```

这会创建 `.next` 目录，包含编译后的应用代码。

### 2. 启动生产服务器

#### 方式一：直接启动

```bash
npm start
```

#### 方式二：使用PM2（推荐）

安装PM2：

```bash
npm install -g pm2
```

创建PM2配置文件 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'approi-system',
    script: 'npm',
    args: 'start',
    cwd: '/path/to/your/project',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
  }],
};
```

启动：

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 3. Nginx配置

创建Nginx配置文件 `/etc/nginx/sites-available/approi`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态文件缓存
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, immutable";
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/approi /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. HTTPS配置（SSL）

使用Certbot获取免费SSL证书：

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Docker部署（可选）

### 创建Dockerfile

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# 复制package文件
COPY package*.json ./
COPY prisma ./prisma/

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["npm", "start"]
```

### 创建docker-compose.yml

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: approi
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"

  app:
    build: .
    environment:
      DATABASE_URL: mysql://root:rootpassword@mysql:3306/approi
      NODE_ENV: production
    ports:
      - "3000:3000"
    depends_on:
      - mysql

volumes:
  mysql_data:
```

### 启动

```bash
docker-compose up -d
```

## 更新部署

### 更新应用代码

```bash
# 拉取最新代码
git pull

# 安装新依赖
npm install

# 执行数据库迁移（如有 schema 变更）
npm run db:migrate

# 重新构建
npm run build

# 重启服务（如使用PM2）
pm2 restart approi-system
```

### 更新CSV数据

```bash
# 清空旧数据（可选）
mysql -u root -p approi -e "TRUNCATE TABLE roi_data;"

# 导入新数据
npm run db:seed -- ./new_data.csv
```

## 故障排查

### 数据库连接失败

**症状**: 应用启动时报数据库连接错误

**解决**:
1. 检查 `.env.local` 中的 `DATABASE_URL` 是否正确
2. 确认MySQL服务是否运行：`sudo systemctl status mysql`
3. 检查用户权限：
   ```sql
   SELECT user, host FROM mysql.user;
   SHOW GRANTS FOR 'approi'@'localhost';
   ```

### CSV导入失败

**症状**: 导入时报错或数据不正确

**解决**:
1. 检查CSV文件编码（应为UTF-8）
2. 确认列名与预期一致
3. 查看具体错误信息：
   ```bash
   npm run db:seed -- ./data.csv 2>&1 | tee import.log
   ```

### 构建失败

**症状**: `npm run build` 报错

**解决**:
1. 检查TypeScript类型错误：`npx tsc --noEmit`
2. 删除 `.next` 目录重试：`rm -rf .next && npm run build`
3. 检查Node.js版本：`node -v`（需18+）

### 图表不显示

**症状**: 页面加载但图表区域空白

**解决**:
1. 检查浏览器控制台错误
2. 确认Recharts已安装：`npm list recharts`
3. 检查数据是否正确加载：查看Network面板API响应

## 性能优化

### 数据库优化

1. **添加索引**（已自动创建）:
   ```sql
   SHOW INDEX FROM roi_data;
   ```

2. **定期分析表**:
   ```sql
   ANALYZE TABLE roi_data;
   ```

### 应用优化

1. **启用压缩**（Next.js自动启用）

2. **CDN加速**: 将静态资源部署到CDN

3. **数据库连接池**: Prisma自动管理

## 安全建议

1. **修改默认密码**: 生产环境务必修改数据库密码

2. **环境变量**: 不要将 `.env.local` 提交到版本控制

3. **防火墙**: 限制MySQL端口仅允许本地访问
   ```bash
   sudo ufw allow from 127.0.0.1 to any port 3306
   ```

4. **定期备份**:
   ```bash
   mysqldump -u root -p approi > backup.sql
   ```

## 监控

### 使用PM2监控

```bash
pm2 status
pm2 logs
pm2 monit
```

### 系统资源监控

```bash
# CPU和内存
htop

# 磁盘空间
df -h

# MySQL状态
mysqladmin -u root -p status
```

## 技术支持

如遇问题，请查看：
1. 应用日志：`pm2 logs` 或控制台输出
2. MySQL日志：`/var/log/mysql/error.log`
3. Nginx日志：`/var/log/nginx/error.log`
