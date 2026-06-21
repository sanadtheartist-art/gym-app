import { supabase } from './supabase';

const MESSAGE_PHOTO_EXPIRY_HOURS = 48;
const MESSAGE_PHOTO_EXPIRY_MS = MESSAGE_PHOTO_EXPIRY_HOURS * 60 * 60 * 1000;

function getMessageAttachmentPath(photoUrl) {
  if (!photoUrl) return null;

  const marker = '/storage/v1/object/public/message-attachments/';
  const markerIndex = photoUrl.indexOf(marker);

  if (markerIndex === -1) return null;

  return photoUrl.slice(markerIndex + marker.length);
}

async function cleanupExpiredMessagePhotos() {
  const cutoffDate = new Date(Date.now() - MESSAGE_PHOTO_EXPIRY_MS).toISOString();

  const { data: expiredMessages, error: expiredMessagesError } = await supabase
    .from('messages')
    .select('id, content, photo_url, created_at')
    .not('photo_url', 'is', null)
    .lt('created_at', cutoffDate);

  if (expiredMessagesError) {
    console.error('Error loading expired message photos', expiredMessagesError);
    return;
  }

  if (!expiredMessages || expiredMessages.length === 0) {
    return;
  }

  const filesToDelete = expiredMessages
    .map((message) => getMessageAttachmentPath(message.photo_url))
    .filter(Boolean);

  if (filesToDelete.length > 0) {
    for (let i = 0; i < filesToDelete.length; i += 100) {
      const batch = filesToDelete.slice(i, i + 100);
      const { error } = await supabase.storage
        .from('message-attachments')
        .remove(batch);

      if (error) {
        console.error('Error removing expired message photos', error);
      }
    }
  }

  const messageIds = expiredMessages.map((message) => message.id);
  const photoOnlyMessageIds = expiredMessages
    .filter((message) => !message.content?.trim())
    .map((message) => message.id);

  const { error: clearPhotoError } = await supabase
    .from('messages')
    .update({ photo_url: null })
    .in('id', messageIds);

  if (clearPhotoError) {
    console.error('Error clearing expired photo URLs', clearPhotoError);
  }

  if (photoOnlyMessageIds.length > 0) {
    const { error: expiredLabelError } = await supabase
      .from('messages')
      .update({ content: 'Photo expired' })
      .in('id', photoOnlyMessageIds)
      .is('content', null);

    if (expiredLabelError) {
      console.error('Error labeling expired photo-only messages', expiredLabelError);
    }
  }
}

export async function cleanupOldMedia() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // Only run if authenticated

    await cleanupExpiredMessagePhotos();

    // 60 days ago
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 60);

    let hasMore = true;
    let offset = 0;
    const filesToDelete = [];

    while (hasMore) {
      const { data, error } = await supabase.storage
        .from('workout-media')
        .list('entries', {
          limit: 100,
          offset,
          sortBy: { column: 'created_at', order: 'asc' },
        });

      if (error) {
        console.error('Error listing media for cleanup', error);
        break;
      }

      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }

      for (const file of data) {
        // Supabase returns a placeholder folder object sometimes like ".emptyFolderPlaceholder"
        if (file.name === '.emptyFolderPlaceholder') continue;

        const created = new Date(file.created_at);
        if (created < cutoffDate) {
          filesToDelete.push(`entries/${file.name}`);
        }
      }

      if (data.length < 100) {
        hasMore = false;
      } else {
        offset += 100;
      }
    }

    if (filesToDelete.length > 0) {
      console.log(`Cleaning up ${filesToDelete.length} old media files...`);
      // Delete in batches of 100
      for (let i = 0; i < filesToDelete.length; i += 100) {
        const batch = filesToDelete.slice(i, i + 100);
        const { error } = await supabase.storage
          .from('workout-media')
          .remove(batch);
        
        if (error) {
          console.error('Error removing old media', error);
        }
      }
      console.log('Media cleanup complete.');
    }
  } catch (err) {
    console.error('Cleanup media failed:', err);
  }
}
