import { MessageSquare, Package, Library, Brain, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface NavigationBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const iconMap = {
  chat: MessageSquare,
  assets: Package,
  library: Library,
  market: Brain,
};

function NavigationBar({ activeTab, onTabChange }: NavigationBarProps) {
  const { t } = useTranslation();
  const logoUrl = `${import.meta.env.BASE_URL}logo.png`;
  
  const tabs = [
    { id: 'chat', label: t('nav.chat') },
    { id: 'assets', label: t('nav.assets') },
    { id: 'library', label: t('nav.library') },
    { id: 'market', label: t('nav.market') },
  ];

  // 检测是否为 macOS
  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return (
    <div className="w-20 bg-[#2C2D33] flex flex-col items-center pt-6 pb-2 gap-3">
      {/* Logo */}
      <div className={`w-12 h-12 rounded-2xl bg-white flex items-center justify-center mb-4 cursor-pointer transition-all duration-300 ${isMac ? 'mt-8' : ''}`}>
        <img src={logoUrl} alt="DeDe" className="w-full h-full object-cover rounded-xl" />
      </div>

      {/* 导航按钮 */}
      {tabs.map((tab) => {
        const Icon = iconMap[tab.id as keyof typeof iconMap];
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300
              ${isActive 
                ? 'bg-[#3E3F47] text-white scale-105' 
                : 'text-gray-400 hover:bg-[#3E3F47] hover:text-gray-300'}`}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
          </button>
        );
      })}

      {/* 底部设置按钮 */}
      <div className="mt-auto">
        <button
          onClick={() => onTabChange('teamSettings')}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300
            ${activeTab === 'teamSettings'
              ? 'bg-[#3E3F47] text-white scale-105'
              : 'text-gray-400 hover:bg-[#3E3F47] hover:text-gray-300'}`}
        >
          <Settings size={22} strokeWidth={activeTab === 'teamSettings' ? 2.5 : 2} />
        </button>
      </div>
    </div>
  );
}

export default NavigationBar;
