import { contextBridge, ipcRenderer } from 'electron';

const IPC_CHANNELS = {
  pdfExport: 'ipc:pdf:export',
  openExternal: 'ipc:shell:openExternal',
} as const;

interface ElectronApiResult {
  success: boolean;
  error?: string;
}

contextBridge.exposeInMainWorld('electronAPI', {
  exportPdf: (html: string, title: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.pdfExport, { html, title }) as Promise<ElectronApiResult>,
  openExternal: (url: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.openExternal, url) as Promise<ElectronApiResult>,
});
