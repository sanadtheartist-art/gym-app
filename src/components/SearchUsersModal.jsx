import { useState, useEffect } from 'react';
import { X, Search, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { playTapSound } from '../lib/sounds';

export default function SearchUsersModal({ isOpen, onClose, onStartChat }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch users when search query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setUsers([]);
      return;
    }

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .ilike('email', `%${searchQuery}%`)
          .neq('id', (await supabase.auth.getUser()).data.user?.id); // Don't show current user

        if (!error) {
          setUsers(data || []);
        }
      } catch (err) {
        console.error('Error searching users:', err);
      }
      setLoading(false);
    };

    const timeoutId = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-3xl rounded-t-[32px] glass-card sheet-content p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-extrabold text-text-main">Find Users</h2>
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

        {/* Search Input */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 text-text-muted">
            <Search size={18} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            className="h-14 w-full rounded-2xl bg-app-bg border border-glass-border pl-11 pr-4 text-sm font-medium text-text-main outline-none focus:border-accent-lime transition"
            autoFocus
          />
        </div>

        {/* Users List */}
        <div className="space-y-2">
          {loading ? (
            <div className="py-8 text-center text-text-muted">Searching...</div>
          ) : users.length === 0 && searchQuery.trim() !== '' ? (
            <div className="py-8 text-center text-text-muted">No users found</div>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-xl bg-app-bg border border-glass-border p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-card-elevated text-text-main">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-bold text-text-main">{user.email}</p>
                    <p className="text-xs text-text-muted">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    playTapSound();
                    onStartChat(user);
                    onClose();
                  }}
                  className="h-9 px-3 flex items-center gap-1.5 rounded-xl bg-accent-lime text-app-bg font-bold text-[11px] active:scale-95"
                >
                  <MessageSquare size={14} /> Start Chat
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
