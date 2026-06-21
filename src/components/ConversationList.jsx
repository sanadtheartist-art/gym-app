import { useEffect, useState } from 'react';
import { X, MessageSquare, Plus, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { playTapSound } from '../lib/sounds';

export default function ConversationList({ isOpen, onClose, onSelectConversation, onOpenFindUsers }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      console.log('Loading conversations...');
      
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          conversation_participants (
            user_id,
            profiles (
              id,
              email
            )
          )
        `)
        .order('updated_at', { ascending: false });

      if (!error) {
        console.log('Conversations loaded:', data);
        setConversations(data || []);
      } else {
        console.error('Error loading conversations:', error);
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-3xl rounded-t-[32px] glass-card sheet-content p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-extrabold text-text-main">Conversations</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                playTapSound();
                onClose();
                onOpenFindUsers();
              }}
              className="grid h-10 w-10 place-items-center rounded-xl bg-accent-lime text-app-bg transition active:scale-95"
            >
              <UserPlus size={20} />
            </button>
            <button
              onClick={() => {
                playTapSound();
                onClose();
              }}
              className="grid h-10 w-10 place-items-center rounded-xl bg-card-elevated text-text-main transition active:scale-95"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Conversations List */}
        <div className="space-y-2">
          {loading ? (
            <div className="py-8 text-center text-text-muted">Loading conversations...</div>
          ) : conversations.length === 0 ? (
            <div className="py-8 text-center text-text-muted">No conversations yet</div>
          ) : (
            conversations.map((conv) => {
              // Get other participant
              const currentUserId = (supabase.auth.getUser()).data.user?.id;
              const otherParticipants = conv.conversation_participants?.filter(
                (p) => p.user_id !== currentUserId
              );
              const otherUser = otherParticipants?.[0]?.profiles;

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    playTapSound();
                    onSelectConversation(conv);
                  }}
                  className="flex items-center gap-3 rounded-xl bg-app-bg border border-glass-border p-4 cursor-pointer hover:border-white/20 transition-all active:scale-[0.98]"
                >
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-card-elevated text-text-main font-bold">
                    {otherUser?.email?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-text-main truncate">
                      {otherUser?.email || 'Unknown User'}
                    </p>
                    <p className="text-xs text-text-muted truncate">
                      Tap to open chat
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
