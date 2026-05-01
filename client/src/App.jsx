// NB App
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import FileTree from './components/FileTree.jsx';
import EditorPane from './components/EditorPane.jsx';
import TagBar from './components/TagBar.jsx';
import Toolbar from './components/Toolbar.jsx';
import TemplateModal from './components/TemplateModal.jsx';
import ShortcutsPanel from './components/ShortcutsPanel.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import OutlinePanel from './components/OutlinePanel.jsx';
import TabBar from './components/TabBar.jsx';

const API = 'http://localhost:3001';

export default function App() {
  const [currentFile, setCurrentFile] = useState(null);
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [treeRefreshKey, setTreeRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  // Tabs — [{ path, pinned }]; unsaved tracked by comparing content vs savedContent per path
  // Initialise from localStorage so tabs survive a reload
  const [tabs, setTabs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nb:tabs') || '[]'); } catch { return []; }
  });
  const [unsavedPaths, setUnsavedPaths] = useState(new Set());
  const [templates, setTemplates] = useState([]);
  const wsRef = useRef(null);
  const saveTimerRef = useRef(null);
  const editorRef = useRef(null);

  // Load templates once
  useEffect(() => {
    fetch(`${API}/api/templates`)
      .then(r => r.json())
      .then(setTemplates)
      .catch(() => {});
  }, []);

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

  // Persist tabs + active tab to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('nb:tabs', JSON.stringify(tabs));
  }, [tabs]);

  useEffect(() => {
    if (currentFile) localStorage.setItem('nb:activeTab', currentFile);
    // Don't remove on null — that's just the initial render state, not an
    // intentional close-all, and it would wipe the key before the restore
    // effect on the same render cycle gets a chance to read it.
  }, [currentFile]);

  // Load file from server and open/switch to its tab
  const openFile = useCallback(async (filePath) => {
    try {
      const res = await fetch(`${API}/api/file?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) throw new Error('Failed to load');
      const text = await res.text();
      setCurrentFile(filePath);
      setContent(text);
      setSavedContent(text);
      setUnsavedPaths(prev => { const n = new Set(prev); n.delete(filePath); return n; });
      setTabs(prev => prev.some(t => t.path === filePath) ? prev : [...prev, { path: filePath, pinned: false }]);
    } catch (err) {
      console.error('Error opening file:', err);
    }
  }, []);

  // On first load, reopen the last active file (tabs are already restored via useState init)
  useEffect(() => {
    const savedActive = localStorage.getItem('nb:activeTab');
    if (savedActive) {
      openFile(savedActive);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch to an already-open tab (no fetch if it's the same file)
  const switchTab = useCallback((filePath) => {
    if (filePath === currentFile) return;
    openFile(filePath);
  }, [currentFile, openFile]);

  // Close a tab
  const closeTab = useCallback((filePath) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.path === filePath);
      if (idx === -1) return prev;
      const next = prev.filter(t => t.path !== filePath);
      // If closing the active tab, switch to an adjacent one
      if (filePath === currentFile) {
        const newActive = next[Math.min(idx, next.length - 1)];
        if (newActive) openFile(newActive.path);
        else { setCurrentFile(null); setContent(''); setSavedContent(''); }
      }
      return next;
    });
    setUnsavedPaths(prev => { const n = new Set(prev); n.delete(filePath); return n; });
  }, [currentFile, openFile]);

  // Pin / unpin a tab
  const togglePin = useCallback((filePath) => {
    setTabs(prev => prev.map(t => t.path === filePath ? { ...t, pinned: !t.pinned } : t));
  }, []);

  // Close all tabs except the given one
  const closeOtherTabs = useCallback((keepPath) => {
    setTabs(prev => {
      const next = prev.filter(t => t.path === keepPath || t.pinned);
      if (!next.some(t => t.path === currentFile)) {
        const newActive = next.find(t => t.path === keepPath) || next[0];
        if (newActive) openFile(newActive.path);
        else { setCurrentFile(null); setContent(''); setSavedContent(''); }
      }
      return next;
    });
  }, [currentFile, openFile]);

  // Close all non-pinned tabs
  const closeAllTabs = useCallback(() => {
    setTabs(prev => {
      const next = prev.filter(t => t.pinned);
      if (!next.some(t => t.path === currentFile)) {
        if (next.length) openFile(next[0].path);
        else { setCurrentFile(null); setContent(''); setSavedContent(''); }
      }
      return next;
    });
  }, [currentFile, openFile]);

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
    setUnsavedPaths(prev => { const n = new Set(prev); n.add(currentFile); return n; });
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveFile(currentFile, newContent);
      setUnsavedPaths(prev => { const n = new Set(prev); n.delete(currentFile); return n; });
    }, 800);
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
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (currentFile) closeTab(currentFile);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentFile, content, saveFile, closeTab]);

  const isUnsaved = currentFile ? unsavedPaths.has(currentFile) : false;

  const handleTemplateCreated = useCallback((filePath, fileContent) => {
    setCurrentFile(filePath);
    setContent(fileContent);
    setSavedContent(fileContent);
    setShowTemplateModal(false);
    setTreeRefreshKey((k) => k + 1);
    setTabs(prev => prev.some(t => t.path === filePath) ? prev : [...prev, { path: filePath, pinned: false }]);
  }, []);

  return (
    <div className="app">
      <Toolbar
        isUnsaved={isUnsaved}
        onSave={() => saveFile(currentFile, content)}
        onNewTemplate={() => setShowTemplateModal(true)}
        onSettings={() => setShowSettings(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        currentFile={currentFile}
      />

      <TabBar
        tabs={tabs}
        activeTab={currentFile}
        unsavedPaths={unsavedPaths}
        onSwitch={switchTab}
        onClose={closeTab}
        onPin={togglePin}
        onCloseOthers={closeOtherTabs}
        onCloseAll={closeAllTabs}
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
          {/* ShortcutsPanel lives outside the conditional so it never unmounts */}
          <ShortcutsPanel
            content={content}
            setContent={handleContentChange}
            filePath={currentFile}
            onScrollTo={text => editorRef.current?.scrollToText(text)}
            templates={templates}
          />
          {currentFile ? (
            <div className="editor-area">
              <div className="editor-with-outline">
                <EditorPane
                  ref={editorRef}
                  content={content}
                  onChange={handleContentChange}
                  filePath={currentFile}
                />
                <OutlinePanel
                  content={content}
                  onScrollTo={text => editorRef.current?.scrollToText(text)}
                />
              </div>
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

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
