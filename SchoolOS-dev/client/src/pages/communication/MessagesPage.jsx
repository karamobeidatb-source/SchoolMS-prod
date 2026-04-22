import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Send, Plus, Search, MessageSquare, User, Inbox, SendHorizontal, CheckCheck, Clock, Trash2, X } from 'lucide-react';

export default function MessagesPage() {
  const { user, hasPermission } = useAuth();
  const [messages, setMessages] = useState([]);
  const [activeUserId, setActiveUserId] = useState(null);
  const [activeUserInfo, setActiveUserInfo] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [showSubject, setShowSubject] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [searchUsers, setSearchUsers] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [msgSearch, setMsgSearch] = useState('');
  const [viewType, setViewType] = useState('inbox');
  const [unreadCount, setUnreadCount] = useState(0);
  const [availability, setAvailability] = useState(null);
  const messagesEndRef = useRef(null);

  const canViewAll = hasPermission('messages.view_all');

  useEffect(() => {
    fetchMessages();
    fetchUnread();
    const interval = setInterval(() => { fetchMessages(); fetchUnread(); }, 15000);
    return () => clearInterval(interval);
  }, [viewType]);

  const fetchMessages = () => {
    const endpoint = viewType === 'all' ? '/messages/all' : '/messages';
    const params = viewType === 'all' ? {} : { folder: viewType };
    api.get(endpoint, { params })
      .then((res) => setMessages(res.data.messages || res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const fetchUnread = () => {
    api.get('/messages/unread-count')
      .then((res) => setUnreadCount(res.data.count || 0))
      .catch(() => {});
  };

  useEffect(() => {
    if (!activeUserId) { setAvailability(null); setActiveUserInfo(null); return; }

    // Fetch conversation
    api.get(`/messages/conversation/${activeUserId}`)
      .then((res) => {
        setConversation(res.data.messages || res.data || []);
        if (res.data.otherUser) setActiveUserInfo(res.data.otherUser);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      })
      .catch(() => setConversation([]));

    // Fetch teacher availability
    api.get(`/teacher-availability/${activeUserId}`)
      .then((res) => setAvailability(res.data))
      .catch(() => setAvailability(null));

    // Refresh unread count after opening a conversation
    setTimeout(() => fetchUnread(), 500);

    // Poll conversation
    const interval = setInterval(() => {
      api.get(`/messages/conversation/${activeUserId}`)
        .then((res) => setConversation(res.data.messages || res.data || []))
        .catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [activeUserId]);

  const handleSend = async () => {
    if (!newMessage.trim() || !activeUserId) return;
    setSending(true);
    try {
      await api.post('/messages', {
        receiver_id: activeUserId,
        body: newMessage,
        subject: showSubject ? newSubject : '',
      });
      setNewMessage('');
      setNewSubject('');
      setShowSubject(false);
      // Refresh conversation
      const res = await api.get(`/messages/conversation/${activeUserId}`);
      setConversation(res.data.messages || res.data || []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      // Refresh message list so sidebar updates
      fetchMessages();
    } catch {}
    setSending(false);
  };

  const handleDeleteMessage = async (msgId) => {
    if (!confirm('Delete this message?')) return;
    try {
      await api.delete(`/messages/${msgId}`);
      setConversation((prev) => prev.filter((m) => m.id !== msgId));
      fetchMessages();
    } catch {}
  };

  const handleNewConversation = async (recipient) => {
    setActiveUserId(recipient.id || recipient._id);
    setActiveUserInfo(recipient);
    setShowNew(false);
    setSearchUsers('');
    setUserResults([]);
  };

  const searchForUsers = async (q) => {
    setSearchUsers(q);
    if (q.length < 2) { setUserResults([]); return; }
    try {
      const res = await api.get('/messages/users', { params: { search: q } });
      setUserResults(res.data || []);
    } catch { setUserResults([]); }
  };

  // Build unique contact list from messages
  const contacts = [];
  const contactMap = {};
  (messages || []).forEach((m) => {
    const otherId = viewType === 'sent'
      ? (m.receiver_id || m.receiverId)
      : (m.sender_id || m.senderId);
    const otherName = viewType === 'sent'
      ? (m.receiver_first_name ? `${m.receiver_first_name} ${m.receiver_last_name || ''}`.trim() : 'Unknown')
      : (m.sender_first_name ? `${m.sender_first_name} ${m.sender_last_name || ''}`.trim() : 'Unknown');
    if (otherId && !contactMap[otherId]) {
      contactMap[otherId] = true;
      contacts.push({
        id: otherId,
        name: otherName,
        lastMessage: m.body || m.content || '',
        lastTime: m.created_at || m.createdAt || '',
        unread: !m.is_read && viewType === 'inbox' && (m.receiver_id == user?.id),
      });
    }
  });

  // If active user is not in contacts (new conversation), add them temporarily
  if (activeUserId && !contactMap[activeUserId] && activeUserInfo) {
    contacts.unshift({
      id: activeUserId,
      name: activeUserInfo.first_name ? `${activeUserInfo.first_name} ${activeUserInfo.last_name || ''}`.trim() : (activeUserInfo.name || 'Unknown'),
      lastMessage: '',
      lastTime: '',
      unread: false,
    });
  }

  const filteredContacts = contacts.filter((c) =>
    (c.name || '').toLowerCase().includes(msgSearch.toLowerCase())
  );

  const isMe = (senderId) => senderId == user?.id;

  const formatMsgTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    const time = dateStr.substring(11, 16);
    if (diffDays === 0) return time;
    if (diffDays === 1) return `Yesterday ${time}`;
    if (diffDays < 7) return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${time}`;
    return `${dateStr.substring(0, 10)} ${time}`;
  };

  const formatContactTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return dateStr.substring(11, 16);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
    return dateStr.substring(5, 10);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold font-heading mb-6" style={{ color: 'var(--text-primary)' }}>
        Messages
        {unreadCount > 0 && (
          <span className="text-sm px-2 py-0.5 rounded-full ml-2" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>{unreadCount}</span>
        )}
      </h1>

      <div className="card flex h-[calc(100vh-200px)] min-h-[500px]">
        {/* Contacts Panel */}
        <div className="w-80 flex flex-col flex-shrink-0" style={{ borderRight: '1px solid var(--border-default)' }}>
          <div className="p-3" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex rounded-lg p-1 flex-1" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                <button onClick={() => setViewType('inbox')} className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors`} style={viewType === 'inbox' ? { backgroundColor: 'var(--surface-primary)', color: 'var(--accent)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' } : { color: 'var(--text-secondary)' }}>
                  <Inbox className="w-3 h-3 inline mr-1" />Inbox
                </button>
                <button onClick={() => setViewType('sent')} className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors`} style={viewType === 'sent' ? { backgroundColor: 'var(--surface-primary)', color: 'var(--accent)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' } : { color: 'var(--text-secondary)' }}>
                  <SendHorizontal className="w-3 h-3 inline mr-1" />Sent
                </button>
                {canViewAll && (
                  <button onClick={() => setViewType('all')} className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors`} style={viewType === 'all' ? { backgroundColor: 'var(--surface-primary)', color: 'var(--accent)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' } : { color: 'var(--text-secondary)' }}>
                    <MessageSquare className="w-3 h-3 inline mr-1" />All
                  </button>
                )}
              </div>
              <button onClick={() => setShowNew(true)} className="btn-primary p-2 rounded-lg" title="New message">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              <input
                value={msgSearch}
                onChange={(e) => setMsgSearch(e.target.value)}
                placeholder="Search conversations..."
                className="input w-full pl-9 pr-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredContacts.length === 0 ? (
              <div className="p-6 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                <p>No conversations yet</p>
                <button onClick={() => setShowNew(true)} className="mt-2 text-sm font-medium" style={{ color: 'var(--accent)' }}>Start a new message</button>
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => setActiveUserId(contact.id)}
                  className={`w-full text-left px-4 py-3 transition-colors`}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    ...(activeUserId == contact.id
                      ? { backgroundColor: 'var(--accent-subtle)', borderLeft: '2px solid var(--accent)' }
                      : {})
                  }}
                  onMouseEnter={(e) => { if (activeUserId != contact.id) e.currentTarget.style.backgroundColor = 'var(--surface-secondary)'; }}
                  onMouseLeave={(e) => { if (activeUserId != contact.id) e.currentTarget.style.backgroundColor = ''; }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent-subtle)' }}>
                      <span className="font-medium text-sm" style={{ color: 'var(--accent)' }}>{(contact.name || '?')[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm truncate ${contact.unread ? 'font-bold' : 'font-medium'}`} style={{ color: 'var(--text-primary)' }}>{contact.name}</p>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{formatContactTime(contact.lastTime)}</span>
                          {contact.unread && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />}
                        </div>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${contact.unread ? 'font-medium' : ''}`} style={{ color: contact.unread ? 'var(--text-secondary)' : 'var(--text-secondary)' }}>
                        {contact.lastMessage || 'No messages'}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Messages Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {!activeUserId ? (
            <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-tertiary)' }}>
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-3" />
                <p className="text-sm">Select a conversation or start a new one</p>
              </div>
            </div>
          ) : (
            <>
              {/* Conversation Header */}
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-default)', backgroundColor: 'var(--surface-primary)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent-subtle)' }}>
                    <span className="font-medium text-sm" style={{ color: 'var(--accent)' }}>
                      {(activeUserInfo?.first_name || contacts.find(c => c.id == activeUserId)?.name || '?')[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                      {activeUserInfo ? `${activeUserInfo.first_name} ${activeUserInfo.last_name || ''}`.trim() : contacts.find(c => c.id == activeUserId)?.name || 'Unknown'}
                    </p>
                    {activeUserInfo?.email && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{activeUserInfo.email}</p>}
                  </div>
                </div>
                {availability && (
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <Clock className="w-3 h-3" />
                    <span>Available: {availability.available_from || availability.start_time || '08:00'} - {availability.available_until || availability.end_time || '20:00'}</span>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {conversation.length === 0 ? (
                  <p className="text-center text-sm py-8" style={{ color: 'var(--text-tertiary)' }}>No messages yet. Start the conversation!</p>
                ) : (
                  conversation.map((msg, i) => {
                    const senderId = msg.sender_id || msg.senderId || msg.sender;
                    const mine = isMe(senderId);
                    const isRead = msg.is_read;
                    return (
                      <div key={msg.id || i} className={`flex ${mine ? 'justify-end' : 'justify-start'} group`}>
                        <div className={`max-w-[70%] ${mine ? 'order-2' : ''}`}>
                          {!mine && (
                            <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                              {msg.sender_first_name ? `${msg.sender_first_name} ${msg.sender_last_name || ''}`.trim() : 'Unknown'}
                            </p>
                          )}
                          {msg.subject && (
                            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{msg.subject}</p>
                          )}
                          <div className="relative">
                            <div
                              className={`px-4 py-2.5 rounded-2xl text-sm ${mine ? 'rounded-br-md' : 'rounded-bl-md'}`}
                              style={mine
                                ? { backgroundColor: 'var(--accent)', color: 'white' }
                                : { backgroundColor: 'var(--surface-secondary)', color: 'var(--text-primary)' }
                              }
                            >
                              {msg.body || msg.content}
                            </div>
                            {/* Delete button on hover */}
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              className={`absolute top-1 ${mine ? '-left-8' : '-right-8'} p-1 opacity-0 group-hover:opacity-100 transition-opacity`}
                              style={{ color: 'var(--text-tertiary)' }}
                              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--error-text)'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                              title="Delete message"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className={`flex items-center gap-1 mt-1 ${mine ? 'justify-end' : ''}`}>
                            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{formatMsgTime(msg.created_at || msg.createdAt)}</p>
                            {mine && (
                              <span className="text-xs flex items-center gap-0.5" style={{ color: isRead ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                                <CheckCheck className="w-3 h-3" />
                                {isRead ? <span className="text-[10px]">Read</span> : null}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Compose */}
              <div className="p-4" style={{ borderTop: '1px solid var(--border-default)' }}>
                {showSubject && (
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      placeholder="Subject (optional)"
                      className="input flex-1 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={() => { setShowSubject(false); setNewSubject(''); }} className="p-1" style={{ color: 'var(--text-tertiary)' }}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  {!showSubject && (
                    <button
                      onClick={() => setShowSubject(true)}
                      className="p-2 rounded-lg"
                      style={{ color: 'var(--text-tertiary)' }}
                      title="Add subject"
                    >
                      <span className="text-xs font-medium">Aa</span>
                    </button>
                  )}
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder="Type a message..."
                    className="input flex-1 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !newMessage.trim()}
                    className="btn-primary p-2.5 rounded-lg disabled:opacity-60 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Message Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowNew(false)} />
          <div className="relative card w-full max-w-md mx-4 p-6" style={{ boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold font-heading">New Message</h3>
              <button onClick={() => setShowNew(false)} className="p-1" style={{ color: 'var(--text-tertiary)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              <input
                value={searchUsers}
                onChange={(e) => searchForUsers(e.target.value)}
                placeholder="Search for a recipient..."
                className="input w-full pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {userResults.map((u) => {
                const uName = u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : (u.name || u.email);
                return (
                  <button
                    key={u.id || u._id}
                    onClick={() => handleNewConversation(u)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
                    style={{}}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-subtle)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent-subtle)' }}>
                      <span className="font-medium text-sm" style={{ color: 'var(--accent)' }}>{(uName || '?')[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{uName}</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{u.role || 'Staff'}{u.email ? ` · ${u.email}` : ''}</p>
                    </div>
                  </button>
                );
              })}
              {searchUsers.length >= 2 && userResults.length === 0 && (
                <p className="text-center text-sm py-4" style={{ color: 'var(--text-tertiary)' }}>No users found</p>
              )}
              {searchUsers.length < 2 && (
                <p className="text-center text-sm py-4" style={{ color: 'var(--text-tertiary)' }}>Type at least 2 characters to search</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
