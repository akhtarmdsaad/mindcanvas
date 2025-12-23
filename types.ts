
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
