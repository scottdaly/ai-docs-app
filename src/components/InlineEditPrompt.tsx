import { useState, useRef, useEffect } from 'react';
import { RiCloseLine, RiLoader4Line, RiSparklingLine, RiSendPlaneLine } from '@remixicon/react';

interface InlineEditPromptProps {
  position: { top: number; left: number };
  selectedText: string;
  onSubmit: (prompt: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function InlineEditPrompt({
  position,
  selectedText,
  onSubmit,
  onCancel,
  isLoading,
}: InlineEditPromptProps) {
  const [prompt, setPrompt] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };

    // Delay adding listener to prevent immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      onSubmit(prompt.trim());
    }
  };

  // Calculate position to keep popup in viewport
  const getAdjustedPosition = () => {
    const padding = 16;
    const popupWidth = 400;
    const popupHeight = 120;

    let { top, left } = position;

    // Adjust horizontal position
    if (left + popupWidth > window.innerWidth - padding) {
      left = window.innerWidth - popupWidth - padding;
    }
    if (left < padding) {
      left = padding;
    }

    // Adjust vertical position - show below selection if possible
    if (top + popupHeight > window.innerHeight - padding) {
      top = position.top - popupHeight - 10; // Show above instead
    }

    return { top, left };
  };

  const adjustedPosition = getAdjustedPosition();

  // Truncate selected text for preview
  const previewText = selectedText.length > 100
    ? selectedText.slice(0, 100) + '...'
    : selectedText;

  return (
    <div
      ref={containerRef}
      className="fixed z-50 w-[400px] bg-background border rounded-xl shadow-xl overflow-hidden"
      style={{
        top: adjustedPosition.top,
        left: adjustedPosition.left,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-2 text-sm font-medium">
          <RiSparklingLine size={14} className="text-primary" />
          <span>Edit with AI</span>
        </div>
        <button
          onClick={onCancel}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RiCloseLine size={14} />
        </button>
      </div>

      {/* Selected text preview */}
      <div className="px-4 py-2 border-b bg-muted/20">
        <p className="text-xs text-muted-foreground mb-1">Selected text:</p>
        <p className="text-sm text-foreground/80 line-clamp-2 italic">"{previewText}"</p>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What would you like to do? (e.g., make it shorter, fix grammar)"
            disabled={isLoading}
            className="flex-1 px-3 py-2 text-sm border rounded-lg bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!prompt.trim() || isLoading}
            className="px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <RiLoader4Line size={16} className="animate-spin" />
            ) : (
              <RiSendPlaneLine size={16} />
            )}
          </button>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {['Fix grammar', 'Make shorter', 'Make longer', 'Improve clarity', 'Change tone'].map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => {
                setPrompt(action);
                inputRef.current?.focus();
              }}
              disabled={isLoading}
              className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded-md transition-colors disabled:opacity-50"
            >
              {action}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
