import { useEffect, useState } from 'react';
import PageCard from '@/components/PageCard';
import PageErrorBoundary from '@/components/PageErrorBoundary';
import Modal from '@/components/Modal';
import { deleteUser, fetchUsers } from '@/services/adminService';
import type { AdminUser } from '@/shared/types/admin';
import styles from './PageLayout.module.css';

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; user: AdminUser | null }>({
    isOpen: false,
    user: null,
  });
  const [isDeleting, setIsDeleting] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const list = await fetchUsers();
      setUsers(list);
    } catch (error) {
      console.error('加载用户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleDeleteClick = (user: AdminUser) => {
    setDeleteModal({ isOpen: true, user });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.user) return;

    try {
      setIsDeleting(true);
      const success = await deleteUser(deleteModal.user.userId);
      if (success) {
        setUsers(users.filter((u) => u.userId !== deleteModal.user!.userId));
        setDeleteModal({ isOpen: false, user: null });
      } else {
        alert('删除失败');
      }
    } catch (error) {
      console.error('删除用户失败:', error);
      alert('删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <PageErrorBoundary>
      <div className={styles.grid}>
        <PageCard title="用户管理">
          {loading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-gray-500">暂无用户数据</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">用户 ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">用户名</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">邮箱</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">工作空间</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">注册时间</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.userId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm font-mono text-gray-900">{user.userId}</td>
                      <td className="py-3 px-4 text-sm text-gray-900">{user.username}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{user.email}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {user.workspaces.map((ws) => (
                          <div key={ws.workspaceId} className="text-xs">
                            {ws.name} ({ws.role})
                          </div>
                        ))}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <button
                          onClick={() => handleDeleteClick(user)}
                          className="px-3 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 text-xs"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PageCard>
      </div>

      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, user: null })}
        title="确认删除用户"
        onConfirm={handleDeleteConfirm}
        confirmText="删除"
        cancelText="取消"
        confirmButtonVariant="danger"
        isSubmitting={isDeleting}
      >
        <p className="mb-2">
          确定要删除用户 <strong>{deleteModal.user?.username}</strong> 吗？
        </p>
        <p className="text-gray-500 text-xs">
          用户 ID: {deleteModal.user?.userId}
          <br />
          邮箱: {deleteModal.user?.email}
        </p>
        <p className="mt-4 text-red-600 font-medium">此操作不可恢复！</p>
      </Modal>
    </PageErrorBoundary>
  );
}
