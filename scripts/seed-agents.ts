import { PrismaClient } from '../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client/index.js';
import { nanoid } from 'nanoid';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

const agentTypes = ['assistant', 'developer', 'designer', 'analyst'];
const roles = [
  '产品经理', '前端工程师', '后端工程师', 'UI设计师', 'UX设计师',
  '数据分析师', '运营专家', '市场营销', '内容创作者', '项目经理',
  '测试工程师', '架构师', '增长专家', '客服专员', '财务顾问',
  '法务顾问', '人力资源', '品牌策划', '视频剪辑', '文案策划'
];

const descriptions = [
  '专注于产品规划和需求分析',
  '精通 React、Vue 等前端框架',
  '擅长 Node.js、Python 后端开发',
  '具有丰富的界面设计经验',
  '专注于用户体验优化',
  '数据驱动决策专家',
  '擅长用户增长和留存',
  '精通市场推广策略',
  '创作高质量内容',
  '项目管理和团队协作专家',
  '自动化测试和质量保障',
  '系统架构设计专家',
  '用户增长黑客',
  '客户服务和支持',
  '财务规划和分析',
  '法律合规顾问',
  '人才招聘和培养',
  '品牌建设和传播',
  '视频内容制作',
  '营销文案撰写'
];

const names = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Eve',
  'Frank', 'Grace', 'Henry', 'Iris', 'Jack',
  'Kate', 'Leo', 'Mary', 'Nick', 'Olivia',
  'Peter', 'Quinn', 'Rose', 'Sam', 'Tina'
];

async function main() {
  const userId = 'MYceZSHW';

  // 检查用户是否存在
  const user = await prisma.user.findUnique({
    where: { userId },
  });

  if (!user) {
    console.error(`用户 ${userId} 不存在`);
    process.exit(1);
  }

  console.log(`为用户 ${user.username} (${userId}) 创建 20 个 Agent...`);

  const createdAgents = [];

  for (let i = 0; i < 20; i++) {
    const agentId = `AG${nanoid(10)}`;
    const name = names[i];
    const role = roles[i];
    const description = descriptions[i];
    const type = agentTypes[i % agentTypes.length];
    const priceRate = 1.0 + Math.random() * 2; // 1.0 - 3.0x

    // 创建 Agent
    const agent = await prisma.agent.create({
      data: {
        agentId,
        name,
        role,
        description,
        type,
        priceRate: parseFloat(priceRate.toFixed(1)),
        priceUnit: 'hour',
        isListed: true,
      },
    });

    console.log(`✓ 创建 Agent: ${name} (${agentId}) - ${role}`);

    // 为用户雇佣该 Agent
    await prisma.agentHire.create({
      data: {
        userId,
        agentId,
      },
    });

    console.log(`  ✓ 已雇佣`);

    createdAgents.push(agent);
  }

  console.log(`\n✅ 成功创建并雇佣 ${createdAgents.length} 个 Agent`);
  console.log(`\nAgent 列表：`);
  createdAgents.forEach((agent, index) => {
    console.log(`${index + 1}. ${agent.name} - ${agent.role} (${agent.priceRate}x/小时)`);
  });
}

main()
  .catch((error) => {
    console.error('错误:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
