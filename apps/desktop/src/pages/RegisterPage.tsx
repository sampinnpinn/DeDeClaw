import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Toast, { type ToastType } from '../components/Toast';

interface RegisterPageProps {
  onSwitchToLogin: () => void;
}

function RegisterPage({ onSwitchToLogin }: RegisterPageProps) {
  const logoUrl = `${import.meta.env.BASE_URL}logo.svg`;
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<ToastType>('success');
  const [isToastVisible, setIsToastVisible] = useState(false);

  const showToast = (message: string, type: ToastType) => {
    setToastMessage(message);
    setToastType(type);
    setIsToastVisible(false);
    window.requestAnimationFrame(() => {
      setIsToastVisible(true);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !username) {
      showToast('请填写所有必填字段', 'error');
      return;
    }

    if (password.length < 6) {
      showToast('密码至少需要6个字符', 'error');
      return;
    }

    setIsLoading(true);
    const result = await register(email, password, username, 'creator');
    setIsLoading(false);

    if (!result.success) {
      showToast(result.message, 'error');
    }
  };

  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-[#fafafa]">
      {/* 动态呼吸渐变背景 - 优雅双色块 */}
      <div className="absolute inset-0 w-full h-full">
        <div className="absolute top-[10%] left-[15%] w-[40rem] h-[40rem] bg-[#7678ee] rounded-full mix-blend-multiply filter blur-[120px] opacity-20 animate-blob"></div>
        <div className="absolute bottom-[10%] right-[15%] w-[40rem] h-[40rem] bg-[#ff8a7a] rounded-full mix-blend-multiply filter blur-[120px] opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={isToastVisible}
        onClose={() => setIsToastVisible(false)}
      />

      {/* 可拖拽的顶部区域 */}
      <div 
        className="absolute top-0 left-0 right-0 h-8 z-50 cursor-move"
        style={{ 
          WebkitAppRegion: 'drag',
          background: 'transparent'
        } as React.CSSProperties & { WebkitAppRegion: string }}
      />
      
      <div className="relative z-10 flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/20 p-8">
            <div className="flex flex-col items-center mb-8">
              <img
                src={logoUrl}
                alt="DeDe Chat Logo"
                className="w-20 h-20 mb-4 object-contain rounded-xl shadow-sm bg-white"
              />
              <h1 className="text-2xl font-bold text-gray-900">创建账号</h1>
              <p className="text-gray-500 mt-2">加入 DeDe Chat 社区</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  用户名
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg outline-none focus:border-[#7678ee] transition-colors bg-white/50"
                  placeholder="你的名字"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  邮箱地址
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg outline-none focus:border-[#7678ee] transition-colors bg-white/50"
                  placeholder="your@email.com"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  密码
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg outline-none focus:border-[#7678ee] transition-colors bg-white/50"
                  placeholder="至少6个字符"
                  disabled={isLoading}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[#7678ee] text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? '注册中...' : '注册'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={onSwitchToLogin}
                className="text-sm text-gray-600 transition-colors"
              >
                已有账号？<span className="font-medium">立即登录</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
