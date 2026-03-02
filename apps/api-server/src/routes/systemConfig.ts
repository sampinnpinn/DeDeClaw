import { Router } from 'express';
import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma.js';

export const systemConfigRouter = Router();

const SYSTEM_CONFIG_KEY = 'default';

systemConfigRouter.get('/', async (req, res, next) => {
  try {
    let config = await prisma.systemConfig.findUnique({
      where: { key: SYSTEM_CONFIG_KEY },
    });

    if (!config) {
      config = await prisma.systemConfig.create({
        data: {
          key: SYSTEM_CONFIG_KEY,
          electronDataPushIntervalSeconds: 20,
          websocketHeartbeatSeconds: 30,
          isMaintenanceMode: false,
        },
      });
    }

    res.json({
      code: 200,
      message: 'success',
      data: {
        electronDataPushIntervalSeconds: config.electronDataPushIntervalSeconds,
        websocketHeartbeatSeconds: config.websocketHeartbeatSeconds,
        isMaintenanceMode: config.isMaintenanceMode,
      },
      requestId: nanoid(),
    });
  } catch (error) {
    next(error);
  }
});

systemConfigRouter.put('/', async (req, res, next) => {
  try {
    const { electronDataPushIntervalSeconds, websocketHeartbeatSeconds, isMaintenanceMode } =
      req.body;

    await prisma.systemConfig.upsert({
      where: { key: SYSTEM_CONFIG_KEY },
      update: {
        electronDataPushIntervalSeconds,
        websocketHeartbeatSeconds,
        isMaintenanceMode,
      },
      create: {
        key: SYSTEM_CONFIG_KEY,
        electronDataPushIntervalSeconds,
        websocketHeartbeatSeconds,
        isMaintenanceMode,
      },
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
