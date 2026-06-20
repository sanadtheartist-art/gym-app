import { supabase } from './supabase';

export async function cleanupOldMedia() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // Only run if authenticated

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
