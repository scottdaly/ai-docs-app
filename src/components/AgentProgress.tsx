import { RiLoader4Line, RiSparklingLine, RiToolsLine, RiErrorWarningLine } from '@remixicon/react';
import { useAgentStore } from '../store/useAgentStore';

// Tool display names for better UX
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  list_documents: 'Listing documents',
  read_document: 'Reading document',
  create_document: 'Creating document',
  edit_document: 'Editing document',
  move_document: 'Moving document',
  delete_document: 'Deleting document',
  create_folder: 'Creating folder',
  search_documents: 'Searching documents',
};

export function AgentProgress() {
  const { status, currentTool, error } = useAgentStore();

  // Only show when actively working
  if (status !== 'thinking' && status !== 'executing' && status !== 'error') {
    return null;
  }

  const getToolDisplayName = (toolName: string | null) => {
    if (!toolName) return 'Processing...';
    return TOOL_DISPLAY_NAMES[toolName] || toolName;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-background border rounded-xl shadow-lg overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center gap-3 px-4 py-3">
        {status === 'error' ? (
          <>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-destructive/10">
              <RiErrorWarningLine size={18} className="text-destructive" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-destructive">Error</span>
              <span className="text-xs text-muted-foreground max-w-[200px] truncate">
                {error || 'An error occurred'}
              </span>
            </div>
          </>
        ) : status === 'thinking' ? (
          <>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
              <RiSparklingLine size={18} className="text-primary animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Thinking...</span>
              <span className="text-xs text-muted-foreground">
                Processing your request
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
              <RiLoader4Line size={18} className="text-primary animate-spin" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium flex items-center gap-1.5">
                <RiToolsLine size={12} />
                {getToolDisplayName(currentTool)}
              </span>
              <span className="text-xs text-muted-foreground">
                Executing agent action
              </span>
            </div>
          </>
        )}
      </div>

      {/* Progress indicator bar */}
      {status !== 'error' && (
        <div className="h-1 bg-muted overflow-hidden">
          <div className="h-full w-full bg-primary/50 animate-progress-indeterminate" />
        </div>
      )}
    </div>
  );
}

// Add to your global CSS or tailwind config:
// @keyframes progress-indeterminate {
//   0% { transform: translateX(-100%); }
//   100% { transform: translateX(100%); }
// }
// .animate-progress-indeterminate {
//   animation: progress-indeterminate 1.5s ease-in-out infinite;
// }
