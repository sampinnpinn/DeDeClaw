import {
  Cable,
  Cpu,
  LayoutDashboard,
  Logs,
  Users,
  Wrench,
} from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import styles from './AppShell.module.css';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminSocket } from '@/hooks/useAdminSocket';
import type { AdminMenuItem } from '@/shared/types/navigation';

const menus: AdminMenuItem[] = [
  { key: 'dashboard', label: '概览看板', path: '/dashboard', icon: LayoutDashboard },
  { key: 'users', label: '用户信息', path: '/users', icon: Users },
  { key: 'api', label: 'API 管理', path: '/api', icon: Cable },
  { key: 'talent', label: '人才市场', path: '/talent', icon: Cpu },
  { key: 'system', label: '系统配置', path: '/system', icon: Wrench },
  { key: 'logs', label: '日志中心', path: '/logs', icon: Logs },
];

const pageSubtitles: Record<string, string> = {
  '/dashboard': '实时观察 Electron 同步与模型调用状态',
  '/users': '查看来自主进程上报的用户与活跃数据',
  '/api': '维护大模型供应商配置并下发到 Electron 客户端',
  '/talent': '管理人才市场展示与可用状态',
  '/system': '设置同步频率、心跳与维护模式',
  '/logs': '追踪 IPC 与 API 调用日志',
};

export default function AppShell() {
  const location = useLocation();
  const { logout, authState } = useAuth();
  const { isConnected } = useAdminSocket();

  const title = useMemo(() => {
    const matched = menus.find((item) => location.pathname.endsWith(item.path));
    return matched?.label ?? '管理后台';
  }, [location.pathname]);

  const subtitle = pageSubtitles[location.pathname] ?? '后台管理';
  const isDashboard = location.pathname === '/dashboard';

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <h1 className={styles.brandTitle}>DeDe Admin</h1>
          <p className={styles.brandDesc}>独立账号体系 /admin</p>
        </div>

        <nav className={styles.menu}>
          {menus.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.key}
                to={item.path}
                className={({ isActive }) =>
                  `${styles.menuButton} ${isActive ? styles.menuButtonActive : ''}`
                }
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>{title}</h2>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
          {isDashboard && (
            <div className={styles.headerActions}>
              <span
                className={`${styles.connection} ${
                  isConnected ? styles.connectionOnline : styles.connectionOffline
                }`}
              >
                {isConnected ? 'WebSocket 已连接' : 'WebSocket 未连接'}
              </span>
              <span className={styles.subtitle}>当前账号：{authState.username}</span>
              <button type="button" className={styles.logoutButton} onClick={logout}>
                退出登录
              </button>
            </div>
          )}
        </header>

        <Outlet />
      </main>
    </div>
  );
}
