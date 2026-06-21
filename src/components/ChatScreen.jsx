import { useEffect, useState, useRef, useCallback } from 'react';
import { X, Send, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { playTapSound, playSuccessSound } from '../lib/sounds';
import { blockUser, getBlockStateBetweenUsers, unblockUser } from '../lib/userBlocks';
import CountdownAction from './CountdownAction';

const MESSAGE_PHOTO_EXPIRY_MS = 48 * 60 * 60 * 1000;
const MAX_MESSAGE_PHOTO_SIZE_BYTES = 500 * 1024;
const MAX_MESSAGE_PHOTO_DIMENSION = 1600;

const readImageFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Failed to read image file.'));
  reader.readAsDataURL(file);
});

const loadImageElement = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Failed to load image.'));
  image.src = src;
});

const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) {
      resolve(blob);
      return;
    }

    reject(new Error('Failed to compress image.'));
  }, type, quality);
});

async function compressMessagePhoto(file) {
  if (file.size <= MAX_MESSAGE_PHOTO_SIZE_BYTES) {
    return file;
  }

  const imageSrc = await readImageFile(file);
  const image = await loadImageElement(imageSrc);

  let width = image.width;
  let height = image.height;
  const largestSide = Math.max(width, height);

  if (largestSide > MAX_MESSAGE_PHOTO_DIMENSION) {
    const scale = MAX_MESSAGE_PHOTO_DIMENSION / largestSide;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not prepare image compression.');
  }

  context.drawImage(image, 0, 0, width, height);

  let bestBlob = await canvasToBlob(canvas, 'image/jpeg', 0.85);

  for (let quality = 0.75; quality >= 0.35 && bestBlob.size > MAX_MESSAGE_PHOTO_SIZE_BYTES; quality -= 0.1) {
    bestBlob = await canvasToBlob(canvas, 'image/jpeg', quality);
  }

  while (bestBlob.size > MAX_MESSAGE_PHOTO_SIZE_BYTES && canvas.width > 400 && canvas.height > 400) {
    canvas.width = Math.round(canvas.width * 0.85);
    canvas.height = Math.round(canvas.height * 0.85);

    const resizedContext = canvas.getContext('2d');
    if (!resizedContext) {
      break;
    }

    resizedContext.drawImage(image, 0, 0, canvas.width, canvas.height);
    bestBlob = await canvasToBlob(canvas, 'image/jpeg', 0.7);
  }

  if (bestBlob.size > MAX_MESSAGE_PHOTO_SIZE_BYTES) {
    throw new Error('Could not compress image below 500KB.');
  }

  return new File(
    [bestBlob],
    `${file.name.replace(/\.[^.]+$/, '') || 'message-photo'}.jpg`,
    { type: 'image/jpeg' }
  );
}

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
  const [pendingBlockAction, setPendingBlockAction] = useState('');
  const [blockCountdown, setBlockCountdown] = useState(0);
  const [blockActionMessage, setBlockActionMessage] = useState('');
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

  useEffect(() => {
    let timer;

    if (pendingBlockAction && blockCountdown > 0) {
      timer = setTimeout(() => setBlockCountdown((count) => count - 1), 1000);
    } else if (pendingBlockAction && blockCountdown === 0) {
      handleToggleBlock();
    }

    return () => clearTimeout(timer);
  }, [pendingBlockAction, blockCountdown]);

  const handleToggleBlock = async () => {
    if (!currentUserId || !otherUser?.id || blockState.blockedMe) return;
    if (!pendingBlockAction) return;

    const shouldBlock = pendingBlockAction === 'block';

    setBlockActionLoading(true);
    setBlockActionMessage('');
    try {
      if (shouldBlock) {
        await blockUser(currentUserId, otherUser.id);
        setBlockState({
          blockedByMe: true,
          blockedMe: false,
          hasBlock: true,
        });
        setBlockActionMessage('User blocked.');
      } else {
        await unblockUser(currentUserId, otherUser.id);
        setBlockState({
          blockedByMe: false,
          blockedMe: false,
          hasBlock: false,
        });
        setBlockActionMessage('User unblocked.');
      }
    } catch (err) {
      console.error('Error updating block state:', err);
      setBlockActionMessage(`Could not ${shouldBlock ? 'block' : 'unblock'} this user.`);
    } finally {
      setPendingBlockAction('');
      setBlockCountdown(0);
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
      const compressedFile = await compressMessagePhoto(file);
      const fileExt = compressedFile.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${conversation.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('message-attachments')
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(filePath);

      await sendMessage(null, data.publicUrl);
    } catch (err) {
      console.error('Error uploading photo:', err);
      alert(err.message || 'Could not upload photo.');
    } finally {
      event.target.value = '';
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
          pendingBlockAction ? (
            <CountdownAction
              label={pendingBlockAction === 'block' ? 'Blocking' : 'Unblocking'}
              countdown={blockCountdown}
              onCancel={() => {
                setPendingBlockAction('');
                setBlockCountdown(0);
              }}
              compact
            />
          ) : (
            <button
              onClick={() => {
                setPendingBlockAction(blockState.blockedByMe ? 'unblock' : 'block');
                setBlockCountdown(3);
                setBlockActionMessage('');
              }}
              disabled={blockActionLoading}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition active:scale-95 disabled:opacity-50 ${
                blockState.blockedByMe
                  ? 'bg-accent-lime text-app-bg'
                  : 'bg-card-elevated text-text-main'
              }`}
            >
              {blockState.blockedByMe ? 'Unblock' : 'Block'}
            </button>
          )
        )}
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {blockActionMessage && (
          <div className="rounded-2xl border border-glass-border bg-card-elevated px-4 py-3 text-sm text-text-muted">
            {blockActionMessage}
          </div>
        )}
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
