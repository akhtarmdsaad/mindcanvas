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

export default Node;