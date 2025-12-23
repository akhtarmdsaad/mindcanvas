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
      if (nodeId === state.rootId) return state; 
      
      const newNodes = { ...state.nodes };
      const nodeToDelete = newNodes[nodeId];
      if (!nodeToDelete) return state;

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

      if (nodeToDelete.parentId) {
        const parent = newNodes[nodeToDelete.parentId];
        if (parent) {
          newNodes[nodeToDelete.parentId] = {
            ...parent,
            childrenIds: parent.childrenIds.filter(cid => cid !== nodeId)
          };
        }
      }

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
    svg.call(zoom)
       // Disable D3's default "Double Click to Zoom" 
       // This allows our Double Click to Edit to work without zooming in
       .on("dblclick.zoom", null);
       
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
    const isInputActive = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName);
    const isEditing = state.editingNodeId !== null;

    if (isEditing || isInputActive) return;
    
    if (!state.selectedNodeId) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      dispatch({ type: 'ADD_CHILD', parentId: state.selectedNodeId });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      dispatch({ type: 'ADD_SIBLING', nodeId: state.selectedNodeId });
    } else if (e.key === 'e' || e.key === 'F2' || e.key === ' ') {
      e.preventDefault();
      dispatch({ type: 'START_EDITING', id: state.selectedNodeId });
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
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