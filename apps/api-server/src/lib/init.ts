import { prisma } from './prisma.js';
import { hashPassword, generateUserId, generateWorkspaceId, generateInvitationCode } from '../utils/auth.js';

export async function initializeDefaultAdmin() {
  try {
    // 检查是否已存在管理员账户
    const existingAdmin = await prisma.user.findFirst({
      where: {
        email: process.env.ADMIN_EMAIL || 'admin@example.com'
      }
    });

    if (existingAdmin) {
      console.log('✅ 默认管理员账户已存在');
      return;
    }

    // 创建默认管理员账户
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
    const adminNickname = process.env.ADMIN_NICKNAME || '系统管理员';

    const userId = generateUserId();
    const passwordHash = await hashPassword(adminPassword);

    const user = await prisma.user.create({
      data: {
        userId,
        email: adminEmail,
        passwordHash,
        username: adminNickname,
      },
    });

    // 创建管理员工作空间
    const workspaceId = generateWorkspaceId();
    const invCode = generateInvitationCode();

    const workspace = await prisma.workspace.create({
      data: {
        workspaceId,
        name: `${adminNickname}的工作空间`,
        type: 'creator',
        ownerId: userId,
        invitationCode: invCode,
      },
    });

    // 添加工作空间成员关系
    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.workspaceId,
        userId: user.userId,
        role: 'owner',
      },
    });

    console.log('✅ 默认管理员账户创建成功');
    console.log(`   邮箱: ${adminEmail}`);
    console.log(`   密码: ${adminPassword}`);
    console.log(`   工作空间: ${workspace.name}`);

  } catch (error) {
    console.error('❌ 创建默认管理员账户失败:', error);
  }
}
