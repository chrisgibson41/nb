import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import FileTree from './components/FileTree.jsx';
import EditorPane from './components/EditorPane.jsx';
import TagBar from './components/TagBar.jsx';
import Toolbar from './components/Toolbar.jsx';
import TemplateModal from './components/TemplateModal.jsx';
import MeetingsPanel from './components/MeetingsPanel.jsx';

const API = 'http://localhost:3001';

export default function App() {
  const [currentFile, setCurrentFile] = useState(null);
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [treeRefreshKey, setTreeRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const wsRef = useRef(null);
  const saveTimerRef = useRef(null);
  const editorRef = useRef(null);

  // WebSocket — live file-tree updates
  useEffect(() => {
    function connect() {
      const ws = new WebSocket('ws://localhost:3001');
      wsRef.current = ws;
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === 'tree-change') setTreeRefreshKey((k) => k + 1);
        } catch { /* ignore */ }
      };
      ws.onclose = () => setTimeout(connect, 2000);
      ws.onerror = () => ws.close();
    }
    connect();
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  // Load file from server
  const openFile = useCallback(async (filePath) => {
    try {
      const res = await fetch(`${API}/api/file?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) throw new Error('Failed to load');
      const text = await res.text();
      setCurrentFile(filePath);
      setContent(text);
      setSavedContent(text);
    } catch (err) {
      console.error('Error opening file:', err);
    }
  }, []);

  // Save file to server
  const saveFile = useCallback(async (filePath, fileContent) => {
    if (!filePath) return;
    try {
      await fetch(`${API}/api/file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: fileContent }),
      });
      setSavedContent(fileContent);
    } catch (err) {
      console.error('Error saving file:', err);
    }
  }, []);

  // Debounced auto-save on every edit
  const handleContentChange = useCallback((newContent) => {
    setContent(newContent);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveFile(currentFile, newContent), 800);
  }, [currentFile, saveFile]);

  // Ctrl/Cmd+S — immediate save
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveFile(currentFile, content);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        setShowTemplateModal(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentFile, content, saveFile]);

  const isUnsaved = content !== savedContent;

  const handleTemplateCreated = useCallback((filePath, fileContent) => {
    setCurrentFile(filePath);
    setContent(fileContent);
    setSavedContent(fileContent);
    setShowTemplateModal(false);
    setTreeRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="app">
      <Toolbar
        isUnsaved={isUnsaved}
        onSave={() => saveFile(currentFile, content)}
        onNewTemplate={() => setShowTemplateModal(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        currentFile={currentFile}
      />

      <div className="app-body">
        <div className="sidebar">
          <FileTree
            onFileSelect={openFile}
            currentFile={currentFile}
            refreshKey={treeRefreshKey}
            onRefresh={() => setTreeRefreshKey((k) => k + 1)}
            onNewTemplate={() => setShowTemplateModal(true)}
            searchQuery={searchQuery}
          />
        </div>

        <div className="main-area">
          {currentFile ? (
            <div className="editor-area">
              <MeetingsPanel
                content={content}
                setContent={handleContentChange}
                filePath={currentFile}
                onScrollTo={text => editorRef.current?.scrollToText(text)}
              />
              <EditorPane
                ref={editorRef}
                content={content}
                onChange={handleContentChange}
                filePath={currentFile}
              />
              <TagBar content={content} setContent={handleContentChange} />
            </div>
          ) : (
            <div className="no-file-open">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cccccc" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <p>Select a file to start editing</p>
              <p style={{ fontSize: '12px', color: '#555' }}>or press Ctrl+T to create from a template</p>
            </div>
          )}
        </div>
      </div>

      {showTemplateModal && (
        <TemplateModal
          onClose={() => setShowTemplateModal(false)}
          onCreated={handleTemplateCreated}
          api={API}
        />
      )}
    </div>
  );
}
