import type { LucideIcon } from 'lucide-react';

export type AdminMenuKey =
  | 'dashboard'
  | 'users'
  | 'api'
  | 'talent'
  | 'system'
  | 'logs';

export interface AdminMenuItem {
  key: AdminMenuKey;
  label: string;
  path: string;
  icon: LucideIcon;
}
