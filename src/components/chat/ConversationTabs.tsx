import { useState, useRef, useEffect } from 'react';
import { Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useAIStore, Conversation } from '../../store/useAIStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export function ConversationTabs() {
  const {
    conversations,
    activeConversationId,
    createConversation,
    switchConversation,
    deleteConversation,
    renameConversation,
  } = useAIStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleStartRename = (conversation: Conversation) => {
    setEditingId(conversation.id);
    setEditTitle(conversation.title);
  };

  const handleSaveRename = () => {
    if (editingId && editTitle.trim()) {
      renameConversation(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      handleCancelRename();
    }
  };

  const handleNewChat = () => {
    createConversation();
    // Scroll to the end to show the new tab
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
      }
    }, 50);
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-muted/20 overflow-hidden">
      {/* Scrollable tabs container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {conversations.map((conversation) => {
          const isActive = conversation.id === activeConversationId;
          const isEditing = editingId === conversation.id;

          return (
            <div
              key={conversation.id}
              className={`
                group flex items-center gap-1 px-2 py-1 rounded-md text-xs
                min-w-0 flex-shrink-0 max-w-[160px] cursor-pointer transition-colors
                ${isActive
                  ? 'bg-background border border-border shadow-sm'
                  : 'hover:bg-muted/50 border border-transparent'
                }
              `}
              onClick={() => !isEditing && switchConversation(conversation.id)}
            >
              {isEditing ? (
                <div className="flex items-center gap-1 min-w-0">
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSaveRename}
                    className="flex-1 min-w-0 px-1 py-0.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              ) : (
                <>
                  <span className="truncate flex-1" title={conversation.title}>
                    {conversation.title}
                  </span>

                  {/* Tab actions dropdown - only show on hover for active tab */}
                  {isActive && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal size={12} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-32">
                        <DropdownMenuItem onClick={() => handleStartRename(conversation)}>
                          <Pencil size={12} className="mr-2" />
                          Rename
                        </DropdownMenuItem>
                        {conversations.length > 1 && (
                          <DropdownMenuItem
                            onClick={() => deleteConversation(conversation.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 size={12} className="mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* New chat button */}
      <button
        onClick={handleNewChat}
        className="flex-shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title="New chat"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
