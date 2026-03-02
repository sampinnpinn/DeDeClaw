import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import NavigationBar from './components/NavigationBar';
import PageContainer from './components/PageContainer';
import ChatPage from './pages/ChatPage';
import AssetsPage from './pages/AssetsPage';
import ArticlePage from './pages/ArticlePage';
import LibraryPage from './pages/LibraryPage';
import MarketPage from './pages/MarketPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SharePage from './pages/SharePage';
import type { ChannelData } from './shared/types/channel';

function AuthenticatedApp() {
  const [currentPage, setCurrentPage] = useState('chat');
  const [pendingOpenChannel, setPendingOpenChannel] = useState<ChannelData | null>(null);

  const handleTabChange = (tab: string) => {
    setCurrentPage(tab);
  };

  const handleOpenTalentChat = (channel: ChannelData) => {
    setPendingOpenChannel(channel);
    setCurrentPage('chat');
  };

  const isArticlePage = currentPage.startsWith('article:');
  const articleAssetId = isArticlePage ? currentPage.replace('article:', '') : '';
  const activeNavTab = isArticlePage ? 'assets' : currentPage;

  return (
    <div className="flex h-screen bg-white">
      <NavigationBar activeTab={activeNavTab} onTabChange={handleTabChange} />

      <PageContainer pageId="chat" currentPage={currentPage}>
        <ChatPage
          onGoToAssets={() => setCurrentPage('assets')}
          pendingOpenChannel={pendingOpenChannel}
          onPendingOpenChannelHandled={() => setPendingOpenChannel(null)}
        />
      </PageContainer>

      {isArticlePage ? (
        <ArticlePage
          assetId={articleAssetId}
          onBack={() => setCurrentPage('assets')}
        />
      ) : (
        <PageContainer pageId="assets" currentPage={currentPage}>
          <AssetsPage onOpenAsset={(assetId) => setCurrentPage(`article:${assetId}`)} />
        </PageContainer>
      )}

      <PageContainer pageId="library" currentPage={currentPage}>
        <LibraryPage />
      </PageContainer>

      <PageContainer pageId="market" currentPage={currentPage}>
        <MarketPage
          isActive={currentPage === 'market'}
          onOpenTalentChat={handleOpenTalentChat}
        />
      </PageContainer>

      <PageContainer pageId="teamSettings" currentPage={currentPage}>
        <SettingsPage />
      </PageContainer>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  // 分享页面无需登录，优先渲染
  const isSharePage = window.location.pathname === '/share' || window.location.search.includes('token=');
  if (isSharePage) return <SharePage />;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#7678ee] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authView === 'login') {
      return <LoginPage onSwitchToRegister={() => setAuthView('register')} />;
    }
    return <RegisterPage onSwitchToLogin={() => setAuthView('login')} />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
