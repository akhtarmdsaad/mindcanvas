
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
