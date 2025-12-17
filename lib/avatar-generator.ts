import { createAvatar } from '@dicebear/core';
import { funEmoji } from '@dicebear/collection';

export type AvatarStyle = 'fun' | 'robot' | 'shapes' | 'person';

/**
 * Generate a fun, consistent avatar for a user based on their ID
 * No API key needed - generates locally
 */
export function generateUserAvatar(userId: string): string {
  const avatar = createAvatar(funEmoji, {
    seed: userId, // Same userId = same avatar always
    backgroundColor: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf'],
    size: 128,
  });

  // Returns a data URI that can be used directly in <img src="">
  return avatar.toDataUri();
}

/**
 * Get avatar URL - either custom uploaded avatar or generated avatar
 */
export function getUserAvatarUrl(userId: string, customAvatarUrl?: string | null): string {
  if (customAvatarUrl) {
    return customAvatarUrl;
  }
  return generateUserAvatar(userId);
}
