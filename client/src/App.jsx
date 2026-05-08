// NB App
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import FileTree from './components/FileTree.jsx';
import EditorPane from './components/EditorPane.jsx';
import TagBar from './components/TagBar.jsx';
import CombinedBar from './components/CombinedBar.jsx';
import TemplateModal from './components/TemplateModal.jsx';
import ShortcutsPanel from './components/ShortcutsPanel.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import HistoryModal from './components/HistoryModal.jsx';
import ResizablePanel from './components/ResizablePanel.jsx';
import RightSidebar from './components/RightSidebar.jsx';
import TasksPanel from './components/TasksPanel.jsx';
import GettingStarted from './components/GettingStarted.jsx';

// In dev, Vite proxies /api → localhost:3001. In production, same origin.
const API = '';

export default function App() {
  const [currentFile, setCurrentFile] = useState(null);
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTasks, setShowTasks]     = useState(false);
  const [showGettingStarted, setShowGettingStarted] = useState(() => {
    return !localStorage.getItem('nb:dismissedGettingStarted');
  });
  const [treeRefreshKey, setTreeRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  // Tabs — [{ path, pinned, preview }]
  // On restore, only bring back pinned tabs; the active file re-opens as the working tab.
  const [tabs, setTabs] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nb:tabs') || '[]');
      return saved.filter(t => t.pinned);
    } catch { return []; }
  });
  const [unsavedPaths, setUnsavedPaths] = useState(new Set());
  const [templates, setTemplates] = useState([]);
  const wsRef = useRef(null);
  const saveTimerRef = useRef(null);
  const commitTimerRef = useRef(null);
  const editorRef = useRef(null);

  // Load templates once
  useEffect(() => {
    fetch(`${API}/api/templates`)
      .then(r => r.json())
      .then(data => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // WebSocket — live file-tree updates
  useEffect(() => {
    function connect() {
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;
      const ws = new WebSocket(wsUrl);
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

  // Save file to server (no git commit — commits are batched separately)
  const saveFile = useCallback(async (filePath, fileContent) => {
    if (!filePath) return;
    try {
      await fetch(`${API}/api/file?nocommit=1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: fileContent }),
      });
      setSavedContent(fileContent);
    } catch (err) {
      console.error('Error saving file:', err);
    }
  }, []);

  // Explicit git commit for a single file
  const commitFile = useCallback(async (filePath) => {
    if (!filePath) return;
    try {
      await fetch(`${API}/api/git/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath }),
      });
    } catch { /* silent */ }
  }, []);

  // Load file from server and open/switch to its tab.
  // Opening always reuses the single preview tab unless the file already has
  // a permanent (non-preview) tab open.
  const openFile = useCallback(async (filePath) => {
    try {
      const res = await fetch(`${API}/api/file?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) throw new Error('Failed to load');
      const text = await res.text();
      setCurrentFile(filePath);
      setContent(text);
      setSavedContent(text);
      // Commit any unsaved git state for the file we're leaving
      if (currentFile) commitFile(currentFile);
      setUnsavedPaths(prev => { const n = new Set(prev); n.delete(filePath); return n; });
      setTabs(prev => {
        const existing = prev.find(t => t.path === filePath);
        // Already open (pinned or current working tab) — just switch, no list change
        if (existing) return prev;
        // Keep all pinned tabs; replace the single working (non-pinned) tab
        const pinned = prev.filter(t => t.pinned);
        return [...pinned, { path: filePath, pinned: false, preview: true }];
      });
    } catch (err) {
      console.error('Error opening file:', err);
    }
  }, [currentFile, commitFile]);

  // Resolve [[Wiki Link]] note names to file paths via the server
  const handleWikiLink = useCallback(async (noteName) => {
    try {
      const res = await fetch(`${API}/api/resolve?name=${encodeURIComponent(noteName)}`);
      if (res.ok) {
        const { path } = await res.json();
        openFile(path);
      }
    } catch { /* ignore */ }
  }, [openFile]);

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

  // Pin / unpin a tab — pinning also promotes a preview tab to permanent
  const togglePin = useCallback((filePath) => {
    setTabs(prev => prev.map(t =>
      t.path === filePath ? { ...t, pinned: !t.pinned, preview: false } : t
    ));
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

  // Debounced auto-save on every edit
  const handleContentChange = useCallback((newContent) => {
    setContent(newContent);
    setUnsavedPaths(prev => { const n = new Set(prev); n.add(currentFile); return n; });
    // Note: editing does NOT promote the working tab — only pinning does.
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveFile(currentFile, newContent);
      setUnsavedPaths(prev => { const n = new Set(prev); n.delete(currentFile); return n; });
    }, 800);
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    commitTimerRef.current = setTimeout(() => {
      commitFile(currentFile);
    }, 15_000);
  }, [currentFile, saveFile, commitFile]);

  // Ctrl/Cmd+S — immediate save; Enter — immediate commit
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveFile(currentFile, content);
        commitFile(currentFile);
      }
      if (e.key === 'Enter' && currentFile) {
        if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
        commitFile(currentFile);
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
  }, [currentFile, content, saveFile, commitFile, closeTab]);

  const isUnsaved = currentFile ? unsavedPaths.has(currentFile) : false;

  const handleTemplateCreated = useCallback((filePath, fileContent) => {
    setCurrentFile(filePath);
    setContent(fileContent);
    setSavedContent(fileContent);
    setShowTemplateModal(false);
    setTreeRefreshKey((k) => k + 1);
    // New files open as the working tab (replaces any existing working tab)
    setTabs(prev => {
      const existing = prev.find(t => t.path === filePath);
      if (existing) return prev;
      const pinned = prev.filter(t => t.pinned);
      return [...pinned, { path: filePath, pinned: false, preview: true }];
    });
  }, []);

  return (
    <div className="app">
      <CombinedBar
        isUnsaved={isUnsaved}
        onSave={() => saveFile(currentFile, content)}
        onNewTemplate={() => setShowTemplateModal(true)}
        onSettings={() => setShowSettings(true)}
        onHistory={() => setShowHistory(true)}
        onTasks={() => setShowTasks(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        currentFile={currentFile}
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
        <ResizablePanel
          storageKey="nb:panel:sidebar"
          defaultWidth={240}
          minWidth={140}
          position="left"
          label="Explorer"
        >
          {({ collapseButton }) => (
            <div className="sidebar" style={{ width: '100%', flex: 1 }}>
              <FileTree
                onFileSelect={openFile}
                currentFile={currentFile}
                refreshKey={treeRefreshKey}
                onRefresh={() => setTreeRefreshKey((k) => k + 1)}
                onNewTemplate={() => setShowTemplateModal(true)}
                searchQuery={searchQuery}
                collapseButton={collapseButton}
              />
            </div>
          )}
        </ResizablePanel>

        <div className="main-area">
          {currentFile && (
            <ShortcutsPanel
              content={content}
              setContent={handleContentChange}
              filePath={currentFile}
              onScrollTo={text => editorRef.current?.scrollToText(text)}
              templates={templates}
            />
          )}
          {currentFile ? (
            <div className="editor-area">
              <div className="editor-with-outline">
                <EditorPane
                  ref={editorRef}
                  content={content}
                  onChange={handleContentChange}
                  filePath={currentFile}
                  onWikiLink={handleWikiLink}
                />
                <ResizablePanel
                  storageKey="nb:panel:right"
                  defaultWidth={220}
                  minWidth={150}
                  position="right"
                  label="Panels"
                >
                  {() => (
                    <RightSidebar
                      content={content}
                      currentFile={currentFile}
                      onScrollTo={text => editorRef.current?.scrollToText(text)}
                      onFileSelect={openFile}
                    />
                  )}
                </ResizablePanel>
              </div>
              <TagBar content={content} setContent={handleContentChange} />
            </div>
          ) : showGettingStarted ? (
            <GettingStarted onClose={() => {
              setShowGettingStarted(false);
              localStorage.setItem('nb:dismissedGettingStarted', '1');
            }} />
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
              <button
                onClick={() => setShowGettingStarted(true)}
                title="Open Getting Started guide"
                style={{
                  marginTop: '8px', padding: '6px 14px', borderRadius: '6px',
                  background: 'transparent', border: '1px solid #3c3c3c',
                  color: '#666', fontSize: '12px', cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#999'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#3c3c3c'; e.currentTarget.style.color = '#666'; }}
              >
                Getting Started guide
              </button>
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

      {showHistory && currentFile && (
        <HistoryModal
          filePath={currentFile}
          onClose={() => setShowHistory(false)}
          onRestore={(restoredContent) => handleContentChange(restoredContent)}
        />
      )}

      {showTasks && (
        <TasksPanel
          onClose={() => setShowTasks(false)}
          onFileSelect={(path) => { openFile(path); setShowTasks(false); }}
        />
      )}
    </div>
  );
}
