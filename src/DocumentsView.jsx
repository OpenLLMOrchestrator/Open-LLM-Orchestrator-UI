import React, { useState, useRef, useEffect } from 'react';
import { apiJson } from './api';
import { API } from './config';
import './DocumentsView.css';

export default function DocumentsView({ ragTags = [], onUploadDone }) {
  const [ragTag, setRagTag] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (ragTags.length > 0 && !ragTag && ragTags[0]) setRagTag(ragTags[0]);
  }, [ragTags]);

  const handleFileChange = (e) => {
    const list = Array.from(e.target.files || []);
    setFiles(list);
    setResult(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const tag = ragTag.trim();
    if (!tag) {
      setResult({ error: 'Please enter a RAG tag.' });
      return;
    }
    if (files.length === 0) {
      setResult({ error: 'Please select one or more files.' });
      return;
    }

    setUploading(true);
    setResult(null);
    const formData = new FormData();
    formData.append('ragTag', tag);
    files.forEach((f) => formData.append('files', f));

    try {
      const r = await fetch(`${API}/documents/upload`, {
        method: 'POST',
        body: formData,
      });
      const text = await r.text();
      let data = null;
      if (text.trim()) {
        try {
          data = JSON.parse(text);
        } catch (_) {
          setResult({ error: 'Server returned invalid response. Is the API running?' });
          return;
        }
      }
      if (r.ok && data) {
        setResult({
          success: true,
          message: data.message || 'Upload accepted.',
          ragTag: data.ragTag,
          workflowId: data.workflowId,
          fileNames: data.fileNames,
        });
        setFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
        onUploadDone?.();
      } else {
        setResult({ error: data?.error || data?.detail || 'Upload failed.' });
      }
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="documents-view">
      <div className="documents-content">
        <h1 className="documents-title">Upload documents for RAG</h1>
        <p className="documents-desc">
          Upload one or more documents with a tag. They will be sent to Temporal for ingestion.
          Then switch to the <strong>RAG</strong> tab, select that tag as RAG scope, and start a conversation to query your docs.
        </p>

        <form className="upload-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="ragTagSelect">RAG tag (select or type new)</label>
            {ragTags.length > 0 && (
              <select
                id="ragTagSelect"
                value={ragTag}
                onChange={(e) => setRagTag(e.target.value)}
                className="form-select"
              >
                <option value="">— Type new below —</option>
                {ragTags.map((tag) => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            )}
            <input
              id="ragTag"
              type="text"
              value={ragTag}
              onChange={(e) => setRagTag(e.target.value)}
              placeholder="e.g. my-docs, handbook, q1-reports"
              className="form-input"
            />
            <span className="form-hint">Select existing tag above or type a new one. Use this as RAG scope in the RAG tab.</span>
          </div>

          <div className="form-group">
            <label>Files</label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="form-file"
            />
            {files.length > 0 && (
              <ul className="file-list">
                {files.map((f, i) => (
                  <li key={i}>{f.name}</li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="submit"
            className="btn-upload"
            disabled={uploading || !ragTag.trim() || files.length === 0}
          >
            {uploading ? 'Uploading…' : 'Upload to Temporal'}
          </button>
        </form>

        {result && (
          <div className={`result-box ${result.error ? 'error' : 'success'}`}>
            {result.error && <p>{result.error}</p>}
            {result.success && (
              <>
                <p>{result.message}</p>
                {result.workflowId && <p className="result-meta">Workflow: {result.workflowId}</p>}
                {result.fileNames?.length > 0 && (
                  <p className="result-meta">Files: {result.fileNames.join(', ')}</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
