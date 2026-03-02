import { PrismaClient } from '../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client/index.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 开始清理数据...\n');

  // 1. 清空频道记忆
  const memoryResult = await prisma.channelMemory.deleteMany({});
  console.log(`✓ 已删除频道记忆: ${memoryResult.count} 条`);

  // 2. 清空消息（Channel 级联删除会处理，但先单独清空更安全）
  const msgResult = await prisma.message.deleteMany({});
  console.log(`✓ 已删除消息: ${msgResult.count} 条`);

  // 3. 清空频道（会级联删除 messages，此处已提前删完）
  const channelResult = await prisma.channel.deleteMany({});
  console.log(`✓ 已删除频道: ${channelResult.count} 个`);

  // 4. 清空 Agent 雇佣记录
  const hireResult = await prisma.agentHire.deleteMany({});
  console.log(`✓ 已删除雇佣记录: ${hireResult.count} 条`);

  // 5. 清空人才市场 Agent
  const agentResult = await prisma.agent.deleteMany({});
  console.log(`✓ 已删除人才: ${agentResult.count} 个`);

  console.log('\n✅ 清理完成！');
}

main()
  .catch((error) => {
    console.error('❌ 清理失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
