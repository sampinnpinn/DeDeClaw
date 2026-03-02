# DeDe Admin API Server

基于 Node.js + Express + Prisma + PostgreSQL 的管理后台 API 服务。

## 技术栈

- **Node.js** + **TypeScript**
- **Express** - Web 框架
- **Prisma** - ORM（类型安全）
- **PostgreSQL** - 主数据库
- **Redis** - 缓存层（可选）
- **bcrypt** - API Key 加密存储

## 快速开始

### 1. 安装依赖

```bash
cd apps/api-server
pnpm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写真实配置：

```bash
cp .env.example .env
```

**必填配置**：
```env
DATABASE_URL="postgresql://user:password@localhost:5432/dede_admin?schema=public"
REDIS_URL="redis://localhost:6379"
PORT=8080
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123456
```

### 3. 初始化数据库

```bash
# 生成 Prisma Client
pnpm db:generate

# 推送数据库 schema（开发环境）
pnpm db:push

# 或使用 migration（生产环境推荐）
pnpm db:migrate
```

### 4. 启动开发服务器

```bash
pnpm dev
```

服务将运行在 `http://localhost:8080`

## API 接口

### 模型配置管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/model-configs` | 获取所有 API 配置 |
| POST | `/admin/model-configs` | 创建新 API 配置 |
| PUT | `/admin/model-configs/:providerId` | 更新 API 配置 |
| DELETE | `/admin/model-configs/:providerId` | 删除 API 配置 |

### 系统配置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/system-config` | 获取系统配置 |
| PUT | `/admin/system-config` | 更新系统配置 |

### 健康检查

```bash
curl http://localhost:8080/health
```

## 数据库管理

```bash
# 打开 Prisma Studio（可视化数据库管理）
pnpm db:studio

# 重置数据库（危险操作）
pnpm prisma db push --force-reset
```

## 生产部署

### 1. 构建

```bash
pnpm build
```

### 2. 启动

```bash
NODE_ENV=production pnpm start
```

### 3. 使用 PM2（推荐）

```bash
pm2 start dist/index.js --name dede-api-server
```

## 安全说明

- ✅ API Key 使用 bcrypt 加密存储（不可逆）
- ✅ 前端只显示脱敏后的 Key（`sk-****-****-91ab`）
- ✅ 支持 CORS 跨域配置
- ⚠️ 生产环境请务必修改默认管理员密码
- ⚠️ 建议配置 HTTPS 和防火墙规则

## 与前端对接

确保前端 `apps/admin/.env` 中的 API 地址正确：

```env
VITE_ADMIN_API_BASE_URL=http://localhost:8080
```

## 故障排查

### 数据库连接失败

检查 PostgreSQL 是否运行：
```bash
psql -U postgres -c "SELECT version();"
```

### Prisma Client 未生成

重新生成：
```bash
pnpm db:generate
```

### 端口被占用

修改 `.env` 中的 `PORT` 配置
