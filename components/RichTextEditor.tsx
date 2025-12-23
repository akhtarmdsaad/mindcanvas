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
  
  const isFocusedRef = useRef(isFocused);
  useEffect(() => { isFocusedRef.current = isFocused; }, [isFocused]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    const stopPropagation = (e: MouseEvent | TouchEvent) => {
      e.stopPropagation();
    };

    el.addEventListener('mousedown', stopPropagation);
    el.addEventListener('touchstart', stopPropagation);
    el.addEventListener('dblclick', stopPropagation); 

    return () => {
      el.removeEventListener('mousedown', stopPropagation);
      el.removeEventListener('touchstart', stopPropagation);
      el.removeEventListener('dblclick', stopPropagation);
    };
  }, []);

  // Focus management
  useEffect(() => {
    if (isFocused && editorRef.current) {
      setTimeout(() => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        
        // Force cursor to end
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }, 0);
    }
  }, [isFocused]);

  const getHtml = () => {
    if (content.length === 0 || (content.length === 1 && content[0].text === '')) {
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

  useLayoutEffect(() => {
    const html = getHtml();

    if (measureRef.current) {
      measureRef.current.innerHTML = html;
      const newWidth = Math.max(measureRef.current.scrollWidth + 30, 100); 
      const newHeight = Math.max(measureRef.current.scrollHeight + 20, 40);
      if (onResize) onResize(newWidth, newHeight);
    }

    if (!editorRef.current) return;
    if (editorRef.current.innerHTML === html) return;

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
    const text = editorRef.current.innerText;
    const currentSpan = content[0] || { fontSize: 14 };
    const newContent: RichTextSpan[] = [{ ...currentSpan, text: text }];
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
          // Allow Enter to save
          if (e.key === 'Enter' && !e.shiftKey || e.key === 'Escape') {
            e.preventDefault();
            editorRef.current?.blur();
          }
          // Stop propagation for React Synthetic events too (keys)
          e.stopPropagation(); 
        }}
        onPaste={(e) => {
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

export default RichTextEditor;