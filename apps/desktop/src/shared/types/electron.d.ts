interface ElectronApiResult {
  success: boolean;
  error?: string;
}

interface ElectronApi {
  exportPdf: (html: string, title: string) => Promise<ElectronApiResult>;
  openExternal: (url: string) => Promise<ElectronApiResult>;
}

interface Window {
  electronAPI?: ElectronApi;
}
