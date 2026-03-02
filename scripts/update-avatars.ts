import { PrismaClient } from '../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client/index.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

const avatars = [
  '/dede.webp',
  '/lily.webp',
  '/owen.webp',
  '/pippa.webp',
];

async function main() {
  const agents = await prisma.agent.findMany({
    orderBy: { createdAt: 'asc' },
  });

  console.log(`找到 ${agents.length} 个 Agent，开始更新头像...`);

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    const avatar = avatars[i % avatars.length];

    await prisma.agent.update({
      where: { agentId: agent.agentId },
      data: { avatar },
    });

    console.log(`✓ ${agent.name} -> ${avatar}`);
  }

  console.log(`\n✅ 成功更新 ${agents.length} 个 Agent 的头像`);
}

main()
  .catch((error) => {
    console.error('错误:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
