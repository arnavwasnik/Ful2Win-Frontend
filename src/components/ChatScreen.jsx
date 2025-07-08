import React, { useState, useRef, useEffect } from 'react';
import { FiArrowLeft, FiSend } from 'react-icons/fi';
import BackgroundBubbles from './BackgroundBubbles';
import { io } from 'socket.io-client';
import api from '../services/api';

const ChatScreen = ({ selectedFriend, setSelectedFriend }) => {
  const [socketError, setSocketError] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    function getUserIdFromStorage() {
      let userId = localStorage.getItem('userId');
      if (!userId) {
        try {
          const user = JSON.parse(localStorage.getItem('user'));
          if (user && user._id) userId = user._id;
        } catch (e) {}
      }
      return userId ? String(userId) : null;
    }
    setCurrentUserId(getUserIdFromStorage());
    function handleStorage() {
      setCurrentUserId(getUserIdFromStorage());
    }
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    setMessages([]);
    if (!currentUserId || !selectedFriend || !selectedFriend._id) return;
    // Use the same base URL as the API but without the /api suffix
    // Use the baseURL from the api instance for the socket connection
    const SOCKET_URL = new URL(api.defaults.baseURL).origin;
    console.log('Connecting to socket at:', SOCKET_URL);

    if (!socketRef.current) {
      socketRef.current = io(SOCKET_URL, {
        withCredentials: true,
        transports: ['polling'],
      });
    }

    const socket = socketRef.current;

    socket.on('connect_error', (err) => {
      setSocketError(true);
      console.error('Socket connection error:', err);
    });

    socket.emit('join_user_room', currentUserId);
    socket.off('new_message');
    socket.on('new_message', (msg) => {
      const senderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
      const recipientId = typeof msg.recipient === 'object' ? msg.recipient._id : msg.recipient;
      if (
        ((String(senderId) === String(currentUserId) && String(recipientId) === String(selectedFriend._id)) ||
          (String(senderId) === String(selectedFriend._id) && String(recipientId) === String(currentUserId))) &&
        !messages.some(m => m._id === msg._id)
      ) {
        setMessages(prev => [...prev, msg]);
      }
    });

    return () => {
      socket.off('new_message');
      if (selectedFriend && selectedFriend._id) {
        socket.emit('leave_user_room', currentUserId);
      }
      if (!selectedFriend || !selectedFriend._id) {
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [currentUserId, selectedFriend]);

  useEffect(() => {
    if (!selectedFriend || !selectedFriend._id || !currentUserId) return;
    setLoading(true);
    api.get(`/api/messages/conversation?user1=${currentUserId}&user2=${selectedFriend._id}`)
      .then(res => {
        const sorted = (res.data || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        setMessages(sorted);
        setLoading(false);
        console.log('Fetched messages:', sorted);
      })
      .catch(() => {
        api.get(`/api/messages/${selectedFriend._id}`)
          .then(res2 => {
            const sorted2 = (res2.data || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            setMessages(sorted2);
            setLoading(false);
          })
          .catch(() => {
            setMessages([]);
            setLoading(false);
          });
      });
    return () => setMessages([]);
  }, [selectedFriend, currentUserId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!message.trim() || !selectedFriend?._id) return;
    setSending(true);
    try {
      await api.post('/messages', {
        recipient: selectedFriend._id,
        content: message.trim(),
      });
      setMessage('');
    } catch (err) {
      console.error('Send message error:', err);
    }
    setSending(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') sendMessage();
  };

  console.log('ChatScreen render', {
    messages,
    currentUserId,
    selectedFriend,
  });

  return (
    <div className="relative w-full bg-blueGradient h-screen overflow-hidden text-white">
      <BackgroundBubbles />
      {selectedFriend ? (
        <div className="w-full h-full relative">
          {/* Header */}
          <div className="fixed top-0 left-0 right-0 h-[60px] bg-blueGradient bg-opacity-100 backdrop-blur-md z-20 flex items-center px-4">
            <button onClick={() => setSelectedFriend(null)} className="mr-4 bg-white bg-opacity-20 p-2 rounded-full hover:bg-opacity-30">
              <FiArrowLeft size={20} />
            </button>
            <img
              src={
                selectedFriend.profilePicture ||
                selectedFriend.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedFriend.name || selectedFriend.username || 'U')}&background=0b3fae&color=fff`
              }
              alt={selectedFriend.name || selectedFriend.username || 'User'}
              className="w-10 h-10 rounded-full mr-3"
            />
            <div>
              <h3 className="font-semibold">{selectedFriend.name || selectedFriend.username || 'User'}</h3>
              <p className={`text-sm ${selectedFriend.online ? 'text-green-300' : 'text-gray-300'}`}>
                {selectedFriend.online !== undefined ? (selectedFriend.online ? 'Online' : 'Offline') : 'Online'}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="absolute left-0 right-0 overflow-y-auto px-4 py-2" style={{ top: '60px', bottom: '72px', background: 'rgba(0,0,0,0.2)', zIndex: 10, minHeight: 200 }}>
            <div className="chat-messages border border-red-500 min-h-[200px]" style={{ background: '#fff', color: '#000' }}>
              {loading ? (
                <div className="loading">Loading...</div>
              ) : messages.length === 0 ? (
                <div className="no-messages">No messages yet.</div>
              ) : (
                messages
                  .filter((msg) => {
                    const sender = msg.sender?._id || msg.sender || '';
                    const recipient = msg.recipient?._id || msg.recipient || '';
                    const userId = String(currentUserId).trim();
                    const friendId = String(selectedFriend._id).trim();
                    return (
                      (String(sender) === userId && String(recipient) === friendId) ||
                      (String(sender) === friendId && String(recipient) === userId)
                    );
                  })
                  .map((msg) => {
                    const senderId = msg.sender?._id || msg.sender || '';
                    const isSent = String(senderId).trim() === String(currentUserId).trim();
                    return (
                      <div key={msg._id} className="my-2 flex" style={{ justifyContent: isSent ? 'flex-end' : 'flex-start' }}>
                        <div
                          style={{
                            background: isSent ? '#25d366' : '#2a2f32',
                            color: isSent ? '#fff' : '#e9edef',
                            borderRadius: '8px',
                            padding: '8px 14px',
                            maxWidth: '70%',
                            minWidth: '40px',
                            fontSize: '1rem',
                            wordBreak: 'break-word',
                            boxShadow: isSent ? '0 1px 2px rgba(0,0,0,0.07)' : '0 1px 2px rgba(0,0,0,0.04)',
                            position: 'relative',
                            textAlign: 'left',
                          }}
                        >
                          <span>{msg.content}</span>
                          <span
                            style={{
                              fontSize: '0.75em',
                              color: isSent ? '#e9edef' : '#b3b7bb',
                              position: 'absolute',
                              right: 8,
                              bottom: 4,
                              opacity: 0.7,
                            }}
                          >
                            {msg.createdAt
                              ? new Date(msg.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Footer */}
          <div className="fixed bottom-0 left-0 right-0 h-[72px] bg-blueGradient bg-opacity-70 backdrop-blur-md z-20 px-4 flex items-center">
            <div className="flex items-center bg-white rounded-full p-2 shadow-md w-full max-w-3xl mx-auto">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="flex-1 p-2 rounded-full text-black focus:outline-none"
              />
              <button
                onClick={sendMessage}
                className="ml-2 p-2 bg-blueGradient rounded-full hover:bg-blueGradient transition text-white"
              >
                <FiSend size={20} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col w-full h-full overflow-y-auto px-4 pt-4 pb-20" style={{ background: '#fff', color: '#000' }}>
          <div className="mt-4 space-y-4 w-full max-w-3xl mx-auto">
            <p className="text-center text-black/70">No friend selected.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatScreen;
