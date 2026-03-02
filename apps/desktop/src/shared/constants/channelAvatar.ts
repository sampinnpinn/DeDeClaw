export interface ChannelAvatarItem {
  fileName: string;
  avatarUrl: string;
}

type AvatarModuleMap = Record<string, string>;

const avatarModules = import.meta.glob('../../assets/chat_icon/*.{png,jpg,jpeg,webp,avif,gif}', {
  eager: true,
  import: 'default',
}) as AvatarModuleMap;

export const CHANNEL_AVATAR_ITEMS: ChannelAvatarItem[] = Object.entries(avatarModules)
  .map(([modulePath, avatarUrl]) => ({
    fileName: modulePath.split('/').pop() ?? modulePath,
    avatarUrl,
  }))
  .sort((a, b) => a.fileName.localeCompare(b.fileName, 'en'));

export function getRandomChannelAvatarUrl(): string | null {
  if (CHANNEL_AVATAR_ITEMS.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * CHANNEL_AVATAR_ITEMS.length);
  return CHANNEL_AVATAR_ITEMS[randomIndex]?.avatarUrl ?? null;
}
