import React, { useState, useEffect, useRef } from 'react';
import { apiJson } from './api';
import { API } from './config';
import './ChatView.css';

export default function ChatView({
  conversationId,
  currentPipelineId = '',
  currentRagTag = '',
  onConversationCreated,
  onEnsureConversation,
  onSelectConversation,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const skipNextMessagesFetchRef = useRef(false);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    if (skipNextMessagesFetchRef.current) {
      skipNextMessagesFetchRef.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiJson(`${API}/conversations/${conversationId}/messages`)
      .then(({ ok, data }) => {
        if (!cancelled && ok && data) setMessages(data.messages || []);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const ensureAndSend = async (conversationIdToUse) => {
      const { ok, data, error } = await apiJson(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conversationIdToUse, content: text }),
      });
      return { ok, data, error };
    };

    let cid = conversationId;
    if (!cid && onEnsureConversation) {
      skipNextMessagesFetchRef.current = true;
      cid = await onEnsureConversation(true);
      if (!cid) {
        skipNextMessagesFetchRef.current = false;
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Could not start conversation. Please try again or click "+ New chat".' }]);
        return;
      }
    }
    if (!cid) return;

    setInput('');
    setSending(true);
    const userMsg = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);

    try {
      let result = await ensureAndSend(cid);
      if (!result.ok && (result.data?.error === 'Conversation not found' || result.error === 'Conversation not found')) {
        const newCid = onEnsureConversation ? await onEnsureConversation(true) : null;
        if (newCid) result = await ensureAndSend(newCid);
      }
      const { ok, data, error } = result;
      if (ok && data?.message) {
        setMessages((prev) => [...prev, data.message]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data?.error || error || 'Failed to get response.' },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message}` },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const hasConversation = conversationId != null;

  return (
    <div className={`chat-view ${!hasConversation ? 'empty' : ''}`}>
      {!hasConversation && (
        <div className="empty-state empty-state-inline">
          <p>
            Pipeline: <strong>{currentPipelineId || 'default'}</strong>
            {currentRagTag ? ` · RAG scope: "${currentRagTag}"` : ''}
          </p>
          <p className="empty-hint">Type below to start a conversation with the selected pipeline, or click "+ New chat" in the sidebar.</p>
        </div>
      )}
      <div className="messages">
        {hasConversation && loading && messages.length === 0 && (
          <div className="message assistant">
            <div className="message-content">Loading…</div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id || m.createdAt} className={`message ${m.role}`}>
            <div className="message-role">{m.role === 'user' ? 'You' : 'Assistant'}</div>
            <div className="message-content">{m.content}</div>
          </div>
        ))}
        {sending && (
          <div className="message assistant">
            <div className="message-content typing">Thinking…</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="input-area">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message…"
          rows={1}
          disabled={sending}
        />
        <button
          className="btn-send"
          onClick={sendMessage}
          disabled={sending || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
