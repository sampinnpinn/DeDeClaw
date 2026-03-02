import { Router } from 'express';
import { nanoid } from 'nanoid';
import { encrypt, decrypt } from '../lib/crypto.js';
import { prisma } from '../lib/prisma.js';

export const modelConfigRouter = Router();

const maskApiKey = (encryptedApiKey: string): string => {
  try {
    const plain = decrypt(encryptedApiKey);
    if (plain.length <= 8) return '****';
    return `${plain.slice(0, 4)}****${plain.slice(-4)}`;
  } catch {
    return '****';
  }
};

// 内部使用：解密并返回明文 API Key
export async function getDecryptedApiKey(customId: string): Promise<string | null> {
  const config = await prisma.modelProviderConfig.findUnique({ where: { customId } });
  if (!config || !config.isEnabled) return null;
  return decrypt(config.apiKey);
}

export async function getConfigByCustomId(customId: string) {
  const config = await prisma.modelProviderConfig.findUnique({ where: { customId } });
  if (!config || !config.isEnabled) return null;
  return {
    baseUrl: config.baseUrl,
    modelName: config.modelName,
    apiKey: decrypt(config.apiKey),
    customParams: config.customParams as Array<{ key: string; value: string }>,
  };
}

modelConfigRouter.get('/', async (req, res, next) => {
  try {
    const configs = await prisma.modelProviderConfig.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const response = configs.map((config) => ({
      providerId: config.id,
      customId: config.customId,
      apiType: config.apiType,
      baseUrl: config.baseUrl,
      modelName: config.modelName,
      apiKeyMasked: maskApiKey(config.apiKey),
      customParams: config.customParams as Array<{ key: string; value: string }>,
      isEnabled: config.isEnabled,
      createdAt: config.createdAt.toISOString().slice(0, 16).replace('T', ' '),
      updatedAt: config.updatedAt.toISOString().slice(0, 16).replace('T', ' '),
    }));

    res.json({
      code: 200,
      message: 'success',
      data: response,
      requestId: nanoid(),
    });
  } catch (error) {
    next(error);
  }
});

modelConfigRouter.post('/', async (req, res, next) => {
  try {
    const { customId, apiType, baseUrl, modelName, apiKey, customParams, isEnabled } = req.body;

    const existing = await prisma.modelProviderConfig.findUnique({
      where: { customId },
    });

    if (existing) {
      return res.status(400).json({
        code: 400,
        message: `customId "${customId}" 已存在，请使用其他 ID`,
        data: null,
        requestId: nanoid(),
      });
    }

    const encryptedApiKey = encrypt(apiKey);

    const config = await prisma.modelProviderConfig.create({
      data: {
        customId,
        apiType,
        baseUrl,
        modelName,
        apiKey: encryptedApiKey,
        customParams: customParams || [],
        isEnabled: isEnabled ?? true,
      },
    });

    res.json({
      code: 200,
      message: 'success',
      data: { created: true, providerId: config.id },
      requestId: nanoid(),
    });
  } catch (error) {
    next(error);
  }
});

modelConfigRouter.put('/:providerId', async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const { customId, apiType, baseUrl, modelName, apiKey, customParams, isEnabled } = req.body;

    const existing = await prisma.modelProviderConfig.findUnique({
      where: { id: providerId },
    });

    if (!existing) {
      return res.status(404).json({
        code: 404,
        message: 'API 配置不存在',
        data: null,
        requestId: nanoid(),
      });
    }

    const updateData: Record<string, unknown> = {
      customId,
      apiType,
      baseUrl,
      modelName,
      customParams: customParams || [],
      isEnabled,
    };

    if (apiKey && apiKey.trim() !== '') {
      updateData.apiKey = encrypt(apiKey);
    }

    await prisma.modelProviderConfig.update({
      where: { id: providerId },
      data: updateData,
    });

    res.json({
      code: 200,
      message: 'success',
      data: { updated: true },
      requestId: nanoid(),
    });
  } catch (error) {
    next(error);
  }
});

modelConfigRouter.delete('/:providerId', async (req, res, next) => {
  try {
    const { providerId } = req.params;

    await prisma.modelProviderConfig.delete({
      where: { id: providerId },
    });

    res.json({
      code: 200,
      message: 'success',
      data: { deleted: true },
      requestId: nanoid(),
    });
  } catch (error) {
    next(error);
  }
});
