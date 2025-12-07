import { AlertTriangle } from 'lucide-react';

interface RecoveryPromptProps {
  filePath: string;
  recoveryTime: Date | null;
  onRecover: () => void;
  onDiscard: () => void;
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

export function RecoveryPrompt({ filePath, recoveryTime, onRecover, onDiscard }: RecoveryPromptProps) {
  const fileName = filePath.split('/').pop()?.split('\\').pop() || filePath;
  const timeAgo = recoveryTime ? formatTimeAgo(recoveryTime) : 'recently';

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 mx-4 mt-2 rounded-r">
      <div className="flex items-start">
        <AlertTriangle className="h-5 w-5 text-yellow-500 mr-3 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Unsaved changes recovered
          </h3>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
            Found unsaved changes for "{fileName}" from {timeAgo}.
          </p>
          <div className="mt-3 flex gap-2 flex-wrap">
            <button
              onClick={onRecover}
              className="px-3 py-1.5 text-sm font-medium rounded bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-300 dark:hover:bg-yellow-700 transition-colors"
            >
              Restore changes
            </button>
            <button
              onClick={onDiscard}
              className="px-3 py-1.5 text-sm font-medium rounded text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-800/50 transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
