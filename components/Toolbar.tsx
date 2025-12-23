
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
          let user_input = confirm("Are you sure you want create a new project? \n(All progress will be lost)");
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
