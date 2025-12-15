import { RiArrowDownSLine, RiCheckLine } from '@remixicon/react';
import { Editor } from '@tiptap/react';
import { useState, useRef, useEffect } from 'react';

interface FontSizeDropdownProps {
  editor: Editor;
}

const FONT_SIZES = [
  { label: '10', value: '10px' },
  { label: '12', value: '12px' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '20', value: '20px' },
  { label: '24', value: '24px' },
  { label: '28', value: '28px' },
  { label: '32', value: '32px' },
];

// Default matches standard document body text (14px = 14pt in Word with current formula)
const DEFAULT_FONT_SIZE = '14';

export function FontSizeDropdown({ editor }: FontSizeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customSize, setCustomSize] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [, forceUpdate] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCustomInput(false);
        setCustomSize('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Re-render when editor selection or content changes
  useEffect(() => {
    const handleUpdate = () => forceUpdate(n => n + 1);
    editor.on('selectionUpdate', handleUpdate);
    editor.on('transaction', handleUpdate);
    return () => {
      editor.off('selectionUpdate', handleUpdate);
      editor.off('transaction', handleUpdate);
    };
  }, [editor]);

  // Focus custom input when shown
  useEffect(() => {
    if (showCustomInput && customInputRef.current) {
      customInputRef.current.focus();
    }
  }, [showCustomInput]);

  const handleSelect = (fontSize: string) => {
    editor.chain().focus().setFontSize(fontSize).run();
    setIsOpen(false);
  };

  const handleUnset = () => {
    editor.chain().focus().unsetFontSize().run();
    setIsOpen(false);
  };

  const handleCustomSize = () => {
    const size = parseInt(customSize);
    if (!isNaN(size) && size > 0 && size <= 200) {
      editor.chain().focus().setFontSize(`${size}px`).run();
      setIsOpen(false);
      setShowCustomInput(false);
      setCustomSize('');
    }
  };

  const handleCustomInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCustomSize();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowCustomInput(false);
      setCustomSize('');
    }
  };

  // Get the computed font size from the DOM
  const getComputedFontSize = (): string => {
    const { from } = editor.state.selection;
    const domAtPos = editor.view.domAtPos(from);
    const node = domAtPos.node as HTMLElement;

    // Find the closest element node (not text node)
    let element: HTMLElement | null = node.nodeType === Node.ELEMENT_NODE
      ? node
      : node.parentElement;

    if (element) {
      const computedStyle = window.getComputedStyle(element);
      const fontSize = computedStyle.fontSize;
      const match = fontSize.match(/^(\d+(?:\.\d+)?)px$/);
      if (match) {
        return Math.round(parseFloat(match[1])).toString();
      }
    }

    return DEFAULT_FONT_SIZE;
  };

  // Determine current font size for label
  const getCurrentFontSize = () => {
    const attrs = editor.getAttributes('textStyle');
    const fontSize = attrs.fontSize;

    // If custom fontSize is set, extract it
    if (fontSize) {
      const match = fontSize.match(/^(\d+)px$/);
      if (match) {
        return match[1];
      }
      // If it's a non-standard value (e.g., "1.5rem"), show "Mixed"
      return 'Mixed';
    }

    // No custom fontSize - get computed size from DOM
    return getComputedFontSize();
  };

  const currentSize = getCurrentFontSize();

  // Check if a specific size is active
  const isSizeActive = (sizeValue: string) => {
    return editor.isActive('textStyle', { fontSize: sizeValue });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 h-8 px-2 text-sm font-medium rounded hover:bg-accent hover:text-accent-foreground transition-colors w-[60px] justify-between"
        title="Font Size"
      >
        <span>{currentSize}</span>
        <RiArrowDownSLine size={14} className="opacity-50 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-32 bg-popover text-popover-foreground border rounded shadow-md py-1 z-50 animate-in fade-in zoom-in-95 duration-100 max-h-[300px] overflow-y-auto">
          {FONT_SIZES.map((size) => (
            <button
              key={size.value}
              onClick={() => handleSelect(size.value)}
              className="flex items-center w-full px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground text-left"
            >
              <span className="flex-1">{size.label}</span>
              {isSizeActive(size.value) && <RiCheckLine size={14} className="ml-2 opacity-70" />}
            </button>
          ))}

          <div className="w-full h-px bg-border my-1" />

          {!showCustomInput ? (
            <button
              onClick={() => setShowCustomInput(true)}
              className="flex items-center w-full px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground text-left"
            >
              <span className="flex-1">Custom...</span>
            </button>
          ) : (
            <div className="px-2 py-1.5">
              <div className="flex items-center gap-1">
                <input
                  ref={customInputRef}
                  type="number"
                  min="1"
                  max="200"
                  value={customSize}
                  onChange={(e) => setCustomSize(e.target.value)}
                  onKeyDown={handleCustomInputKeyDown}
                  placeholder="Size"
                  className="w-full px-2 py-1 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleCustomSize}
                  className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                  disabled={!customSize || parseInt(customSize) <= 0 || parseInt(customSize) > 200}
                >
                  OK
                </button>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                1-200px
              </div>
            </div>
          )}

          <div className="w-full h-px bg-border my-1" />
          <button
            onClick={handleUnset}
            className="flex items-center w-full px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground text-left text-muted-foreground"
          >
            <span className="flex-1">Reset</span>
          </button>
        </div>
      )}
    </div>
  );
}
