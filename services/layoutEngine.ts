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

