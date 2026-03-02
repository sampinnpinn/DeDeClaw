import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';

const IPC_CHANNELS = {
  pdfExport: 'ipc:pdf:export',
  openExternal: 'ipc:shell:openExternal',
} as const;

const resolveEnvPath = (): string | null => {
  const candidatePaths = [
    path.resolve(__dirname, '../../../../.env.local'),
    path.resolve(__dirname, '../../../../.env'),
    path.resolve(process.cwd(), '../../.env.local'),
    path.resolve(process.cwd(), '../../.env'),
  ];

  const matchedPath = candidatePaths.find((candidatePath) => fs.existsSync(candidatePath));
  return matchedPath ?? null;
};

const readEnvValue = (filePath: string, key: string): string | null => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }

    const equalIndex = line.indexOf('=');
    if (equalIndex <= 0) {
      continue;
    }

    const currentKey = line.slice(0, equalIndex).trim();
    if (currentKey !== key) {
      continue;
    }

    const rawValue = line.slice(equalIndex + 1).trim();
    if (rawValue.length === 0) {
      return null;
    }

    const hasDoubleQuotes = rawValue.startsWith('"') && rawValue.endsWith('"');
    const hasSingleQuotes = rawValue.startsWith('\'') && rawValue.endsWith('\'');

    if (hasDoubleQuotes || hasSingleQuotes) {
      return rawValue.slice(1, -1).trim();
    }

    return rawValue;
  }

  return null;
};

const requireDesktopPort = (): number => {
  const fromProcessEnv = process.env.VITE_DESKTOP_PORT;
  const envPath = resolveEnvPath();
  const fromEnvFile = envPath ? readEnvValue(envPath, 'VITE_DESKTOP_PORT') : null;
  const rawValue = fromProcessEnv && fromProcessEnv.trim().length > 0 ? fromProcessEnv : fromEnvFile;

  if (!rawValue || rawValue.trim().length === 0) {
    throw new Error('[Desktop Main] 缺少必要环境变量：VITE_DESKTOP_PORT');
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('[Desktop Main] VITE_DESKTOP_PORT 必须为大于 0 的数字');
  }

  return parsed;
};

function createWindow() {
  const isWindows = process.platform === 'win32';

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    ...(isWindows
      ? { autoHideMenuBar: true }
      : {
          titleBarStyle: 'hidden',
          titleBarOverlay: {
            color: '#ffffff',
            symbolColor: '#000000',
            height: 40,
          },
        }),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
    return;
  }

  const desktopPort = requireDesktopPort();
  win.loadURL(`http://localhost:${desktopPort}`);
  
  // win.webContents.openDevTools();
}

// IPC: PDF 导出
ipcMain.handle(IPC_CHANNELS.pdfExport, async (event, { html, title }: { html: string; title: string }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { success: false, error: '窗口不存在' };

  // 弹出保存对话框
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: '保存 PDF',
    defaultPath: `${title || '文章'}.pdf`,
    filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { success: false, error: 'canceled' };

  // 写临时 HTML 文件，用 loadFile 加载（避免 data: URI 安全限制）
  const tmpFile = path.join(os.tmpdir(), `dede-pdf-${Date.now()}.html`);
  fs.writeFileSync(tmpFile, html, 'utf-8');

  const pdfWin = new BrowserWindow({ show: false });

  try {
    await new Promise<void>((resolve, reject) => {
      pdfWin.webContents.once('did-finish-load', () => resolve());
      pdfWin.webContents.once('did-fail-load', (_e, code, desc) => reject(new Error(`${code}: ${desc}`)));
      pdfWin.loadFile(tmpFile);
    });

    // 等待渲染完成
    await new Promise((r) => setTimeout(r, 500));

    const pdfBuffer = await pdfWin.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
    });
    fs.writeFileSync(filePath, pdfBuffer);
    return { success: true };
  } catch (err) {
    console.error('[PDF] printToPDF error:', err);
    return { success: false, error: String(err) };
  } finally {
    pdfWin.destroy();
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
});

// IPC: 外链跳转（系统默认浏览器）
ipcMain.handle(IPC_CHANNELS.openExternal, async (_event, rawUrl: string) => {
  try {
    const targetUrl = new URL(rawUrl);
    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
      return { success: false, error: '仅支持 http/https 链接' };
    }

    await shell.openExternal(targetUrl.toString());
    return { success: true };
  } catch {
    return { success: false, error: '无效链接' };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
