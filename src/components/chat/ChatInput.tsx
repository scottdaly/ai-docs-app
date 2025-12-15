import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, AtSign } from 'lucide-react';
import { ModelSelector } from './ModelSelector';
import { ContextPicker } from './ContextPicker';
import { useAIStore } from '../../store/useAIStore';

interface ChatInputProps {
  onSubmit: (message: string) => void;
  isStreaming: boolean;
  placeholder?: string;
}

export function ChatInput({ onSubmit, isStreaming, placeholder }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [showContextPicker, setShowContextPicker] = useState(false);
  const [contextSearch, setContextSearch] = useState('');
  const [atPosition, setAtPosition] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { contextItems, removeContextItem, addContextItem } = useAIStore();

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    onSubmit(input.trim());
    setInput('');

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't handle Enter when context picker is open (let it handle navigation)
    if (showContextPicker) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowContextPicker(false);
        setContextSearch('');
        setAtPosition(null);
      }
      // Let arrow keys and Enter bubble up to ContextPicker's window listener
      if (['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) {
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    // @ detection for context picker
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([^\s@]*)$/);

    if (atMatch) {
      setShowContextPicker(true);
      setContextSearch(atMatch[1]); // text after @
      setAtPosition(cursorPos - atMatch[0].length);
    } else {
      setShowContextPicker(false);
      setContextSearch('');
      setAtPosition(null);
    }
  };

  const handleContextSelect = (file: { path: string; name: string }) => {
    // Add file to context
    addContextItem({
      type: 'file',
      path: file.path,
      name: file.name,
    });

    // Remove the @search text from input
    if (atPosition !== null) {
      const before = input.substring(0, atPosition);
      const cursorPos = inputRef.current?.selectionStart || input.length;
      const after = input.substring(cursorPos);
      setInput(before + after);
    }

    // Close picker and refocus input
    setShowContextPicker(false);
    setContextSearch('');
    setAtPosition(null);
    inputRef.current?.focus();
  };

  const handleContextPickerClose = () => {
    setShowContextPicker(false);
    setContextSearch('');
    setAtPosition(null);
    inputRef.current?.focus();
  };

  const handleAtButtonClick = () => {
    // Insert @ at cursor position and trigger picker
    const cursorPos = inputRef.current?.selectionStart || input.length;
    const newInput = input.substring(0, cursorPos) + '@' + input.substring(cursorPos);
    setInput(newInput);
    setShowContextPicker(true);
    setContextSearch('');
    setAtPosition(cursorPos);
    inputRef.current?.focus();
  };

  return (
    <div className="flex-shrink-0">
      {/* Context Chips Row */}
      {contextItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-2">
          {contextItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-1 px-2 py-0.5 text-xs bg-muted rounded-md
                         border border-border group"
              title={item.path}
            >
              <span className="max-w-[100px] truncate">{item.name}</span>
              <button
                onClick={() => removeContextItem(item.id)}
                className="text-muted-foreground hover:text-foreground opacity-60 group-hover:opacity-100"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Input Area */}
      <form onSubmit={handleSubmit} className="p-3 relative">
        {/* Context Picker Popover */}
        {showContextPicker && (
          <ContextPicker
            search={contextSearch}
            onSelect={handleContextSelect}
            onClose={handleContextPickerClose}
          />
        )}

        <div className="rounded-lg bg-muted/30 border border-border overflow-hidden focus-within:ring-2 focus-within:ring-primary/50">
          {/* Textarea */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || 'Type @ to add file context...'}
            rows={1}
            disabled={isStreaming}
            className="w-full resize-none px-3 py-2 text-sm bg-transparent
                       placeholder:text-muted-foreground focus:outline-none
                       min-h-[40px] max-h-[120px] disabled:opacity-50"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
          />

          {/* Bottom Toolbar */}
          <div className="flex items-center justify-between px-2 py-1.5">
            {/* Left side - Model selector */}
            <div className="flex items-center gap-2">
              <ModelSelector />
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-1">
              {/* @ Context Button */}
              <button
                type="button"
                onClick={handleAtButtonClick}
                className={`p-1.5 hover:bg-muted rounded transition-colors ${
                  showContextPicker
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Add file context (@)"
              >
                <AtSign size={16} />
              </button>

              {/* Send Button */}
              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted
                           disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isStreaming ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
