import { useCallback, useEffect, useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { playTapSound } from '../lib/sounds';
import { getBlockRowsForUser, getBlockStateFromRows } from '../lib/userBlocks';

export default function ConversationList({ isOpen, onClose, onSelectConversation, onOpenFindUsers }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Format email to show username only
  const formatUsername = (email) => {
    if (!email) return 'Unknown User';
    return email.split('@')[0];
  };

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id);
    };
    getUser();
  }, []);

  const getConversationActivityTime = (conversation) => {
    return (
      conversation.last_message?.created_at ||
      conversation.updated_at ||
      conversation.created_at ||
      ''
    );
  };

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!currentUserId) return;

    setLoading(true);
    try {
      const { data: participantEntries, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', currentUserId);

      if (participantError) throw participantError;

      if (!participantEntries || participantEntries.length === 0) {
        setConversations([]);
        return;
      }

      const conversationIds = [...new Set(participantEntries.map((entry) => entry.conversation_id))];

      const [
        { data: conversationRows, error: convError },
        { data: participantRows, error: partError },
        { data: messageRows, error: msgError }
      ] = await Promise.all([
        supabase
          .from('conversations')
          .select('*')
          .in('id', conversationIds),
        supabase
          .from('conversation_participants')
          .select('conversation_id, user_id')
          .in('conversation_id', conversationIds),
        supabase
          .from('messages')
          .select('id, conversation_id, sender_id, content, photo_url, read_at, created_at')
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false })
      ]);

      if (convError) throw convError;
      if (partError) throw partError;
      if (msgError) throw msgError;

      const participantsByConversation = new Map();
      const otherUserIds = new Set();

      for (const participant of participantRows || []) {
        const existingParticipants = participantsByConversation.get(participant.conversation_id) || [];
        existingParticipants.push(participant);
        participantsByConversation.set(participant.conversation_id, existingParticipants);

        if (participant.user_id !== currentUserId) {
          otherUserIds.add(participant.user_id);
        }
      }

      const lastMessageByConversation = new Map();
      for (const message of messageRows || []) {
        if (!lastMessageByConversation.has(message.conversation_id)) {
          lastMessageByConversation.set(message.conversation_id, message);
        }

        if (message.sender_id && message.sender_id !== currentUserId) {
          otherUserIds.add(message.sender_id);
        }
      }

      let profilesById = new Map();
      if (otherUserIds.size > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', [...otherUserIds]);

        if (profileError) throw profileError;

        profilesById = new Map((profileRows || []).map((profile) => [profile.id, profile]));
      }

      const blockRows = await getBlockRowsForUser(currentUserId);

      const conversationsWithDetails = (conversationRows || [])
        .map((conversation) => {
          const participants = participantsByConversation.get(conversation.id) || [];
          const lastMessage = lastMessageByConversation.get(conversation.id) || null;

          const otherParticipant = participants.find((participant) => participant.user_id !== currentUserId);
          const fallbackUserId = lastMessage?.sender_id !== currentUserId ? lastMessage?.sender_id : null;
          const otherUserId = otherParticipant?.user_id || fallbackUserId;
          const blockState = getBlockStateFromRows(currentUserId, otherUserId, blockRows);

          return {
            ...conversation,
            conversation_participants: participants.map((participant) => ({
              ...participant,
              profiles: participant.user_id === currentUserId ? null : profilesById.get(participant.user_id) || null
            })),
            last_message: lastMessage,
            has_unread: Boolean(lastMessage && lastMessage.sender_id !== currentUserId && !lastMessage.read_at && !blockState.hasBlock),
            other_user: otherUserId ? profilesById.get(otherUserId) || null : null,
            is_blocked: blockState.hasBlock,
            blocked_by_me: blockState.blockedByMe,
            blocked_me: blockState.blockedMe
          };
        })
        .sort((a, b) => getConversationActivityTime(b).localeCompare(getConversationActivityTime(a)));

      setConversations(conversationsWithDetails);
    } catch (err) {
      console.error('Error loading conversations:', err);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  // Initial load when component opens
  useEffect(() => {
    if (isOpen && currentUserId) {
      loadConversations();
    }
  }, [isOpen, currentUserId, loadConversations]);

  // Realtime for new conversations and new messages
  useEffect(() => {
    if (!isOpen || !currentUserId) return;
    
    // Listen for new conversation participants
    const participantSub = supabase
      .channel('new-conversation-participants')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversation_participants'
      }, () => {
        loadConversations();
      })
      .subscribe();
      
    // Listen for new messages
    const messageSub = supabase
      .channel('new-messages-for-conversations')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, () => {
        loadConversations();
      })
      .subscribe();

    const blockSub = supabase
      .channel('user-block-updates-for-conversations')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_blocks'
      }, () => {
        loadConversations();
      })
      .subscribe();
      
    return () => {
      participantSub.unsubscribe();
      messageSub.unsubscribe();
      blockSub.unsubscribe();
    };
  }, [isOpen, currentUserId, loadConversations]);

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
              const otherUser = conv.other_user;

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    playTapSound();
                    onSelectConversation(conv);
                  }}
                  className="flex items-center gap-3 rounded-xl bg-app-bg border border-glass-border p-4 cursor-pointer hover:border-white/20 transition-all active:scale-[0.98]"
                >
                  <div className="relative">
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-card-elevated text-text-main font-bold">
                      {formatUsername(otherUser?.email)?.charAt(0).toUpperCase() || '?'}
                    </div>
                    {/* Unread indicator */}
                    {conv.has_unread && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent-lime rounded-full border-2 border-app-bg" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-text-main truncate">
                      {formatUsername(otherUser?.email)}
                    </p>
                    <p className="text-xs text-text-muted truncate">
                      {conv.blocked_by_me
                        ? 'You blocked this user'
                        : conv.blocked_me
                          ? 'This user blocked you'
                          : conv.last_message?.content || 'Tap to open chat'}
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
