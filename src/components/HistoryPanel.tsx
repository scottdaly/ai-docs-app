import { useEffect, useMemo } from 'react';
import { X, History, Bookmark, Loader2 } from 'lucide-react';
import { useHistoryStore } from '../store/useHistoryStore';
import { useFileSystem } from '../store/useFileSystem';
import { CheckpointItem } from './CheckpointItem';
import { CompareModal } from './CompareModal';

interface HistoryPanelProps {
  onRestoreContent: (content: any) => void;
}

export function HistoryPanel({ onRestoreContent }: HistoryPanelProps) {
  const { rootDir, activeFilePath } = useFileSystem();
  const {
    isOpen,
    closePanel,
    checkpoints,
    isLoading,
    error,
    selectedCheckpointId,
    isCompareMode,
    compareCheckpointId,
    compareContent,
    isLoadingCompare,
    loadCheckpoints,
    clearCheckpoints,
    selectCheckpoint,
    restoreCheckpoint,
    startCompare,
    cancelCompare,
    loadCompare,
    labelCheckpoint,
  } = useHistoryStore();

  // Load checkpoints when panel opens or file changes
  useEffect(() => {
    if (isOpen && rootDir && activeFilePath) {
      loadCheckpoints(rootDir, activeFilePath);
    } else if (!isOpen) {
      clearCheckpoints();
    }
  }, [isOpen, rootDir, activeFilePath, loadCheckpoints, clearCheckpoints]);

  // Handle compare mode selection
  useEffect(() => {
    if (isCompareMode && selectedCheckpointId && compareCheckpointId && rootDir && activeFilePath) {
      loadCompare(rootDir, activeFilePath, compareCheckpointId, selectedCheckpointId);
    }
  }, [isCompareMode, selectedCheckpointId, compareCheckpointId, rootDir, activeFilePath, loadCompare]);

  if (!isOpen) {
    return null;
  }

  const handleRestore = async (checkpointId: string) => {
    if (!rootDir || !activeFilePath) return;

    const confirmed = window.confirm(
      'Restore this version? Your current changes will be replaced.'
    );
    if (!confirmed) return;

    const content = await restoreCheckpoint(rootDir, activeFilePath, checkpointId);
    if (content) {
      onRestoreContent(content);
      // Reload checkpoints after restore
      loadCheckpoints(rootDir, activeFilePath);
    }
  };

  const handleCompare = (checkpointId: string) => {
    startCompare(checkpointId);
  };

  const handleLabel = async (checkpointId: string, label: string) => {
    if (!rootDir || !activeFilePath) return;
    await labelCheckpoint(rootDir, activeFilePath, checkpointId, label);
  };

  const bookmarks = checkpoints.filter(cp => cp.type === 'bookmark');
  const autoSaves = checkpoints.filter(cp => cp.type === 'auto');

  // Get checkpoint details for compare modal
  const compareSourceCheckpoint = useMemo(() => {
    return checkpoints.find(cp => cp.id === compareCheckpointId);
  }, [checkpoints, compareCheckpointId]);

  const compareTargetCheckpoint = useMemo(() => {
    return checkpoints.find(cp => cp.id === selectedCheckpointId);
  }, [checkpoints, selectedCheckpointId]);

  // Show compare modal when we have both checkpoints and content
  const showCompareModal = isCompareMode &&
    compareContent &&
    compareSourceCheckpoint &&
    compareTargetCheckpoint;

  const handleCloseCompare = () => {
    cancelCompare();
  };

  const handleRestoreFromCompare = async (checkpointId: string) => {
    if (!rootDir || !activeFilePath) return;

    try {
      const content = await restoreCheckpoint(rootDir, activeFilePath, checkpointId);
      if (content) {
        onRestoreContent(content);
        loadCheckpoints(rootDir, activeFilePath);
      }
    } finally {
      // Always close compare mode, even if restore fails
      cancelCompare();
    }
  };

  return (
    <>
      {/* Compare Modal */}
      {showCompareModal && (
        <CompareModal
          checkpointA={{
            id: compareSourceCheckpoint.id,
            label: compareSourceCheckpoint.label,
            timestamp: compareSourceCheckpoint.timestamp,
          }}
          checkpointB={{
            id: compareTargetCheckpoint.id,
            label: compareTargetCheckpoint.label,
            timestamp: compareTargetCheckpoint.timestamp,
          }}
          contentA={compareContent.contentA.markdown || ''}
          contentB={compareContent.contentB.markdown || ''}
          onClose={handleCloseCompare}
          onRestoreA={() => handleRestoreFromCompare(compareSourceCheckpoint.id)}
          onRestoreB={() => handleRestoreFromCompare(compareTargetCheckpoint.id)}
        />
      )}
    <div className="w-72 border-l bg-muted/10 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History size={16} className="text-muted-foreground" />
          <span className="font-medium text-sm">Version History</span>
        </div>
        <button
          onClick={closePanel}
          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
        >
          <X size={16} />
        </button>
      </div>

      {/* Compare mode banner */}
      {isCompareMode && (
        <div className="p-2 bg-blue-500/10 border-b border-blue-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-600 font-medium flex items-center gap-2">
              {isLoadingCompare ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Loading comparison...
                </>
              ) : (
                'Select version to compare'
              )}
            </span>
            <button
              onClick={cancelCompare}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-sm text-destructive">
            {error}
          </div>
        ) : checkpoints.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No version history yet.
            <br />
            <span className="text-xs">
              Versions are created automatically as you write.
            </span>
          </div>
        ) : (
          <>
            {/* Bookmarks section */}
            {bookmarks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Bookmark size={12} className="text-yellow-500" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Bookmarks
                  </span>
                </div>
                <div className="space-y-2">
                  {bookmarks.map(checkpoint => (
                    <CheckpointItem
                      key={checkpoint.id}
                      checkpoint={checkpoint}
                      isSelected={selectedCheckpointId === checkpoint.id}
                      isCompareMode={isCompareMode}
                      isCompareSource={compareCheckpointId === checkpoint.id}
                      onSelect={() => selectCheckpoint(checkpoint.id)}
                      onRestore={() => handleRestore(checkpoint.id)}
                      onCompare={() => handleCompare(checkpoint.id)}
                      onLabel={(label) => handleLabel(checkpoint.id, label)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Auto-saves section */}
            {autoSaves.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <History size={12} className="text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Auto-saves
                  </span>
                </div>
                <div className="space-y-2">
                  {autoSaves.map(checkpoint => (
                    <CheckpointItem
                      key={checkpoint.id}
                      checkpoint={checkpoint}
                      isSelected={selectedCheckpointId === checkpoint.id}
                      isCompareMode={isCompareMode}
                      isCompareSource={compareCheckpointId === checkpoint.id}
                      onSelect={() => selectCheckpoint(checkpoint.id)}
                      onRestore={() => handleRestore(checkpoint.id)}
                      onCompare={() => handleCompare(checkpoint.id)}
                      onLabel={(label) => handleLabel(checkpoint.id, label)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {!isLoading && checkpoints.length > 0 && (
        <div className="p-3 border-t text-center text-xs text-muted-foreground">
          {checkpoints.length} version{checkpoints.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
    </>
  );
}
