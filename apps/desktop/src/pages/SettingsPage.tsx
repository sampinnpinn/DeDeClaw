import { useState, useEffect, useRef } from 'react';
import { Settings, Bell, User, Info, Upload, LogOut, Trash2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import Select from '../components/Select';
import Checkbox from '../components/Checkbox';
import Toast, { type ToastType } from '../components/Toast';

function SettingsPage() {
  const logoUrl = `${import.meta.env.BASE_URL}logo.svg`;
  const docsUrl = 'https://dedechat.apifox.cn/';
  const { t, i18n } = useTranslation();
  const { user, workspace, logout, updateProfile } = useAuth();
  const [activeSection, setActiveSection] = useState('profile');
  const [language, setLanguage] = useState(i18n.language || 'zh-CN');
  const [selectedTheme] = useState('light');
  const [isAvatarHovered, setIsAvatarHovered] = useState(false);
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [signature, setSignature] = useState(user?.signature || '');
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(user?.avatar);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<ToastType>('success');
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [memberRoles, setMemberRoles] = useState<Record<number, string>>({
    1: 'admin',
    2: 'member',
    3: 'member',
    4: 'guest',
  });

  const userUID = user?.userId || '';
  const [spaceCode, setSpaceCode] = useState(workspace?.invitationCode || '');

  const generateSpaceCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSpaceCode(`${userUID}-${code}`);
    showToast('邀请码已重新生成', 'success');
  };

  const handleOpenExternalLink = async () => {
    try {
      if (!window.electronAPI?.openExternal) {
        showToast('当前环境不支持外链打开', 'error');
        return;
      }
      const result = await window.electronAPI?.openExternal(docsUrl);
      if (result?.success === false) {
        showToast(result.error || '打开链接失败', 'error');
      }
    } catch {
      showToast('打开链接失败', 'error');
    }
  };
  const [autoStart, setAutoStart] = useState(true);
  const [minimizeToTray, setMinimizeToTray] = useState(false);
  const [notifications, setNotifications] = useState({
    newMessage: true,
    mention: true,
    systemUpdate: true,
    teamInvite: true,
  });

  const roleOptions = [
    { value: 'admin', label: t('settings.team.roles.admin') },
    { value: 'member', label: t('settings.team.roles.member') },
    { value: 'guest', label: t('settings.team.roles.guest') },
    { value: 'remove', label: t('settings.team.roles.remove') },
  ];

  const languageOptions = [
    { value: 'zh-CN', label: '简体中文' },
    { value: 'en-US', label: 'English' },
  ];

  const themes = [
    { id: 'light', label: t('settings.general.themes.light'), image: '/light-theme.png' },
    { id: 'system', label: t('settings.general.themes.system'), image: '/system-theme.png' },
    { id: 'dark', label: t('settings.general.themes.dark'), image: '/dark-theme.png' },
  ];

  const sections = [
    { id: 'profile', label: t('settings.sections.profile'), icon: User },
    // { id: 'team', label: t('settings.sections.team'), icon: Users },
    { id: 'general', label: t('settings.sections.general'), icon: Settings },
    { id: 'notifications', label: t('settings.sections.notifications'), icon: Bell },
    { id: 'about', label: t('settings.sections.about'), icon: Info },
  ];

  const handleLanguageChange = (nextLanguage: string) => {
    setLanguage(nextLanguage);
    localStorage.setItem('language', nextLanguage);
    void i18n.changeLanguage(nextLanguage);
  };

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setEmail(user.email);
      setSignature(user.signature || '');
      setAvatarPreview(user.avatar);
    }
  }, [user]);

  useEffect(() => {
    if (workspace) {
      setSpaceCode(workspace.invitationCode);
    }
  }, [workspace]);

  const showToast = (message: string, type: ToastType) => {
    setToastMessage(message);
    setToastType(type);
    setIsToastVisible(false);

    window.requestAnimationFrame(() => {
      setIsToastVisible(true);
    });
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('图片大小不能超过 2MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setAvatarPreview(base64);
    };
    reader.readAsDataURL(file);

    event.target.value = '';
  };

  const handleProfileSave = async () => {
    if (!username.trim()) {
      showToast(t('settings.profile.toast.usernameRequired'), 'error');
      return;
    }

    setIsSaving(true);
    try {
      const updateData: { username?: string; signature?: string; avatar?: string } = {};

      if (username !== user?.username) updateData.username = username.trim();
      if (signature !== (user?.signature ?? '')) updateData.signature = signature;
      if (avatarPreview !== user?.avatar) updateData.avatar = avatarPreview;

      if (Object.keys(updateData).length === 0) {
        showToast('没有需要保存的更改', 'success');
        return;
      }

      const result = await updateProfile(updateData);
      if (result.success) {
        showToast(t('settings.profile.toast.saveSuccess'), 'success');
      } else {
        showToast(result.message || '保存失败', 'error');
      }
    } catch (error) {
      console.error('Save profile error:', error);
      showToast('保存失败，请检查网络连接', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex bg-[#F5F7FA]">
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={isToastVisible}
        onClose={() => setIsToastVisible(false)}
      />
      <div className="w-64 bg-[#E8E9F3] border-r border-gray-100 flex flex-col">
        <div className="h-16 px-6 flex items-center border-b border-gray-200/50" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          <div className="flex items-center gap-3">
            <Settings size={24} className="text-gray-700" />
            <h1 className="text-xl font-bold text-gray-900">{t('settings.title')}</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
                  isActive
                    ? 'bg-white/60 text-gray-900'
                    : 'text-gray-700 hover:bg-white/40'
                }`}
              >
                <Icon size={18} />
                <span className="text-sm font-medium">{section.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {activeSection === 'profile' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">{t('settings.profile.title')}</h3>
                <div className="flex items-center gap-6 mb-6">
                  <div 
                    className="relative w-20 h-20 rounded-full cursor-pointer group flex-shrink-0"
                    onMouseEnter={() => setIsAvatarHovered(true)}
                    onMouseLeave={() => setIsAvatarHovered(false)}
                    onClick={handleAvatarClick}
                  >
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="avatar"
                        className="w-20 h-20 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
                        {username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {isAvatarHovered && (
                      <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center transition-all">
                        <Upload size={24} className="text-white" />
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </div>
                  <div className="flex-1 flex items-center justify-between">
                    <div className="text-sm text-gray-500">UID: <span className="font-mono">{userUID}</span></div>
                    <button
                      onClick={handleProfileSave}
                      disabled={isSaving}
                      className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? '保存中...' : t('settings.profile.save')}
                    </button>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.profile.username')}</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#7678ee]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.profile.email')}</label>
                    <input
                      type="email"
                      value={email}
                      disabled
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.profile.signature')}</label>
                    <textarea
                      rows={3}
                      value={signature}
                      onChange={(event) => setSignature(event.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#7678ee] resize-none"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">{t('settings.profile.accountSecurity')}</h3>
                <div className="space-y-3">
                  <button disabled className="w-full flex items-center justify-between py-3 border-b border-gray-100 cursor-not-allowed">
                    <span className="text-gray-400">{t('settings.profile.changePassword')}</span>
                    <span className="text-sm text-gray-400">›</span>
                  </button>
                  <button disabled className="w-full flex items-center justify-between py-3 cursor-not-allowed">
                    <span className="text-gray-400">{t('settings.profile.twoFactor')}</span>
                    <span className="text-sm text-gray-400">{t('settings.profile.notEnabled')}</span>
                  </button>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">{t('settings.profile.accountManagement')}</h3>
                <div className="space-y-3">
                  <button 
                    onClick={() => {
                      logout();
                      showToast('已退出登录', 'success');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <LogOut size={18} />
                    <span>{t('settings.about.logout')}</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={18} />
                    <span>{t('settings.profile.deactivateAccount')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'team' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">{t('settings.team.title')}</h3>
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((member) => (
                    <div key={member} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500" />
                        <div>
                          <div className="font-medium text-gray-900">{t('settings.team.members')} {member}</div>
                          <div className="text-sm text-gray-500">member{member}@example.com</div>
                        </div>
                      </div>
                      <div className="w-32">
                        <Select
                          options={roleOptions}
                          value={memberRoles[member]}
                          onChange={(value) => {
                            if (value === 'remove') {
                              console.log(`移除成员 ${member}`);
                            } else {
                              setMemberRoles({ ...memberRoles, [member]: value });
                            }
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">{t('settings.team.spaceCode')}</h3>
                  <button 
                    onClick={generateSpaceCode}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title={t('settings.team.regenerate')}
                  >
                    <RefreshCw size={18} className="text-gray-600" />
                  </button>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="text-center">
                    <div className="text-lg font-mono font-semibold text-gray-900 tracking-wider">
                      {spaceCode}
                    </div>
                    <p className="text-sm text-gray-500 mt-2">{t('settings.team.spaceCodeDesc')}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(spaceCode);
                    showToast('邀请码已复制到剪贴板', 'success');
                  }}
                  className="w-full px-6 py-2 bg-[#7678ee] text-white rounded-lg hover:bg-[#ff4f42] transition-colors"
                >
                  {t('settings.team.copySpaceCode')}
                </button>
              </div>
            </div>
          )}

          {activeSection === 'general' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">{t('settings.general.theme')}</h3>
                <div className="flex gap-3">
                  {themes.map((theme) => (
                    <div
                      key={theme.id}
                      className="flex flex-col items-center gap-2 opacity-60 cursor-not-allowed"
                    >
                      <div
                        className={`rounded-xl border-2 transition-all p-2 ${
                          selectedTheme === theme.id
                            ? 'border-[#7678ee]'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className={`w-16 h-12 rounded-lg ${
                          theme.id === 'light' ? 'bg-white border border-gray-200' :
                          theme.id === 'dark' ? 'bg-gray-800' :
                          'bg-gradient-to-br from-gray-300 to-gray-600'
                        } flex items-center justify-center`}>
                          <div className="space-y-0.5 w-5">
                            <div className={`h-0.5 rounded ${
                              theme.id === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
                            }`} />
                            <div className={`h-0.5 rounded w-3/4 ${
                              theme.id === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
                            }`} />
                            <div className={`h-1 rounded-full w-1 ml-auto ${
                              theme.id === 'dark' ? 'bg-gray-500' : 'bg-gray-400'
                            }`} />
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-medium text-gray-900">{theme.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">{t('settings.general.language')}</h3>
                <Select
                  options={languageOptions}
                  value={language}
                  onChange={handleLanguageChange}
                />
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">{t('settings.general.startup')}</h3>
                <div className="space-y-4 opacity-60">
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <Checkbox
                      checked={autoStart}
                      onChange={setAutoStart}
                      label={t('settings.general.autoStart')}
                      className="flex-1"
                      disabled
                    />
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <Checkbox
                      checked={minimizeToTray}
                      onChange={setMinimizeToTray}
                      label={t('settings.general.minimizeToTray')}
                      className="flex-1"
                      disabled
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">{t('settings.notifications.title')}</h3>
              <div className="space-y-4 opacity-60">
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <Checkbox
                    checked={notifications.newMessage}
                    onChange={(checked) => setNotifications({ ...notifications, newMessage: checked })}
                    label={t('settings.notifications.newMessage')}
                    className="flex-1"
                    disabled
                  />
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <Checkbox
                    checked={notifications.mention}
                    onChange={(checked) => setNotifications({ ...notifications, mention: checked })}
                    label={t('settings.notifications.mention')}
                    className="flex-1"
                    disabled
                  />
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <Checkbox
                    checked={notifications.systemUpdate}
                    onChange={(checked) => setNotifications({ ...notifications, systemUpdate: checked })}
                    label={t('settings.notifications.systemUpdate')}
                    className="flex-1"
                    disabled
                  />
                </div>
                <div className="flex items-center justify-between py-3">
                  <Checkbox
                    checked={notifications.teamInvite}
                    onChange={(checked) => setNotifications({ ...notifications, teamInvite: checked })}
                    label={t('settings.notifications.teamInvite')}
                    className="flex-1"
                    disabled
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'about' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex flex-col items-center py-6">
                  <img
                    src={logoUrl}
                    alt="DeDe Chat Logo"
                    className="w-20 h-20 rounded-2xl mb-4 object-cover"
                  />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">DeDe Chat</h3>
                  <p className="text-gray-500 mb-4">{t('settings.about.version')} 1.0.0</p>
                  <p className="text-sm text-gray-400 text-center max-w-md">
                    {t('settings.about.description')}
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">{t('settings.about.systemInfo')}</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">{t('settings.about.currentVersion')}</span>
                    <span className="text-gray-900">1.0.0</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-500">{t('settings.about.lastUpdated')}</span>
                    <span className="text-gray-900">2026-02-16</span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
                  <button
                    onClick={handleOpenExternalLink}
                    className="hover:text-gray-600 transition-colors underline"
                  >
                    {t('settings.about.docs')}
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={handleOpenExternalLink}
                    className="hover:text-gray-600 transition-colors underline"
                  >
                    {t('settings.about.feedback')}
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={handleOpenExternalLink}
                    className="hover:text-gray-600 transition-colors underline"
                  >
                    {t('settings.about.contact')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
