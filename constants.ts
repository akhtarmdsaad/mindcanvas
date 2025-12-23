
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
