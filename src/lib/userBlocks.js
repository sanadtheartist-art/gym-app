import { supabase } from './supabase';

const DEFAULT_BLOCK_STATE = {
  blockedByMe: false,
  blockedMe: false,
  hasBlock: false,
};

export async function getBlockRowsForUser(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

  if (error) throw error;

  return data || [];
}

export function getBlockedUserIds(userId, blockRows) {
  const blockedUserIds = new Set();

  for (const row of blockRows || []) {
    if (row.blocker_id === userId) {
      blockedUserIds.add(row.blocked_id);
    }

    if (row.blocked_id === userId) {
      blockedUserIds.add(row.blocker_id);
    }
  }

  return blockedUserIds;
}

export function getBlockStateFromRows(userId, otherUserId, blockRows) {
  if (!userId || !otherUserId) return DEFAULT_BLOCK_STATE;

  let blockedByMe = false;
  let blockedMe = false;

  for (const row of blockRows || []) {
    if (row.blocker_id === userId && row.blocked_id === otherUserId) {
      blockedByMe = true;
    }

    if (row.blocker_id === otherUserId && row.blocked_id === userId) {
      blockedMe = true;
    }
  }

  return {
    blockedByMe,
    blockedMe,
    hasBlock: blockedByMe || blockedMe,
  };
}

export async function getBlockStateBetweenUsers(userId, otherUserId) {
  if (!userId || !otherUserId) return DEFAULT_BLOCK_STATE;

  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocker_id, blocked_id')
    .or(
      `and(blocker_id.eq.${userId},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${userId})`
    );

  if (error) throw error;

  return getBlockStateFromRows(userId, otherUserId, data || []);
}

export async function blockUser(userId, otherUserId) {
  if (!userId || !otherUserId) return;

  const { error } = await supabase
    .from('user_blocks')
    .insert({
      blocker_id: userId,
      blocked_id: otherUserId,
    });

  if (error) throw error;
}

export async function unblockUser(userId, otherUserId) {
  if (!userId || !otherUserId) return;

  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', userId)
    .eq('blocked_id', otherUserId);

  if (error) throw error;
}
