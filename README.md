# DeDeClaw
⭐ 如果这个项目对你有帮助，请给我们一个 Star！Star越多更新越猛！

🚀 基于大语言模型的智能协作平台，让 AI Agent 成为你团队的核心生产力。

## 📖 项目简介
简单来说，就是雇佣一群AI员工帮我做内容创作！真正符合「一人公司」的需求！基于我们营销团队两年多的内测使用，人效提高600%，一个实习生带领AI同事，就能完成高质量的内容创作！

![DeDeClaw Logo](assets/5.png)

## 最近更新：
- 支持 gemini-3-pro-image-preview（香蕉生图）自动完成配图
- 长期记忆，AI Agent 对话自动提取重要信息做成长期记忆
- 知识库文档支持上传图片、pdf、md、doc等格式，自动做向量化处理，作为AI对话的数据
- 群组对话支持联网获取最新消息
- AI角色在群里能独立人格，感知上下文，补充同事观点
- UI设计上做了很多美化，包括对话框毛玻璃效果等，颜值超高！

![DeDeClaw Logo](assets/1.png)


## ✨ 特色功能

### 🤖 智能对话
- **多模态交互**：支持文本、图片、文件等多种消息类型
- **上下文理解**：AI 能够理解对话历史，提供连贯的回复
- **实时响应**：基于 WebSocket 的低延迟通信体验

![DeDeClaw Logo](assets/6.png)

### 👥 团队协作
- **频道管理**：创建不同主题的讨论频道
- **成员管理**：灵活的团队成员权限控制
- **消息同步**：跨设备消息实时同步

![DeDeClaw Logo](assets/2.png)
![DeDeClaw Logo](assets/3.png)

### 🎯 AI Agent 市场
- **专业 Agent**：产品经理、工程师、设计师、分析师等角色
- **智能雇佣**：按需雇佣 AI Agent，按使用时长计费
- **能力定制**：根据项目需求定制 Agent 专业能力

![DeDeClaw Logo](assets/0.png)

### 📚 知识库管理
- **文档检索**：智能检索企业内部文档
- **知识沉淀**：自动保存有价值的对话内容
- **快速问答**：基于企业知识库的智能问答

![DeDeClaw Logo](assets/4.png)
![DeDeClaw Logo](assets/7.png)

### 🔧 系统管理
- **可视化后台**：直观的管理界面
- **数据监控**：实时监控系统运行状态
- **安全控制**：完善的权限管理和数据加密

## 🏗️ 项目结构

```
DeDeClaw/
├── apps/
│   ├── admin/        # 管理后台（React + TypeScript）
│   ├── api-server/   # API 服务（Node.js + Express）
│   └── desktop/      # 桌面客户端（Electron + React）
├── assets/           # 项目资源文件
├── scripts/          # 数据库脚本
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## 🛠️ 技术栈

### 前端技术
- **React 18** + **TypeScript 5** - 现代化前端框架
- **TailwindCSS 3.4** - 实用优先的 CSS 框架
- **Electron 33** - 跨平台桌面应用框架
- **Vite 5** - 快速构建工具

### 后端技术
- **Node.js** + **Express** - 高性能 Web 服务
- **Prisma 5** + **PostgreSQL** - 类型安全的数据库 ORM
- **Redis** - 高性能缓存和会话存储
- **WebSocket** - 实时双向通信

### AI 集成
- **多模型支持**：OpenAI GPT、Claude、通义千问等
- **向量化存储**：支持文档向量化检索
- **流式响应**：实时 AI 回复体验

## 🚀 快速开始

### 环境要求

- **Node.js** >= 18
- **pnpm** >= 8
- **PostgreSQL** >= 14
- **Redis** >= 6

### 安装依赖

```bash
# 克隆项目
git clone https://github.com/your-username/DeDeClaw.git
cd DeDeClaw

# 安装依赖
pnpm install
```

### 环境配置

```bash
# 复制环境变量模板
cp apps/api-server/.env.example apps/api-server/.env

# 编辑配置文件
nano apps/api-server/.env
```

**必需配置项：**
```env
DATABASE_URL="postgresql://user:password@localhost:5432/dedeclaw"
REDIS_URL="redis://localhost:6379"
ENCRYPTION_SECRET="your_secure_encryption_key"
CORS_ORIGIN="https://your-domain.com"
```

### 数据库初始化

```bash
cd apps/api-server

# 生成 Prisma Client
pnpm db:generate

# 推送数据库结构
pnpm db:push

# 创建初始数据（可选）
cd ../../scripts
pnpm seed-agents
```

### 启动开发环境

```bash
# 方式一：启动所有服务
pnpm dev:all

# 方式二：分别启动
pnpm dev:api      # API 服务 (端口 8080)
pnpm dev:admin    # 管理后台 (端口 5173)
pnpm dev:desktop  # 桌面客户端
```

访问地址：
-  **桌面客户端**：自动启动 Electron 应用
-  **管理后台**：http://localhost:5173
-  **API 服务**：http://localhost:8080

## 🚀 部署指南

### 生产环境部署

#### 1. 构建应用

```bash
# 构建 API 服务
pnpm build:api

# 构建管理后台
pnpm build:admin

# 构建桌面客户端
pnpm build:desktop

# 打包桌面应用
pnpm package:desktop
```

#### 2. 部署 API 服务

```bash
# 使用 PM2 部署
cd apps/api-server
pm2 start dist/index.js --name dedeclaw-api

# 或使用 Docker
docker build -t dedeclaw-api .
docker run -d -p 8080:8080 dedeclaw-api
```

#### 3. 部署管理后台

```bash
# 使用 Nginx 部署静态文件
cp -r apps/admin/dist/* /var/www/dedeclaw-admin/

# Nginx 配置示例
server {
    listen 80;
    server_name admin.your-domain.com;
    root /var/www/dedeclaw-admin;
    index index.html;
}
```

#### 4. 桌面应用分发

构建完成后，安装包位于：
- **macOS**: `apps/desktop/release/DeDeClaw.dmg`
- **Windows**: `apps/desktop/release/DeDeClaw Setup.exe`

### Docker 部署（推荐）

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d
```

##  系统监控

### 健康检查

```bash
# API 服务状态
curl https://api.your-domain.com/health

# 数据库连接
curl https://api.your-domain.com/health/db
```

### 日志查看

```bash
# PM2 日志
pm2 logs dedeclaw-api

# Docker 日志
docker-compose logs -f api
```

##  安全说明

- ✅ **数据加密**：敏感数据使用 AES-256 加密存储
- ✅ **API 安全**：JWT Token + bcrypt 密码加密
- ✅ **跨域控制**：CORS 白名单机制
- ✅ **输入验证**：Zod schema 验证所有输入
- ⚠️ **生产环境**：请务必修改默认密码和密钥

##  贡献指南

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

##  开发规范

- 使用 TypeScript 严格模式
- 遵循 ESLint + Prettier 代码规范
- 组件采用函数式 + Hooks
- API 接口使用 RESTful 设计
- 提交信息遵循 Conventional Commits

## 📄 License

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

---

⭐ 如果这个项目对你有帮助，请给我们一个 Star！
