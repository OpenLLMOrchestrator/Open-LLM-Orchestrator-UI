import React from 'react';
import './Sidebar.css';

export default function Sidebar({
  tab,
  setTab,
  conversations = [],
  currentConversationId,
  setCurrentConversationId,
  pipelines = [],
  currentPipelineId,
  setCurrentPipelineId,
  currentRagTag,
  setCurrentRagTag,
  ragTags = [],
  onNewChat,
  onDeleteConversation,
  onRefreshConversations,
  loading,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        <button
          className={tab === 'chat' ? 'active' : ''}
          onClick={() => setTab('chat')}
        >
          Chat
        </button>
        <button
          className={tab === 'rag' ? 'active' : ''}
          onClick={() => setTab('rag')}
        >
          RAG
        </button>
        <button
          className={tab === 'documents' ? 'active' : ''}
          onClick={() => setTab('documents')}
        >
          Documents
        </button>
      </div>

      {(tab === 'chat' || tab === 'rag') && (
        <>
          <div className="sidebar-section">
            <label className="sidebar-label">{tab === 'rag' ? 'RAG pipeline' : 'Pipeline'}</label>
            <select
              value={currentPipelineId}
              onChange={(e) => setCurrentPipelineId(e.target.value)}
              className="sidebar-select"
            >
              {pipelines.length === 0 && (
                <option value="">Loading…</option>
              )}
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          {tab === 'rag' && (
            <div className="sidebar-section">
              <label className="sidebar-label">RAG scope (vector role)</label>
              <select
                value={currentRagTag}
                onChange={(e) => setCurrentRagTag(e.target.value)}
                className="sidebar-select"
              >
                <option value="">— Select tag —</option>
                {ragTags.map((tag) => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
              <p className="sidebar-hint">
                {currentRagTag ? `Vector scope: "${currentRagTag}"` : 'Select a RAG tag (upload docs first in Documents tab).'}
              </p>
            </div>
          )}

          <div className="sidebar-section">
            <button
              type="button"
              className="btn-new-chat"
              onClick={(e) => {
                e.preventDefault();
                onNewChat?.();
              }}
              disabled={loading || (tab === 'rag' && !currentRagTag)}
            >
              {loading ? 'Creating…' : '+ New chat'}
            </button>
          </div>

          <div className="sidebar-section conversations">
            <div className="sidebar-label">Conversations</div>
            {conversations.length === 0 && (
              <p className="sidebar-empty">No conversations yet.</p>
            )}
            <ul className="conversation-list">
              {conversations.map((c) => (
                <li key={c.id} className="conversation-item">
                  <button
                    className={`conv-btn ${currentConversationId === c.id ? 'active' : ''}`}
                    onClick={() => setCurrentConversationId(c.id)}
                  >
                    <span className="conv-title">{c.title}</span>
                    <span className="conv-meta">
                      {c.pipelineId && <span className="conv-pipeline">{c.pipelineId}</span>}
                      {c.ragTag && <span className="conv-tag">{c.ragTag}</span>}
                    </span>
                  </button>
                  <button
                    className="conv-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(c.id);
                    }}
                    title="Delete"
                    aria-label="Delete conversation"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            {conversations.length > 0 && (
              <button className="btn-refresh" onClick={onRefreshConversations}>
                Refresh list
              </button>
            )}
          </div>
        </>
      )}

      {tab === 'documents' && (
        <div className="sidebar-section">
          <p className="sidebar-hint">
            Upload documents with a RAG tag, then start a chat under that tag to query them.
          </p>
          {ragTags.length > 0 && (
            <>
              <div className="sidebar-label">Your RAG tags</div>
              <ul className="tag-list">
                {ragTags.map((tag) => (
                  <li key={tag} className="tag-item">{tag}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
