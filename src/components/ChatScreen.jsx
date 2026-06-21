import { useEffect, useState, useRef, useCallback } from 'react';
import { X, Send, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { playTapSound, playSuccessSound } from '../lib/sounds';
import { blockUser, getBlockStateBetweenUsers, unblockUser } from '../lib/userBlocks';

const MESSAGE_PHOTO_EXPIRY_MS = 48 * 60 * 60 * 1000;

export default function ChatScreen({ isOpen, onClose, conversation, otherUser }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [blockState, setBlockState] = useState({
    blockedByMe: false,
    blockedMe: false,
    hasBlock: false,
  });
  const [blockActionLoading, setBlockActionLoading] = useState(false);
  const messagesEndRef = useRef(null);
  
  // Get current user ID
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id);
    };
    getCurrentUser();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const isPhotoExpired = (message) => {
    if (!message?.photo_url || !message?.created_at) return false;
    return Date.now() - new Date(message.created_at).getTime() >= MESSAGE_PHOTO_EXPIRY_MS;
  };

  const loadBlockState = useCallback(async () => {
    if (!currentUserId || !otherUser?.id) {
      setBlockState({
        blockedByMe: false,
        blockedMe: false,
        hasBlock: false,
      });
      return;
    }

    try {
      const nextBlockState = await getBlockStateBetweenUsers(currentUserId, otherUser.id);
      setBlockState(nextBlockState);
    } catch (err) {
      console.error('Error loading block state:', err);
    }
  }, [currentUserId, otherUser?.id]);

  useEffect(() => {
    if (!isOpen) return;
    loadBlockState();
  }, [isOpen, loadBlockState]);

  useEffect(() => {
    if (!isOpen || !currentUserId) return undefined;

    const blockChannel = supabase
      .channel(`chat-blocks:${conversation?.id || 'unknown'}:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_blocks'
        },
        () => {
          loadBlockState();
        }
      )
      .subscribe();

    return () => {
      blockChannel.unsubscribe();
    };
  }, [isOpen, conversation?.id, currentUserId, loadBlockState]);

  const handleToggleBlock = async () => {
    if (!currentUserId || !otherUser?.id || blockState.blockedMe) return;

    const shouldBlock = !blockState.blockedByMe;
    const confirmMessage = shouldBlock
      ? `Block ${otherUser.email?.split('@')[0] || 'this user'}? You will not be able to send messages until you unblock them.`
      : `Unblock ${otherUser.email?.split('@')[0] || 'this user'}?`;

    if (!window.confirm(confirmMessage)) return;

    setBlockActionLoading(true);
    try {
      if (shouldBlock) {
        await blockUser(currentUserId, otherUser.id);
        setBlockState({
          blockedByMe: true,
          blockedMe: false,
          hasBlock: true,
        });
      } else {
        await unblockUser(currentUserId, otherUser.id);
        setBlockState({
          blockedByMe: false,
          blockedMe: false,
          hasBlock: false,
        });
      }
    } catch (err) {
      console.error('Error updating block state:', err);
      alert(`Could not ${shouldBlock ? 'block' : 'unblock'} this user.`);
    } finally {
      setBlockActionLoading(false);
    }
  };

  // Mark messages as read when chat is opened
  const markMessagesAsRead = async () => {
    if (!currentUserId || !conversation?.id) return;
    try {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversation.id)
        .neq('sender_id', currentUserId)
        .is('read_at', null);
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  // Load initial messages and set up realtime subscription
  useEffect(() => {
    if (!isOpen || !conversation?.id) return;

    // 1. Load initial messages
    const loadInitialMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: true });

        if (!error) {
          setMessages(data || []);
          markMessagesAsRead();
        }
      } catch (err) {
        console.error('Error loading messages:', err);
      }
    };
    loadInitialMessages();

    // 2. Set up realtime subscription
    const channel = supabase
      .channel(`chat:${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        async (payload) => {
          console.log('New message:', payload.new);
          setMessages(prev => {
            // Avoid duplicates
            const exists = prev.some(m => m.id === payload.new.id);
            return exists ? prev : [...prev, payload.new];
          });
          
          // Mark as read if it's from someone else
          if (payload.new.sender_id !== currentUserId) {
            await supabase
              .from('messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', payload.new.id);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [isOpen, conversation?.id]);

  // Handle photo upload
  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (blockState.hasBlock) return;

    setSending(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${conversation.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('message-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(filePath);

      await sendMessage(null, data.publicUrl);
    } catch (err) {
      console.error('Error uploading photo:', err);
    } finally {
      setSending(false);
    }
  };

  // Send message
  const sendMessage = async (content = newMessage, photoUrl = null) => {
    if ((!content?.trim() && !photoUrl) || !currentUserId) return;
    if (blockState.blockedByMe) {
      alert('Unblock this user before sending messages.');
      return;
    }

    if (blockState.blockedMe) {
      alert('You cannot send messages because this user blocked you.');
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: currentUserId,
          content: content?.trim() || null,
          photo_url: photoUrl
        });

      if (!error) {
        setNewMessage('');
        playSuccessSound();

        // Update conversation timestamp
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversation.id);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-app-bg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-glass-border bg-app-bg">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              playTapSound();
              onClose();
            }}
            className="grid h-10 w-10 place-items-center rounded-xl bg-card-elevated text-text-main transition active:scale-95"
          >
            <X size={20} />
          </button>
          <div>
            <h2 className="text-lg font-extrabold text-text-main">
              {otherUser?.email ? otherUser.email.split('@')[0] : 'Chat'}
            </h2>
          </div>
        </div>
        {otherUser?.id && !blockState.blockedMe && (
          <button
            onClick={handleToggleBlock}
            disabled={blockActionLoading}
            className={`rounded-xl px-3 py-2 text-xs font-bold transition active:scale-95 disabled:opacity-50 ${
              blockState.blockedByMe
                ? 'bg-accent-lime text-app-bg'
                : 'bg-card-elevated text-text-main'
            }`}
          >
            {blockState.blockedByMe ? 'Unblock' : 'Block'}
          </button>
        )}
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {blockState.blockedByMe && (
          <div className="rounded-2xl border border-glass-border bg-card-elevated px-4 py-3 text-sm text-text-muted">
            You blocked this user. Unblock them to send messages again.
          </div>
        )}
        {blockState.blockedMe && (
          <div className="rounded-2xl border border-glass-border bg-card-elevated px-4 py-3 text-sm text-text-muted">
            This user blocked you. You can view old messages but cannot reply.
          </div>
        )}
        {messages.map((msg) => {
          const isCurrentUser = msg.sender_id === currentUserId;
          const photoExpired = isPhotoExpired(msg);

          return (
            <div
              key={msg.id}
              className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl p-3 ${
                  isCurrentUser
                    ? 'bg-accent-lime text-app-bg'
                    : 'bg-card-elevated text-text-main'
                }`}
              >
                {msg.content && (
                  <p className={isCurrentUser ? 'text-app-bg' : 'text-text-main'}>
                    {msg.content}
                  </p>
                )}
                {msg.photo_url && !photoExpired && (
                  <img
                    src={msg.photo_url}
                    alt="Attachment"
                    className="mt-2 rounded-xl max-h-64 w-full object-cover"
                  />
                )}
                {msg.photo_url && photoExpired && (
                  <p className="mt-2 text-xs opacity-70">
                    Photo expired
                  </p>
                )}
                <p className="mt-1 text-[10px] opacity-70">
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-glass-border bg-app-bg">
        <div className="flex items-center gap-2">
          <label className="grid h-12 w-12 place-items-center rounded-2xl bg-card-elevated text-text-main cursor-pointer transition active:scale-95">
            <ImageIcon size={20} />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
              disabled={sending || blockState.hasBlock}
            />
          </label>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={blockState.hasBlock ? 'Messaging unavailable' : 'Type a message...'}
            disabled={sending || blockState.hasBlock}
            className="h-12 flex-1 rounded-2xl bg-card-elevated border border-glass-border px-4 text-sm font-medium text-text-main outline-none focus:border-accent-lime transition disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={sending || !newMessage.trim() || blockState.hasBlock}
            className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-lime text-app-bg transition active:scale-95 disabled:opacity-50"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
