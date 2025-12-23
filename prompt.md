filename: `./index.tsx`
```tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```
filename: `./App.tsx`
```tsx

import React, { useReducer, useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { INITIAL_STATE } from './constants';
import { Action, MindMapState, LayoutMode, NodeData } from './types';
import { computeLayout } from './services/layoutEngine';
import Node from './components/Node';
import Connection from './components/Connection';
import Toolbar from './components/Toolbar';

function reducer(state: MindMapState, action: Action): MindMapState {
  switch (action.type) {
    case 'SET_PROJECT_NAME':
      return { ...state, projectName: action.name };

    case 'LOAD_STATE':
      return { ...action.state, editingNodeId: null };

    case 'SELECT_NODE':
      return { ...state, selectedNodeId: action.id, editingNodeId: null };
    
    case 'START_EDITING':
      return { ...state, editingNodeId: action.id };

    case 'STOP_EDITING':
      return { ...state, editingNodeId: null };

    case 'SET_LAYOUT':
      return { ...state, layoutMode: action.mode };

    case 'UPDATE_NODE':
      return {
        ...state,
        nodes: {
          ...state.nodes,
          [action.id]: { ...state.nodes[action.id], ...action.updates }
        }
      };

    case 'ADD_CHILD': {
      const parentId = action.parentId;
      const id = `node-${Date.now()}`;
      const parent = state.nodes[parentId];
      if (!parent) return state;

      const newNode: NodeData = {
        id,
        parentId,
        childrenIds: [],
        x: parent.x + 200,
        y: parent.y + (parent.childrenIds.length * 80),
        width: 140,
        height: 50,
        content: [{ text: 'New Topic', fontSize: 14 }],
        color: '#94a3b8',
        shape: 'rounded'
      };

      return {
        ...state,
        nodes: {
          ...state.nodes,
          [parentId]: { ...parent, childrenIds: [...parent.childrenIds, id] },
          [id]: newNode
        },
        selectedNodeId: id,
        editingNodeId: id
      };
    }

    case 'ADD_SIBLING': {
      const node = state.nodes[action.nodeId];
      if (!node || !node.parentId) return state;
      return reducer(state, { type: 'ADD_CHILD', parentId: node.parentId });
    }

    case 'DELETE_NODE': {
      const nodeId = action.id;
      if (nodeId === state.rootId) return state; // Cannot delete root
      
      const newNodes = { ...state.nodes };
      const nodeToDelete = newNodes[nodeId];
      if (!nodeToDelete) return state;

      // Recursive helper to get all descendants
      const getDescendants = (id: string): string[] => {
        const node = newNodes[id];
        let ids = [id];
        if (node) {
          node.childrenIds.forEach(childId => {
            ids = [...ids, ...getDescendants(childId)];
          });
        }
        return ids;
      };

      const allToDelete = getDescendants(nodeId);

      // Remove from parent's children list
      if (nodeToDelete.parentId) {
        const parent = newNodes[nodeToDelete.parentId];
        if (parent) {
          newNodes[nodeToDelete.parentId] = {
            ...parent,
            childrenIds: parent.childrenIds.filter(cid => cid !== nodeId)
          };
        }
      }

      // Delete all identified nodes
      allToDelete.forEach(id => delete newNodes[id]);

      return {
        ...state,
        nodes: newNodes,
        selectedNodeId: state.selectedNodeId && allToDelete.includes(state.selectedNodeId) ? null : state.selectedNodeId,
        editingNodeId: state.editingNodeId && allToDelete.includes(state.editingNodeId) ? null : state.editingNodeId
      };
    }

    case 'SET_ZOOM':
      return { ...state, zoomTransform: action.transform };

    case 'MOVE_NODE':
      if (!state.nodes[action.id]) return state;
      return {
        ...state,
        nodes: {
          ...state.nodes,
          [action.id]: { ...state.nodes[action.id], x: action.x, y: action.y }
        }
      };

    default:
      return state;
  }
}

const App: React.FC = () => {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [tempName, setTempName] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<SVGGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('mindcanvas_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        dispatch({ type: 'LOAD_STATE', state: parsed });
      } catch (e) {
        console.error("Failed to load saved state", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!state.projectName) return;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');

    saveTimerRef.current = window.setTimeout(() => {
      localStorage.setItem('mindcanvas_state', JSON.stringify(state));
      setSaveStatus('saved');
    }, 1000);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [state]);

  useEffect(() => {
    if (!svgRef.current || !state.projectName) return;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        d3.select(containerRef.current).attr('transform', event.transform);
        dispatch({ type: 'SET_ZOOM', transform: event.transform });
      });

    const svg = d3.select(svgRef.current);
    svg.call(zoom);
    svg.call(
      zoom.transform, 
      d3.zoomIdentity.translate(state.zoomTransform.x, state.zoomTransform.y).scale(state.zoomTransform.k)
    );
  }, [state.projectName]);

  const handleAutoLayout = useCallback(() => {
    const updates = computeLayout(state.nodes, state.rootId, state.layoutMode);
    Object.entries(updates).forEach(([id, pos]) => {
      dispatch({ type: 'MOVE_NODE', id, x: pos.x, y: pos.y });
    });
  }, [state.nodes, state.rootId, state.layoutMode]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Prevent global shortcuts if user is typing in ANY input or editing a node
    const isInputActive = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName);
    if (state.editingNodeId || isInputActive) return;
    
    if (!state.selectedNodeId) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      dispatch({ type: 'ADD_CHILD', parentId: state.selectedNodeId });
    } else if (e.key === 'Enter') {
      console.log("State:", state);
      e.preventDefault();
      dispatch({ type: 'ADD_SIBLING', nodeId: state.selectedNodeId });
    } else if (e.key === 'e' || e.key === 'F2' || e.key === ' ') {
      e.preventDefault();
      dispatch({ type: 'START_EDITING', id: state.selectedNodeId });
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      // Avoid accidental deletion while not actually meaning to (optional UX check could go here)
      dispatch({ type: 'DELETE_NODE', id: state.selectedNodeId });
    }
  }, [state.selectedNodeId, state.editingNodeId]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleExport = () => {
    if (!state.projectName) return;
    const sanitized = state.projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sanitized + ".json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (typeof result === 'string') {
          const content = JSON.parse(result);
          dispatch({ type: 'LOAD_STATE', state: content });
        }
      } catch (err) {
        alert("Invalid project file.");
      }
    };
    reader.readAsText(file);
  };

  const startProject = () => {
    const trimmed = tempName.trim();
    if (!trimmed) return;
    dispatch({ type: 'SET_PROJECT_NAME', name: trimmed });
  };

  if (!state.projectName) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-300">
          <h2 className="text-2xl font-black text-slate-800 mb-2">New Project</h2>
          <p className="text-slate-500 mb-6 text-sm">Enter a name for your MindCanvas workspace to begin.</p>
          <input
            type="text"
            className="w-full p-4 border-2 border-slate-100 rounded-xl mb-4 outline-none focus:border-blue-500 transition-all font-semibold text-slate-700"
            placeholder="e.g. Brainstorming Session"
            value={tempName}
            autoFocus
            onChange={(e) => setTempName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && startProject()}
          />
          <button
            onClick={startProject}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-200"
          >
            Create Map
          </button>
        </div>
      </div>
    );
  }

  const nodeList = Object.values(state.nodes) as NodeData[];
  const selectedNode = state.selectedNodeId ? state.nodes[state.selectedNodeId] : null;

  return (
    <div className="w-full h-full bg-slate-50 relative">
      <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={onFileChange} />
      
      <Toolbar
        selectedNode={selectedNode}
        layoutMode={state.layoutMode}
        saveStatus={saveStatus}
        onSetLayout={(mode) => dispatch({ type: 'SET_LAYOUT', mode })}
        onUpdateNode={(updates) => state.selectedNodeId && dispatch({ type: 'UPDATE_NODE', id: state.selectedNodeId, updates })}
        onAddChild={() => state.selectedNodeId && dispatch({ type: 'ADD_CHILD', parentId: state.selectedNodeId })}
        onAddSibling={() => state.selectedNodeId && dispatch({ type: 'ADD_SIBLING', nodeId: state.selectedNodeId })}
        onDeleteNode={() => state.selectedNodeId && dispatch({ type: 'DELETE_NODE', id: state.selectedNodeId })}
        onAutoLayout={handleAutoLayout}
        onStartEditing={() => state.selectedNodeId && dispatch({ type: 'START_EDITING', id: state.selectedNodeId })}
        onExport={handleExport}
        onImport={handleImport}
      />

      <div className="absolute top-24 left-6 z-10 bg-white/80 backdrop-blur rounded-lg shadow-xl p-3 border border-slate-200 pointer-events-none">
        <h1 className="text-xl font-black text-slate-800 tracking-tight">{state.projectName}</h1>
        <p className="text-[10px] text-blue-500 uppercase font-black tracking-widest mt-1">MindCanvas Workspace</p>
      </div>

      <svg
        ref={svgRef}
        className="w-full h-full outline-none"
        onClick={() => {
          dispatch({ type: 'SELECT_NODE', id: null });
          dispatch({ type: 'STOP_EDITING' });
        }}
      >
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#cbd5e1" />
          </marker>
        </defs>

        <g ref={containerRef}>
          {nodeList.map(node => (
            node.childrenIds.map(childId => (
              state.nodes[childId] && (
                <Connection key={`${node.id}-${childId}`} parent={node} child={state.nodes[childId]} mode={state.layoutMode} />
              )
            ))
          ))}

          {nodeList.map(node => (
            <Node
              key={node.id}
              node={node}
              isSelected={state.selectedNodeId === node.id}
              isEditing={state.editingNodeId === node.id}
              onSelect={(id) => dispatch({ type: 'SELECT_NODE', id })}
              onStartEditing={(id) => dispatch({ type: 'START_EDITING', id })}
              onStopEditing={() => dispatch({ type: 'STOP_EDITING' })}
              onUpdate={(id, updates) => dispatch({ type: 'UPDATE_NODE', id, updates })}
            />
          ))}
        </g>
      </svg>

      <div className="fixed bottom-6 right-6 flex flex-col gap-2 pointer-events-none">
        <div className="bg-white/80 backdrop-blur rounded-lg shadow p-2 text-[10px] font-black text-slate-400 border border-slate-200 uppercase tracking-tighter">
          {nodeList.length} NODES | {Math.round(state.zoomTransform.k * 100)}% ZOOM
        </div>
      </div>
    </div>
  );
};

export default App;
```
filename: `./index.html`
```html

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MindCanvas - Advanced Mind Mapping</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    body {
      margin: 0;
      padding: 0;
      overflow: hidden;
      background-color: #f8fafc;
      font-family: 'Inter', sans-serif;
    }
    #root {
      width: 100vw;
      height: 100vh;
    }
    /* Hide scrollbars for the canvas */
    ::-webkit-scrollbar {
      display: none;
    }
    /* Custom cursor for panning */
    .grabbing {
      cursor: grabbing !important;
    }
    /* SVG ForeignObject styling */
    .node-editor {
      background: transparent;
      outline: none;
      word-wrap: break-word;
      min-height: 20px;
      padding: 4px;
      line-height: 1.2;
    }
    .node-editor span {
      display: inline-block; 
    }
  </style>
<script type="importmap">
{
  "imports": {
    "d3": "https://esm.sh/d3@^7.9.0",
    "react": "https://esm.sh/react@^19.2.3",
    "react/": "https://esm.sh/react@^19.2.3/",
    "react-dom/": "https://esm.sh/react-dom@^19.2.3/"
  }
}
</script>
<link rel="stylesheet" href="/index.css">
</head>
<body>
  <div id="root"></div>
<script type="module" src="/index.tsx"></script>
</body>
</html>
```
filename: `./metadata.json`
```json
{
  "name": "MindCanvas",
  "description": "A high-performance mind-mapping application with support for rich-text nodes, multiple layout algorithms (Mind Map, Concept Map, Organigram), and advanced visual editing.",
  "requestFramePermissions": []
}```
filename: `./types.ts`
```ts

export enum LayoutMode {
  MIND_MAP = 'MIND_MAP',
  CONCEPT_MAP = 'CONCEPT_MAP',
  ORGANIGRAM = 'ORGANIGRAM'
}

export interface RichTextSpan {
  text: string;
  fontSize: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  color?: string;
  link?: string;
}

export interface NodeData {
  id: string;
  parentId: string | null;
  childrenIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  content: RichTextSpan[];
  color: string;
  shape: 'rect' | 'rounded' | 'diamond' | 'ellipse';
  isFloating?: boolean;
}

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  style: 'solid' | 'dashed' | 'dotted';
}

export interface MindMapState {
  projectName: string | null;
  nodes: Record<string, NodeData>;
  rootId: string;
  relationships: Relationship[];
  layoutMode: LayoutMode;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  zoomTransform: { x: number; y: number; k: number };
}

export type Action =
  | { type: 'SET_PROJECT_NAME'; name: string }
  | { type: 'LOAD_STATE'; state: MindMapState }
  | { type: 'ADD_CHILD'; parentId: string }
  | { type: 'ADD_SIBLING'; nodeId: string }
  | { type: 'UPDATE_NODE'; id: string; updates: Partial<NodeData> }
  | { type: 'DELETE_NODE'; id: string }
  | { type: 'SELECT_NODE'; id: string | null }
  | { type: 'START_EDITING'; id: string }
  | { type: 'STOP_EDITING' }
  | { type: 'MOVE_NODE'; id: string; x: number; y: number }
  | { type: 'SET_LAYOUT'; mode: LayoutMode }
  | { type: 'SET_ZOOM'; transform: { x: number; y: number; k: number } }
  | { type: 'REPARENT_NODE'; nodeId: string; newParentId: string };
```
filename: `./package.json`
```json
{
  "name": "mindcanvas",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "d3": "^7.9.0",
    "react": "^19.2.3",
    "react-dom": "^19.2.3"
  },
  "devDependencies": {
    "@types/node": "^22.14.0",
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "~5.8.2",
    "vite": "^6.2.0"
  }
}
```
filename: `./constants.ts`
```ts

import { LayoutMode, MindMapState } from './types';

export const INITIAL_STATE: MindMapState = {
  projectName: null,
  nodes: {
    'root': {
      id: 'root',
      parentId: null,
      childrenIds: [],
      x: 0,
      y: 0,
      width: 180,
      height: 60,
      content: [{ text: 'Central Topic', fontSize: 18, fontWeight: 'bold', color: '#ffffff' }],
      color: '#3b82f6',
      shape: 'rounded'
    }
  },
  rootId: 'root',
  relationships: [],
  layoutMode: LayoutMode.MIND_MAP,
  selectedNodeId: 'root',
  editingNodeId: null,
  zoomTransform: { x: window.innerWidth / 2, y: window.innerHeight / 2, k: 1 }
};

export const COLORS = [
  '#ffffff','#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b', 'transparent'
];

export const TEXT_COLORS = [
  '#ffffff', '#000000', '#3b82f6', '#ef4444', '#10b981', '#f59e0b'
];

export const SHAPES = ['rect', 'rounded', 'diamond', 'ellipse'] as const;
```
filename: `./tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "module": "ESNext",
    "lib": [
      "ES2022",
      "DOM",
      "DOM.Iterable"
    ],
    "skipLibCheck": true,
    "types": [
      "node"
    ],
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "allowJs": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": [
        "./*"
      ]
    },
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}```
filename: `./vite.config.ts`
```ts
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
```
filename: `./components/Connection.tsx`
```tsx

import React from 'react';
import { NodeData, LayoutMode } from '../types';

interface Props {
  parent: NodeData;
  child: NodeData;
  mode: LayoutMode;
}

const Connection: React.FC<Props> = ({ parent, child, mode }) => {
  const getPath = () => {
    const x1 = parent.x;
    const y1 = parent.y;
    const x2 = child.x;
    const y2 = child.y;

    if (mode === LayoutMode.ORGANIGRAM) {
      // Orthogonal connector
      const midY = (y1 + y2) / 2;
      return `M ${x1} ${y1 + parent.height/2} V ${midY} H ${x2} V ${y2 - child.height/2}`;
    } else {
      // Bezier curve
      const dx = x2 - x1;
      const cp1x = x1 + dx * 0.5;
      const cp2x = x1 + dx * 0.5;
      return `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`;
    }
  };

  return (
    <path
      d={getPath()}
      fill="none"
      stroke="#cbd5e1"
      strokeWidth="2"
      className="transition-all duration-300"
      markerEnd="url(#arrowhead)"
    />
  );
};

export default Connection;
```
filename: `./components/Toolbar.tsx`
```tsx

import React, { useState, useEffect } from 'react';
import { LayoutMode, NodeData, RichTextSpan } from '../types';
import { SHAPES, COLORS, TEXT_COLORS } from '../constants';

interface Props {
  selectedNode: NodeData | null;
  layoutMode: LayoutMode;
  onSetLayout: (mode: LayoutMode) => void;
  onUpdateNode: (updates: Partial<NodeData>) => void;
  onAddChild: () => void;
  onAddSibling: () => void;
  onDeleteNode: () => void;
  onAutoLayout: () => void;
  onStartEditing: () => void;
  onExport: () => void;
  onImport: () => void;
  saveStatus: 'idle' | 'saving' | 'saved';
}

const Toolbar: React.FC<Props> = ({
  selectedNode,
  layoutMode,
  onSetLayout,
  onUpdateNode,
  onAddChild,
  onAddSibling,
  onDeleteNode,
  onAutoLayout,
  onStartEditing,
  onExport,
  onImport,
  saveStatus
}) => {
  const [fontSize, setFontSize] = useState<string>('14');

  useEffect(() => {
    if (selectedNode && selectedNode.content.length > 0) {
      setFontSize(selectedNode.content[0].fontSize.toString());
    }
  }, [selectedNode]);

  const applyFontSize = (val: string) => {
    const size = parseInt(val);
    if (isNaN(size) || !selectedNode) return;
    updateSelectedContent({ fontSize: size });
  };

  const toggleStyle = (key: 'fontWeight' | 'fontStyle', val: string, defaultVal: string) => {
    if (!selectedNode) return;
    const current = selectedNode.content[0][key] || defaultVal;
    updateSelectedContent({ [key]: current === val ? defaultVal : val });
  };

  const updateSelectedContent = (updates: Partial<RichTextSpan>) => {
    if (!selectedNode) return;
    const newContent = selectedNode.content.map(span => ({ ...span, ...updates }));
    onUpdateNode({ content: newContent });
  };

  const currentWeight = selectedNode?.content[0]?.fontWeight || 'normal';
  const currentStyle = selectedNode?.content[0]?.fontStyle || 'normal';

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur rounded-xl shadow-2xl border border-slate-200 p-2 flex items-center gap-3 z-50 transition-all flex-wrap justify-center max-w-[95vw]">
      {/* Save Status */}
      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
        <div className={`w-2 h-2 rounded-full ${saveStatus === 'saved' ? 'bg-green-500' : (saveStatus === 'saving' ? 'bg-yellow-500 animate-pulse' : 'bg-slate-300')}`}></div>
        <span className="text-slate-400">{saveStatus}</span>
      </div>

      <div className="h-6 w-[1px] bg-slate-200"></div>

      {/* File Actions */}
      <div className="flex gap-1">
        <button onClick={onImport} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors" title="Import JSON">
          <i className="fas fa-file-import"></i>
        </button>
        <button onClick={onExport} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors" title="Export JSON">
          <i className="fas fa-file-export"></i>
        </button>
        <button onClick={(e)=>{
          let user_input = confirm("Are you sure you want to delete this project?");
          if (user_input == true) {
            localStorage.clear();
            window.location.reload();
          }
        }} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors" title="New Project">
          {/* add button  */}
          <i className="fas fa-plus"></i>
        </button>
      </div>

      <div className="h-6 w-[1px] bg-slate-200 hidden sm:block"></div>

      {/* Layout Selection */}
      <div className="flex bg-slate-100 rounded-lg p-1">
        {[
          { mode: LayoutMode.MIND_MAP, icon: 'fa-project-diagram', label: 'Mind Map' },
          { mode: LayoutMode.ORGANIGRAM, icon: 'fa-sitemap', label: 'Org Chart' },
          { mode: LayoutMode.CONCEPT_MAP, icon: 'fa-network-wired', label: 'Concept' },
        ].map((item) => (
          <button
            key={item.mode}
            onClick={() => onSetLayout(item.mode)}
            title={item.label}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all ${
              layoutMode === item.mode ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <i className={`fas ${item.icon}`}></i>
            <span className="hidden md:inline">{item.label}</span>
          </button>
        ))}
      </div>

      <button
        onClick={onAutoLayout}
        className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
        title="Auto Layout"
      >
        <i className="fas fa-magic"></i>
      </button>

      {selectedNode && (
        <>
          <div className="h-6 w-[1px] bg-slate-200"></div>
          <div className="flex gap-1">
            <button
              onClick={onStartEditing}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
              title="Edit Text"
            >
              <i className="fas fa-pencil-alt text-[10px]"></i>
              <span>EDIT</span>
            </button>
            <button
              onClick={onDeleteNode}
              disabled={selectedNode.parentId === null}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-2 shadow-sm ${selectedNode.parentId === null ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100'}`}
              title="Delete Node"
            >
              <i className="fas fa-trash-alt text-[10px]"></i>
              <span>DEL</span>
            </button>
          </div>

          <div className="h-6 w-[1px] bg-slate-200"></div>

          <div className="flex gap-1">
            <button
              onClick={onAddChild}
              className="px-2 py-1 bg-blue-50 text-blue-600 rounded-md text-[10px] font-bold hover:bg-blue-100 transition-colors border border-blue-100"
            >
              + CHILD
            </button>
            <button
              onClick={onAddSibling}
              className="px-2 py-1 bg-slate-50 text-slate-600 rounded-md text-[10px] font-bold hover:bg-slate-100 transition-colors border border-slate-100"
            >
              + SIBLING
            </button>
          </div>

          <div className="h-6 w-[1px] bg-slate-200"></div>

          <div className="flex gap-2 items-center">
            <div className="flex items-center bg-slate-100 rounded border border-slate-200 px-1">
              <span className="text-[10px] text-slate-400 font-bold px-1">SIZE:</span>
              <input
                type="number"
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value)}
                onKeyDown={(e) => { 
                  // Stop propagation so global Enter key handler doesn't see this as "Add Sibling"
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                    applyFontSize(fontSize);
                  }
                }}
                onBlur={() => applyFontSize(fontSize)}
                className="w-12 bg-white text-slate-900 text-xs font-bold text-center outline-none py-1 rounded shadow-inner"
                min="8"
                max="72"
              />
            </div>

            <div className="flex bg-slate-100 rounded p-0.5">
              <button
                onClick={() => toggleStyle('fontWeight', 'bold', 'normal')}
                className={`w-7 h-7 rounded text-xs font-bold transition-colors ${currentWeight === 'bold' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
              >B</button>
              <button
                onClick={() => toggleStyle('fontStyle', 'italic', 'normal')}
                className={`w-7 h-7 rounded text-xs italic transition-colors ${currentStyle === 'italic' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
              >I</button>
            </div>

            <div className="flex gap-1 items-center bg-slate-100 rounded p-1">
              {TEXT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => updateSelectedContent({ color: c })}
                  className="w-4 h-4 rounded-full border border-black/10 hover:scale-125 transition-transform"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <div className="flex gap-1 items-center bg-slate-100 rounded p-1">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => onUpdateNode({ color: c })}
                  className={`w-4 h-4 rounded-full border border-black/10 hover:scale-125 transition-transform ${c === 'transparent' ? 'relative bg-white' : ''}`}
                  style={{ backgroundColor: c === 'transparent' ? 'transparent' : c }}
                >
                  {c === 'transparent' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <i className="fas fa-slash text-[8px] text-red-500"></i>
                    </div>
                  )}
                </button>
              ))}
            </div>

            <select
              className="text-[10px] bg-slate-100 border border-slate-200 rounded p-1 outline-none text-slate-900 font-bold uppercase tracking-tighter"
              value={selectedNode.shape}
              onChange={(e) => onUpdateNode({ shape: e.target.value as any })}
            >
              {SHAPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </>
      )}
    </div>
  );
};

export default Toolbar;
```
filename: `./components/Node.tsx`
```tsx
import React, { useCallback } from 'react';
import { NodeData, RichTextSpan } from '../types';
import RichTextEditor from './RichTextEditor';

interface Props {
  node: NodeData;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: (id: string) => void;
  onStartEditing: (id: string) => void;
  onStopEditing: () => void;
  onUpdate: (id: string, updates: Partial<NodeData>) => void;
}

const Node: React.FC<Props> = ({ node, isSelected, isEditing, onSelect, onStartEditing, onStopEditing, onUpdate }) => {
  const getShapePath = () => {
    const { width: w, height: h } = node;
    switch (node.shape) {
      case 'diamond':
        return `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`;
      case 'ellipse':
        return `M ${w / 2} 0 A ${w / 2} ${h / 2} 0 1 1 ${w / 2} ${h} A ${w / 2} ${h / 2} 0 1 1 ${w / 2} 0`;
      case 'rounded':
        return `M 10 0 H ${w - 10} Q ${w} 0 ${w} 10 V ${h - 10} Q ${w} ${h} ${w - 10} ${h} H 10 Q 0 ${h} 0 ${h - 10} V 10 Q 0 0 10 0`;
      default:
        return `M 0 0 H ${w} V ${h} H 0 Z`;
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStartEditing(node.id);
  };

  const handleContentChange = (newContent: RichTextSpan[]) => {
    onUpdate(node.id, { content: newContent });
  };

  const handleResize = useCallback((newWidth: number, newHeight: number) => {
    if (Math.abs(newWidth - node.width) > 2 || Math.abs(newHeight - node.height) > 2) {
      onUpdate(node.id, { width: newWidth, height: newHeight });
    }
  }, [node.id, node.width, node.height, onUpdate]);

  const isTransparent = node.color === 'transparent';

  return (
    <g
      transform={`translate(${node.x - node.width / 2}, ${node.y - node.height / 2})`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      onDoubleClick={handleDoubleClick}
      className="cursor-pointer group"
    >
      {!isTransparent && (
        <path
          d={getShapePath()}
          fill="rgba(0,0,0,0.05)"
          transform="translate(2, 2)"
        />
      )}

      <path
        d={getShapePath()}
        fill={isTransparent ? 'rgba(0,0,0,0)' : node.color}
        stroke={isSelected ? '#3b82f6' : isTransparent ? 'rgba(0,0,0,0.1)' : '#cbd5e1'}
        strokeWidth={isSelected ? 3 : 1}
        strokeDasharray={isTransparent && !isSelected ? "4 4" : "0"}
        className="transition-all duration-200"
      />

      <foreignObject
        x="0"
        y="0"
        width={node.width}
        height={node.height}
        style={{ pointerEvents: isEditing ? 'auto' : 'none' }}
        // CRITICAL FIX: Stop propagation so D3 zoom/drag doesn't interfere with text selection
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div 
          className={`w-full h-full flex items-center justify-center p-2 overflow-hidden ${isSelected ? 'cursor-text' : ''}`}
          style={{ color: node.content[0]?.color || '#000000' }}
        >
          <RichTextEditor
            content={node.content}
            onChange={handleContentChange}
            isFocused={isEditing}
            onBlur={onStopEditing}
            onResize={handleResize}
          />
        </div>
      </foreignObject>

      {isSelected && (
        <circle
          cx={node.width / 2}
          cy={node.height}
          r="4"
          fill="#3b82f6"
          className="opacity-0 group-hover:opacity-100"
        />
      )}
    </g>
  );
};

export default Node;```
filename: `./components/RichTextEditor.tsx`
```tsx
import React, { useRef, useEffect, useLayoutEffect } from 'react';
import { RichTextSpan } from '../types';

interface Props {
  content: RichTextSpan[];
  onChange: (content: RichTextSpan[]) => void;
  isFocused: boolean;
  onBlur: () => void;
  onResize?: (width: number, height: number) => void;
}

// Helper: Get absolute character index relative to the container
const getCaretIndex = (element: HTMLElement) => {
  let position = 0;
  const selection = window.getSelection();
  if (selection && selection.rangeCount !== 0) {
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    position = preCaretRange.toString().length;
  }
  return position;
};

// Helper: Restore caret to a specific character index
const setCaretIndex = (element: HTMLElement, position: number) => {
  let charIndex = 0;
  const range = document.createRange();
  range.setStart(element, 0);
  range.collapse(true);

  const stack: Node[] = [element];
  let found = false;

  while (stack.length > 0 && !found) {
    const node = stack.pop()!;
    if (node.nodeType === 3) { // Text node
      const nextCharIndex = charIndex + (node.textContent?.length || 0);
      if (position <= nextCharIndex) {
        range.setStart(node, position - charIndex);
        range.collapse(true);
        found = true;
      }
      charIndex = nextCharIndex;
    } else {
      // Push children in reverse order
      const children = node.childNodes;
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push(children[i]);
      }
    }
  }

  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
    selection.addRange(range);
  }
};

const RichTextEditor: React.FC<Props> = ({ content, onChange, isFocused, onBlur, onResize }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  
  // Track if we are currently holding focus to prevent aggressive selection clearing
  const isFocusedRef = useRef(isFocused);
  useEffect(() => { isFocusedRef.current = isFocused; }, [isFocused]);

  // Focus management
  useEffect(() => {
    if (isFocused && editorRef.current) {
      editorRef.current.focus();
      // Only set selection to end if we just gained focus
      if (document.activeElement !== editorRef.current) {
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }, [isFocused]);

  const getHtml = () => {
    if (content.length === 0 || (content.length === 1 && content[0].text === '')) {
      // Use zero-width space or break to ensure height exists
      return '<span style="font-size:14px">&nbsp;</span>';
    }
    
    return content.map(span => {
      const style = `font-size:${span.fontSize}px;font-weight:${span.fontWeight || 'normal'};font-style:${span.fontStyle || 'normal'};color:${span.color || 'inherit'}`;
      const safeText = span.text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<span style="${style}">${safeText}</span>`;
    }).join('');
  };

  // Sync DOM with state
  useLayoutEffect(() => {
    const html = getHtml();

    // 1. Measurement (Hidden Div)
    if (measureRef.current) {
      measureRef.current.innerHTML = html;
      const newWidth = Math.max(measureRef.current.scrollWidth + 30, 100); 
      const newHeight = Math.max(measureRef.current.scrollHeight + 20, 40);
      if (onResize) onResize(newWidth, newHeight);
    }

    // 2. Editor DOM Update (Visible Div)
    if (!editorRef.current) return;

    // If the HTML is effectively the same, don't touch DOM (prevents some flickering)
    if (editorRef.current.innerHTML === html) return;

    // FIX: Save Cursor -> Update HTML -> Restore Cursor
    let savedCaretIndex = 0;
    if (isFocusedRef.current) {
      savedCaretIndex = getCaretIndex(editorRef.current);
    }

    editorRef.current.innerHTML = html;

    if (isFocusedRef.current) {
      setCaretIndex(editorRef.current, savedCaretIndex);
    }
  }, [content, onResize]);

  const handleInput = () => {
    if (!editorRef.current) return;
    
    const text = editorRef.current.innerText; // Get plain text from DOM
    
    // Preserve the style of the first span, but update the text
    const currentSpan = content[0] || { fontSize: 14 };
    
    // This simple implementation flattens multiple spans into one on edit.
    // Ideally, you'd parse the HTML back to spans, but for this issue fix, 
    // ensuring the text matches the input is priority.
    const newContent: RichTextSpan[] = [{
      ...currentSpan,
      text: text
    }];
    
    onChange(newContent);
  };

  return (
    <>
      <div
        ref={editorRef}
        contentEditable={isFocused}
        suppressContentEditableWarning
        className={`node-editor w-full h-full flex flex-col items-center justify-center text-center outline-none ${isFocused ? 'cursor-text' : ''}`}
        onInput={handleInput}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            editorRef.current?.blur();
          }
          // Stop propagation to prevent deleting the node while typing backspace
          e.stopPropagation(); 
        }}
        onPaste={(e) => {
          // Optional: Force plain text paste to avoid garbage HTML
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, text);
        }}
      />

      <div
        ref={measureRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          visibility: 'hidden',
          top: -9999,
          left: -9999,
          width: 'max-content',
          minWidth: '100px',
          maxWidth: '400px',
          whiteSpace: 'pre-wrap',
          lineHeight: '1.2',
          padding: '4px',
          fontFamily: 'Inter, sans-serif'
        }}
      />
    </>
  );
};

export default RichTextEditor;```
filename: `./services/layoutEngine.ts`
```ts
import * as d3 from 'd3';
import { NodeData, LayoutMode } from '../types';

interface LayoutNode extends d3.HierarchyNode<NodeData> {
  x: number;
  y: number;
  width: number;
  height: number;
  // Computed dimensions for the subtree
  subtreeWidth: number;
  subtreeHeight: number;
}

const GAP_HORIZONTAL = 80;
const GAP_VERTICAL = 20;

export const computeLayout = (
  nodes: Record<string, NodeData>,
  rootId: string,
  mode: LayoutMode
): Record<string, { x: number; y: number }> => {
  const rootData = nodes[rootId];
  if (!rootData) return {};

  // 1. Build Hierarchy
  // We use d3.hierarchy just for easy traversal structure, but we'll do the layout math ourselves.
  const root = d3.hierarchy<NodeData>(rootData, (d) => 
    d.childrenIds.map(id => nodes[id]).filter(Boolean)
  ) as LayoutNode;

  // Initialize dimensions on the hierarchy nodes for easier access
  root.each((node) => {
    node.width = node.data.width;
    node.height = node.data.height;
  });

  const updates: Record<string, { x: number; y: number }> = {};

  if (mode === LayoutMode.ORGANIGRAM) {
    calculateVerticalLayout(root);
  } else if (mode === LayoutMode.MIND_MAP) {
    calculateHorizontalLayout(root);
  } else {
    // Concept Map: Keep existing positions
    Object.keys(nodes).forEach(id => {
      updates[id] = { x: nodes[id].x, y: nodes[id].y };
    });
    return updates;
  }

  // Extract coordinates
  root.each((node) => {
    updates[node.data.id] = { x: node.x, y: node.y };
  });

  return updates;
};

/**
 * Horizontal Layout (Mind Map style - growing Right)
 * - Calculates subtree HEIGHT
 * - Stacks children Vertically
 * - Centers parent Vertically relative to children
 */
function calculateHorizontalLayout(root: LayoutNode) {
  // Pass 1: Measure subtrees (Post-order)
  root.eachAfter((node) => {
    if (!node.children || node.children.length === 0) {
      node.subtreeHeight = node.height;
    } else {
      const childrenHeight = node.children.reduce((acc, child) => acc + child.subtreeHeight, 0);
      const gaps = (node.children.length - 1) * GAP_VERTICAL;
      node.subtreeHeight = Math.max(node.height, childrenHeight + gaps);
    }
  });

  // Pass 2: Assign Positions (Pre-order)
  // Set root position
  root.x = 0;
  root.y = 0;

  root.eachBefore((node) => {
    if (!node.children) return;

    // Calculate starting Y for children block so it is centered on the parent
    const childrenBlockHeight = node.children.reduce((acc, c) => acc + c.subtreeHeight, 0) 
      + (node.children.length - 1) * GAP_VERTICAL;
    
    let currentChildY = node.y - childrenBlockHeight / 2;

    node.children.forEach((child) => {
      // Parent X + Parent Half Width + Gap + Child Half Width = Child Center X
      child.x = node.x + (node.width / 2) + GAP_HORIZONTAL + (child.width / 2);
      
      // Center the child vertically within its own allocated subtree height slot
      child.y = currentChildY + (child.subtreeHeight / 2);
      
      // Advance Y pointer
      currentChildY += child.subtreeHeight + GAP_VERTICAL;
    });
  });
}

/**
 * Vertical Layout (Organigram style - growing Down)
 * - Calculates subtree WIDTH
 * - Stacks children Horizontally
 * - Centers parent Horizontally relative to children
 */
function calculateVerticalLayout(root: LayoutNode) {
  // Pass 1: Measure subtrees (Post-order)
  root.eachAfter((node) => {
    if (!node.children || node.children.length === 0) {
      node.subtreeWidth = node.width;
    } else {
      const childrenWidth = node.children.reduce((acc, child) => acc + child.subtreeWidth, 0);
      const gaps = (node.children.length - 1) * GAP_HORIZONTAL; // Use horizontal gap for separation
      node.subtreeWidth = Math.max(node.width, childrenWidth + gaps);
    }
  });

  // Pass 2: Assign Positions (Pre-order)
  root.x = 0;
  root.y = 0;

  root.eachBefore((node) => {
    if (!node.children) return;

    const childrenBlockWidth = node.children.reduce((acc, c) => acc + c.subtreeWidth, 0)
      + (node.children.length - 1) * GAP_HORIZONTAL;
    
    let currentChildX = node.x - childrenBlockWidth / 2;

    node.children.forEach((child) => {
      // Center the child horizontally within its allocated subtree width
      child.x = currentChildX + (child.subtreeWidth / 2);
      
      // Parent Y + Parent Half Height + Gap + Child Half Height
      child.y = node.y + (node.height / 2) + 60 + (child.height / 2); // Fixed vertical gap of 60
      
      currentChildX += child.subtreeWidth + GAP_HORIZONTAL;
    });
  });
}

```
