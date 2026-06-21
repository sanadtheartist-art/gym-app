import { useEffect, useState, useRef } from 'react';
import { X, Send, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { playTapSound, playSuccessSound } from '../lib/sounds';

export default function ChatScreen({ isOpen, onClose, conversation, otherUser }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
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

        if (!error) setMessages(data || []);
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
        (payload) => {
          console.log('New message:', payload.new);
          setMessages(prev => {
            // Avoid duplicates
            const exists = prev.some(m => m.id === payload.new.id);
            return exists ? prev : [...prev, payload.new];
          });
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
              {otherUser?.email || 'Chat'}
            </h2>
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => {
          const isCurrentUser = msg.sender_id === currentUserId;
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
                {msg.photo_url && (
                  <img
                    src={msg.photo_url}
                    alt="Attachment"
                    className="mt-2 rounded-xl max-h-64 w-full object-cover"
                  />
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
              disabled={sending}
            />
          </label>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={sending}
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
            disabled={sending || !newMessage.trim()}
            className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-lime text-app-bg transition active:scale-95 disabled:opacity-50"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
