import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const router = Router();

const getAgentIdParam = (req: Request): string => {
  const param = req.params.agentId;
  return Array.isArray(param) ? param[0] ?? '' : param ?? '';
};

// Agent 创建请求验证
const createAgentSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  avatar: z.string().optional(),
  role: z.string().min(1, '岗位不能为空'),
  description: z.string().optional(),
  prompt: z.string().optional(),
  skills: z.string().optional(),
  type: z.string().default('all'),
  priceRate: z.number().min(0).default(1.0),
  priceUnit: z.string().default('hour'),
  modelId: z.string().optional(),
  isListed: z.boolean().default(false),
});

// Agent 更新请求验证
const updateAgentSchema = z.object({
  name: z.string().min(1, '名称不能为空').optional(),
  avatar: z.string().optional().nullable(),
  role: z.string().min(1, '岗位不能为空').optional(),
  description: z.string().optional().nullable(),
  prompt: z.string().optional().nullable(),
  skills: z.string().optional().nullable(),
  type: z.string().optional(),
  priceRate: z.number().min(0).optional(),
  priceUnit: z.string().optional(),
  modelId: z.string().optional().nullable(),
  isListed: z.boolean().optional(),
});

// 生成唯一 agentId
const generateAgentId = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'agent_';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// GET /admin/agents - 获取所有 Agent
router.get('/', async (_req: Request, res: Response) => {
  try {
    const agents = await prisma.agent.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      isSuccess: true,
      data: agents.map(agent => ({
        ...agent,
        createdAt: agent.createdAt.toISOString(),
        updatedAt: agent.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    res.status(500).json({
      isSuccess: false,
      error: '获取人才列表失败',
    });
  }
});

// GET /admin/agents/listed - 获取已上架的 Agent (供客户端调用)
router.get('/listed', async (_req: Request, res: Response) => {
  try {
    const agents = await prisma.agent.findMany({
      where: { isListed: true },
      orderBy: { createdAt: 'desc' },
      select: {
        agentId: true,
        name: true,
        avatar: true,
        role: true,
        description: true,
        type: true,
        priceRate: true,
        priceUnit: true,
        modelId: true,
      },
    });

    res.json({
      isSuccess: true,
      data: agents.map(agent => ({
        ...agent,
        priceRate: agent.priceRate,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch listed agents:', error);
    res.status(500).json({
      isSuccess: false,
      error: '获取人才列表失败',
    });
  }
});

// GET /admin/agents/:agentId - 获取单个 Agent
router.get('/:agentId', async (req: Request, res: Response) => {
  try {
    const agentId = getAgentIdParam(req);

    const agent = await prisma.agent.findUnique({
      where: { agentId },
    });

    if (!agent) {
      return res.status(404).json({
        isSuccess: false,
        error: '人才不存在',
      });
    }

    return res.json({
      isSuccess: true,
      data: {
        ...agent,
        createdAt: agent.createdAt.toISOString(),
        updatedAt: agent.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to fetch agent:', error);
    return res.status(500).json({
      isSuccess: false,
      error: '获取人才信息失败',
    });
  }
});

// POST /admin/agents - 创建 Agent
router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = createAgentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        isSuccess: false,
        error: '参数验证失败',
        details: validation.error.issues,
      });
    }

    const data = validation.data;
    const agentId = generateAgentId();
    const createData = {
      agentId,
      name: data.name,
      avatar: data.avatar,
      role: data.role,
      description: data.description,
      type: data.type,
      priceRate: data.priceRate,
      priceUnit: data.priceUnit,
      modelId: data.modelId,
      isListed: data.isListed,
      ...(data.prompt !== undefined ? { prompt: data.prompt } : {}),
      ...(data.skills !== undefined ? { skills: data.skills } : {}),
    };

    const agent = await prisma.agent.create({
      data: createData,
    });

    return res.status(201).json({
      isSuccess: true,
      data: {
        ...agent,
        createdAt: agent.createdAt.toISOString(),
        updatedAt: agent.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to create agent:', error);
    return res.status(500).json({
      isSuccess: false,
      error: '创建人才失败',
    });
  }
});

// PUT /admin/agents/:agentId - 更新 Agent
router.put('/:agentId', async (req: Request, res: Response) => {
  try {
    const agentId = getAgentIdParam(req);
    const validation = updateAgentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        isSuccess: false,
        error: '参数验证失败',
        details: validation.error.issues,
      });
    }

    const existingAgent = await prisma.agent.findUnique({
      where: { agentId },
    });

    if (!existingAgent) {
      return res.status(404).json({
        isSuccess: false,
        error: '人才不存在',
      });
    }

    const data = validation.data;
    const updateData = {
      name: data.name,
      avatar: data.avatar,
      role: data.role,
      description: data.description,
      type: data.type,
      priceRate: data.priceRate,
      priceUnit: data.priceUnit,
      modelId: data.modelId,
      isListed: data.isListed,
      ...(data.prompt !== undefined ? { prompt: data.prompt } : {}),
      ...(data.skills !== undefined ? { skills: data.skills } : {}),
    };

    const agent = await prisma.agent.update({
      where: { agentId },
      data: updateData,
    });

    return res.json({
      isSuccess: true,
      data: {
        ...agent,
        createdAt: agent.createdAt.toISOString(),
        updatedAt: agent.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to update agent:', error);
    return res.status(500).json({
      isSuccess: false,
      error: '更新人才失败',
    });
  }
});

// DELETE /admin/agents/:agentId - 删除 Agent
router.delete('/:agentId', async (req: Request, res: Response) => {
  try {
    const agentId = getAgentIdParam(req);

    const existingAgent = await prisma.agent.findUnique({
      where: { agentId },
    });

    if (!existingAgent) {
      return res.status(404).json({
        isSuccess: false,
        error: '人才不存在',
      });
    }

    await prisma.agent.delete({
      where: { agentId },
    });

    return res.json({
      isSuccess: true,
      data: { deleted: true },
    });
  } catch (error) {
    console.error('Failed to delete agent:', error);
    return res.status(500).json({
      isSuccess: false,
      error: '删除人才失败',
    });
  }
});

export default router;
