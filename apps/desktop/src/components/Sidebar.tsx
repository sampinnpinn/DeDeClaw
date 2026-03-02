import { Group } from '../mockData';

interface SidebarProps {
  groups: Group[];
  selectedGroupId: string;
  onSelectGroup: (groupId: string) => void;
}

function Sidebar({ groups, selectedGroupId, onSelectGroup }: SidebarProps) {
  return (
    <div className="w-20 bg-gray-900 flex flex-col items-center py-3 gap-2">
      {/* Logo */}
      <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center mb-2 cursor-pointer hover:rounded-xl transition-all">
        <span className="text-white font-bold text-xl">D</span>
      </div>

      {/* 分隔线 */}
      <div className="w-8 h-0.5 bg-gray-700 rounded-full mb-1" />

      {/* 群组列表 */}
      {groups.map((group) => (
        <div
          key={group.id}
          className="relative group cursor-pointer"
          onClick={() => onSelectGroup(group.id)}
        >
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-semibold transition-all
              ${selectedGroupId === group.id
                ? 'bg-primary rounded-xl'
                : 'bg-gray-700 hover:bg-primary hover:rounded-xl'
              }`}
          >
            {group.name.charAt(0)}
          </div>

          {/* 未读消息徽章 */}
          {group.unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {group.unreadCount > 9 ? '9+' : group.unreadCount}
            </div>
          )}

          {/* 选中指示器 */}
          {selectedGroupId === group.id && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full" />
          )}

          {/* Tooltip */}
          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
            {group.name}
          </div>
        </div>
      ))}

      {/* 添加群组按钮 */}
      <div className="w-12 h-12 rounded-2xl bg-gray-700 hover:bg-green-600 hover:rounded-xl flex items-center justify-center text-green-500 hover:text-white cursor-pointer transition-all mt-auto">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </div>
    </div>
  );
}

export default Sidebar;
