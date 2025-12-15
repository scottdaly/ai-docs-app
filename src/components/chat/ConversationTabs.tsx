import { useState, useRef, useEffect } from 'react';
import { Plus, List, Trash2, X } from 'lucide-react';
import { useAIStore } from '../../store/useAIStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';

interface ConversationTabsProps {
  onClose: () => void;
}

export function ConversationTabs({ onClose }: ConversationTabsProps) {
  const {
    conversations,
    activeConversationId,
    createConversation,
    switchConversation,
    deleteConversation,
    renameConversation,
    getActiveConversation,
  } = useAIStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const activeConversation = getActiveConversation();
  const otherConversations = conversations.filter(c => c.id !== activeConversationId);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);

  const handleStartRename = () => {
    if (activeConversation) {
      setEditTitle(activeConversation.title);
      setIsEditing(true);
    }
  };

  const handleSaveRename = () => {
    if (activeConversationId && editTitle.trim()) {
      renameConversation(activeConversationId, editTitle.trim());
    }
    setIsEditing(false);
    setEditTitle('');
  };

  const handleCancelRename = () => {
    setIsEditing(false);
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
  };

  const handleDeleteConversation = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    deleteConversation(conversationId);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-muted/10">
      {/* Title - click to edit */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={editInputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSaveRename}
            className="w-full px-2 py-0.5 text-sm font-medium bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <h2
            className="font-medium text-sm truncate cursor-pointer hover:text-primary transition-colors"
            onClick={handleStartRename}
            title={activeConversation?.title || 'New chat'}
          >
            {activeConversation?.title || 'New chat'}
          </h2>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {/* New chat */}
        <button
          onClick={handleNewChat}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="New chat"
        >
          <Plus size={14} />
        </button>

        {/* History dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Chat history"
            >
              <List size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {otherConversations.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                No previous chats
              </div>
            ) : (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Previous Chats
                </div>
                <DropdownMenuSeparator />
                {otherConversations.map((conversation) => (
                  <DropdownMenuItem
                    key={conversation.id}
                    onClick={() => switchConversation(conversation.id)}
                    className="flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="truncate flex-1 text-sm">
                      {conversation.title}
                    </span>
                    <button
                      onClick={(e) => handleDeleteConversation(e, conversation.id)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete chat"
                    >
                      <Trash2 size={12} />
                    </button>
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Close */}
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
