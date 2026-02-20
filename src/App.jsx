import React, { useState, useEffect, useCallback } from 'react';
import { apiJson } from './api';
import { API } from './config';
import { loadSession, saveSession, clearSession } from './session';
import ChatView from './ChatView';
import DocumentsView from './DocumentsView';
import Sidebar from './Sidebar';
import './App.css';

const saved = loadSession();

export default function App() {
  const [tab, setTab] = useState(saved.tab ?? 'chat');
  const [conversations, setConversations] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [pipelinesRag, setPipelinesRag] = useState([]);
  const [ragTags, setRagTags] = useState([]);
  const [currentPipelineId, setCurrentPipelineId] = useState(saved.currentPipelineId ?? '');
  const [currentRagTag, setCurrentRagTag] = useState(saved.currentRagTag ?? '');
  const [currentConversationId, setCurrentConversationId] = useState(saved.currentConversationId ?? null);
  const [loading, setLoading] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);

  const isRagTab = tab === 'rag';
  const isChatTab = tab === 'chat';
  const activePipelines = isRagTab ? pipelinesRag : isChatTab ? pipelines : [];

  useEffect(() => {
    saveSession({ tab, currentPipelineId, currentRagTag, currentConversationId });
  }, [tab, currentPipelineId, currentRagTag, currentConversationId]);

  const fetchConversations = useCallback(async () => {
    const scope = tab === 'rag' ? 'rag' : 'chat';
    const { ok, data } = await apiJson(`${API}/conversations?scope=${scope}`);
    if (ok && data) {
      const list = data.conversations || [];
      setConversations(list);
      setCurrentConversationId(list.length ? list[0].id : null);
    }
  }, [tab]);

  const fetchRagTags = useCallback(async () => {
    const { ok, data } = await apiJson(`${API}/documents/rag-tags`);
    if (ok && data) setRagTags(data.ragTags || []);
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const defaultChatPipelines = [
    { id: 'llama-oss', label: 'Llama OSS' }, { id: 'openai-oss', label: 'OpenAI OSS' }, { id: 'both', label: 'Both models' },
    { id: 'chat-mistral', label: 'Mistral' }, { id: 'chat-llama3.2', label: 'Llama 3.2' }, { id: 'chat-phi3', label: 'Phi-3' },
    { id: 'chat-gemma2-2b', label: 'Gemma 2 2B' }, { id: 'chat-qwen2-1.5b', label: 'Qwen2 1.5B' }, { id: 'query-all-models', label: 'Query all models' },
  ];
  const defaultRagPipelines = [
    { id: 'question-answer', label: 'Question-Answer (RAG)' }, { id: 'rag-llama-oss', label: 'RAG Llama OSS' },
    { id: 'rag-openai-oss', label: 'RAG OpenAI OSS' }, { id: 'rag-both', label: 'RAG Both models' },
    { id: 'rag-mistral', label: 'RAG Mistral' }, { id: 'rag-llama3.2', label: 'RAG Llama 3.2' },
    { id: 'rag-phi3', label: 'RAG Phi-3' }, { id: 'rag-gemma2-2b', label: 'RAG Gemma 2 2B' }, { id: 'rag-qwen2-1.5b', label: 'RAG Qwen2 1.5B' },
  ];

  const fetchPipelines = useCallback(async () => {
    const { ok, data } = await apiJson(`${API}/pipelines`);
    if (ok && data) {
      const list = data.pipelines?.length ? data.pipelines : defaultChatPipelines;
      const listRag = data.pipelinesRag?.length ? data.pipelinesRag : defaultRagPipelines;
      setPipelines(list);
      setPipelinesRag(listRag);
      setCurrentPipelineId((prev) => {
        const inChat = list.some((p) => p.id === prev);
        const inRag = listRag.some((p) => p.id === prev);
        if (inChat || inRag) return prev;
        return list[0]?.id ?? 'llama-oss';
      });
    } else {
      setPipelines(defaultChatPipelines);
      setPipelinesRag(defaultRagPipelines);
      setCurrentPipelineId(defaultChatPipelines[0]?.id ?? 'llama-oss');
    }
  }, []);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  useEffect(() => {
    if (activePipelines.length > 0 && !activePipelines.some((p) => p.id === currentPipelineId)) {
      setCurrentPipelineId(activePipelines[0].id);
    }
  }, [tab, pipelines, pipelinesRag, currentPipelineId, activePipelines]);

  useEffect(() => {
    if (tab === 'chat') setCurrentRagTag('');
    setCurrentConversationId(null);
  }, [tab]);

  useEffect(() => {
    if (tab === 'documents' || tab === 'rag') fetchRagTags();
  }, [tab, fetchRagTags]);

  const createNewChat = useCallback(async () => {
    setLoading(true);
    try {
      const { ok, data, error } = await apiJson(`${API}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipelineId: currentPipelineId || null,
          ragTag: isRagTab ? (currentRagTag || null) : null,
        }),
      });
      const conv = data?.id ? data : data?.conversation ?? data?.data;
      const newId = conv?.id ?? data?.id;
      if (ok && newId) {
        const convObj = typeof conv === 'object' && conv !== null ? conv : { id: newId, title: 'New chat', pipelineId: currentPipelineId, ragTag: isRagTab ? currentRagTag : null };
        setConversations((prev) => [convObj, ...prev]);
        setCurrentConversationId(newId);
        return newId;
      } else if (!ok && error) {
        console.error('Create conversation failed:', error, data);
      }
    } catch (err) {
      console.error('Create conversation error:', err);
    } finally {
      setLoading(false);
    }
    return null;
  }, [currentPipelineId, isRagTab, currentRagTag]);

  const ensureConversation = useCallback(async (forceCreate = false) => {
    if (!forceCreate && currentConversationId) return currentConversationId;
    return createNewChat();
  }, [currentConversationId, createNewChat]);

  const deleteConversation = async (id) => {
    await fetch(`${API}/conversations/${id}`, { method: 'DELETE' });
    if (currentConversationId === id) setCurrentConversationId(null);
    fetchConversations();
  };

  const clearAll = async () => {
    if (!window.confirm('Clear all Redis keys (olo-ui:*) and reset UI? This cannot be undone.')) return;
    const { ok, data, error } = await apiJson(`${API}/store/clear`, { method: 'POST' });
    if (ok && data?.cleared) {
      clearSession();
      setConversations([]);
      setCurrentConversationId(null);
      setRagTags([]);
      fetchConversations();
      fetchRagTags();
    } else {
      window.alert(error || data?.error || 'Clear failed. (Redis must be configured.)');
    }
  };

  return (
    <div className="app">
      <Sidebar
        tab={tab}
        setTab={setTab}
        isDebugMode={isDebugMode}
        onDebugModeChange={setIsDebugMode}
        conversations={conversations}
        currentConversationId={currentConversationId}
        setCurrentConversationId={setCurrentConversationId}
        pipelines={activePipelines}
        currentPipelineId={currentPipelineId}
        setCurrentPipelineId={setCurrentPipelineId}
        currentRagTag={currentRagTag}
        setCurrentRagTag={setCurrentRagTag}
        ragTags={ragTags}
        onNewChat={createNewChat}
        onDeleteConversation={deleteConversation}
        onRefreshConversations={fetchConversations}
        onClearAll={clearAll}
        loading={loading}
      />
      <main className="main">
        {(tab === 'chat' || tab === 'rag') && (
          <ChatView
            conversationId={currentConversationId}
            currentPipelineId={currentPipelineId}
            currentRagTag={tab === 'rag' ? currentRagTag : ''}
            isDebugMode={isDebugMode}
            onConversationCreated={createNewChat}
            onEnsureConversation={ensureConversation}
            onSelectConversation={setCurrentConversationId}
          />
        )}
        {tab === 'documents' && (
          <DocumentsView ragTags={ragTags} isDebugMode={isDebugMode} onUploadDone={fetchRagTags} />
        )}
      </main>
    </div>
  );
}
