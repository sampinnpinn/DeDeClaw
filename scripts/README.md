# 数据库脚本

## 创建 20 个 Agent 并自动雇佣

该脚本会为指定用户创建 20 个不同类型的 Agent 并自动雇佣。

### 使用方法

1. 安装依赖（仅需一次）：
```bash
cd /Users/sam/Downloads/dede_chat/scripts
npm install
```

2. 运行脚本：
```bash
npm run seed-agents
```

或者直接运行：
```bash
cd /Users/sam/Downloads/dede_chat/scripts
npx tsx seed-agents.ts
```

### 脚本功能

- 创建 20 个 Agent（产品经理、工程师、设计师、分析师等）
- 自动为用户 `MYceZSHW` 雇佣所有 Agent
- Agent 类型包括：assistant、developer、designer、analyst
- 价格倍率：1.0x - 3.0x/小时
- 所有 Agent 自动上架（isListed: true）

### Agent 列表

1. Alice - 产品经理
2. Bob - 前端工程师
3. Charlie - 后端工程师
4. Diana - UI设计师
5. Eve - UX设计师
6. Frank - 数据分析师
7. Grace - 运营专家
8. Henry - 市场营销
9. Iris - 内容创作者
10. Jack - 项目经理
11. Kate - 测试工程师
12. Leo - 架构师
13. Mary - 增长专家
14. Nick - 客服专员
15. Olivia - 财务顾问
16. Peter - 法务顾问
17. Quinn - 人力资源
18. Rose - 品牌策划
19. Sam - 视频剪辑
20. Tina - 文案策划
