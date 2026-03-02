import 'i18next';
import zhCN from '../../locales/zh-CN.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof zhCN;
    };
  }
}
