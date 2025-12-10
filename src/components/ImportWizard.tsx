import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import {
  FolderOpen,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Link2,
  Quote,
  FileCode,
  ChevronRight,
  LucideIcon,
  Table2,
  Hash,
} from 'lucide-react';
import appIcon from '../../build/icon.png';

type WizardStep = 'select' | 'analyze' | 'options' | 'importing' | 'complete';

interface ImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceType: 'obsidian' | 'notion';
  destinationPath: string | null;
  onComplete: () => void;
  /** Skip the options step and use defaults */
  quickImport?: boolean;
  /** Pre-selected source path (from drag-drop) */
  initialSourcePath?: string | null;
}

// Extended analysis type for Notion
interface NotionAnalysisExtended extends ImportAnalysis {
  csvDatabases?: number;
  filesWithUUIDs?: number;
}

// Extended options type for Notion
interface NotionOptionsExtended extends ImportOptions {
  removeUUIDs: boolean;
  convertCSVToTables: boolean;
  untitledHandling: 'number' | 'keep' | 'prompt';
}

export function ImportWizard({
  open,
  onOpenChange,
  sourceType,
  destinationPath,
  onComplete,
  quickImport = false,
  initialSourcePath = null,
}: ImportWizardProps) {
  const [step, setStep] = useState<WizardStep>('select');
  const [sourcePath, setSourcePath] = useState<string | null>(initialSourcePath);
  const [analysis, setAnalysis] = useState<NotionAnalysisExtended | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStartingImport, setIsStartingImport] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Import options (includes Notion-specific options)
  const [options, setOptions] = useState<NotionOptionsExtended>({
    convertWikiLinks: true,
    importFrontMatter: true,
    convertCallouts: true,
    copyAttachments: true,
    preserveFolderStructure: true,
    skipEmptyPages: true,
    createMidlightFiles: true,
    // Notion-specific
    removeUUIDs: true,
    convertCSVToTables: true,
    untitledHandling: 'number',
  });

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep('select');
      setSourcePath(null);
      setAnalysis(null);
      setIsAnalyzing(false);
      setProgress(null);
      setResult(null);
      setError(null);
      setIsStartingImport(false);
      setIsCancelling(false);
    }
  }, [open]);

  // Auto-start analysis when initialSourcePath is provided
  useEffect(() => {
    if (open && initialSourcePath && !sourcePath && !isAnalyzing) {
      handleAnalyzeFolder(initialSourcePath);
    }
  }, [open, initialSourcePath]);

  // Listen for import progress
  useEffect(() => {
    const unsubscribe = window.electronAPI.onImportProgress((prog) => {
      setProgress(prog);
      if (prog.phase === 'complete') {
        // Progress complete, result should come from the import call
      }
    });
    return unsubscribe;
  }, []);

  // Shared function to analyze a folder (used by both manual select and auto-start)
  const handleAnalyzeFolder = async (path: string) => {
    setSourcePath(path);
    setIsAnalyzing(true);
    setError(null);

    try {
      // Detect source type
      const detectResult = await window.electronAPI.importDetectSourceType(path);
      if (!detectResult.success) {
        throw new Error(detectResult.error || 'Failed to detect source type');
      }

      // Validate source type matches expected
      if (sourceType === 'obsidian' && detectResult.sourceType !== 'obsidian') {
        throw new Error('This folder does not appear to be an Obsidian vault. Looking for .obsidian folder.');
      }
      if (sourceType === 'notion' && detectResult.sourceType !== 'notion') {
        throw new Error('This folder does not appear to be a Notion export. Looking for files with UUID suffixes.');
      }

      // Analyze the source based on type
      if (sourceType === 'obsidian') {
        const analyzeResult = await window.electronAPI.importAnalyzeObsidian(path);
        if (!analyzeResult.success || !analyzeResult.analysis) {
          throw new Error(analyzeResult.error || 'Failed to analyze folder');
        }
        setAnalysis(analyzeResult.analysis);
      } else {
        const analyzeResult = await window.electronAPI.importAnalyzeNotion(path);
        if (!analyzeResult.success || !analyzeResult.analysis) {
          throw new Error(analyzeResult.error || 'Failed to analyze folder');
        }
        setAnalysis(analyzeResult.analysis);
      }

      setStep('analyze');
    } catch (err) {
      setError(String(err));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectFolder = async () => {
    const path = await window.electronAPI.importSelectFolder();
    if (path) {
      await handleAnalyzeFolder(path);
    }
  };

  const handleStartImport = async () => {
    if (!analysis || !destinationPath || isStartingImport) return;

    setIsStartingImport(true);
    setError(null);

    // Small delay to ensure UI updates before potentially blocking IPC call
    await new Promise(resolve => setTimeout(resolve, 50));

    setStep('importing');

    try {
      let importResult;

      if (sourceType === 'obsidian') {
        importResult = await window.electronAPI.importObsidian(
          JSON.stringify(analysis),
          destinationPath,
          JSON.stringify(options)
        );
      } else {
        importResult = await window.electronAPI.importNotion(
          JSON.stringify(analysis),
          destinationPath,
          JSON.stringify(options)
        );
      }

      if (!importResult.success || !importResult.result) {
        throw new Error(importResult.error || 'Import failed');
      }

      setResult(importResult.result);
      setStep('complete');
    } catch (err) {
      setError(String(err));
      setStep('complete');
    } finally {
      setIsStartingImport(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    if (result && result.filesImported > 0) {
      onComplete();
    }
  };

  const handleCancelImport = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      await window.electronAPI.importCancel();
    } catch (err) {
      console.error('Failed to cancel import:', err);
    }
    // Don't reset isCancelling - the import will complete (with cancellation message)
    // and move to the complete step
  };

  const sourceLabel = sourceType === 'obsidian' ? 'Obsidian Vault' : 'Notion Export';

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
        // Prevent closing while import is in progress
        if (!newOpen && (isStartingImport || step === 'importing')) {
          return;
        }
        onOpenChange(newOpen);
      }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src={appIcon} alt="Midlight" className="w-6 h-6 rounded" />
            Import from {sourceLabel}
          </DialogTitle>
          <DialogDescription>
            {step === 'select' && `Select your ${sourceLabel} folder to begin import.`}
            {step === 'analyze' && 'Review what will be imported.'}
            {step === 'options' && 'Configure import options.'}
            {step === 'importing' && 'Importing files...'}
            {step === 'complete' && 'Import complete!'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Select Folder */}
        {step === 'select' && (
          <div className="py-4">
            {sourcePath ? (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FolderOpen size={20} className="text-primary" />
                <span className="truncate flex-1 text-sm">{sourcePath}</span>
                {isAnalyzing && <Loader2 size={16} className="animate-spin" />}
              </div>
            ) : (
              <Button
                onClick={handleSelectFolder}
                variant="outline"
                className="w-full h-24 flex flex-col gap-2"
                disabled={isAnalyzing}
              >
                <FolderOpen size={24} />
                <span>Select {sourceLabel} Folder</span>
              </Button>
            )}

            {error && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive flex items-start gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Analysis Results */}
        {step === 'analyze' && analysis && (
          <div className="py-4 space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-muted rounded-lg text-center">
                <div className="text-2xl font-bold text-primary">{analysis.markdownFiles}</div>
                <div className="text-xs text-muted-foreground">Markdown Files</div>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <div className="text-2xl font-bold text-primary">{analysis.attachments}</div>
                <div className="text-xs text-muted-foreground">Attachments</div>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <div className="text-2xl font-bold text-primary">{analysis.folders}</div>
                <div className="text-xs text-muted-foreground">Folders</div>
              </div>
            </div>

            {/* Detected Features */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Detected Features</h4>
              <div className="space-y-1">
                {/* Obsidian-specific features */}
                {sourceType === 'obsidian' && analysis.wikiLinks > 0 && (
                  <FeatureItem icon={Link2} count={analysis.wikiLinks} label="wiki-links" subLabel={`in ${analysis.filesWithWikiLinks} files`} />
                )}
                {analysis.frontMatter > 0 && (
                  <FeatureItem icon={FileCode} count={analysis.frontMatter} label="files with front-matter" />
                )}
                {analysis.callouts > 0 && (
                  <FeatureItem icon={Quote} count={analysis.callouts} label="files with callouts" />
                )}
                {sourceType === 'obsidian' && analysis.dataviewBlocks > 0 && (
                  <FeatureItem icon={AlertTriangle} count={analysis.dataviewBlocks} label="Dataview blocks" subLabel="(will be removed)" warning />
                )}
                {/* Notion-specific features */}
                {sourceType === 'notion' && analysis.filesWithUUIDs !== undefined && analysis.filesWithUUIDs > 0 && (
                  <FeatureItem icon={Hash} count={analysis.filesWithUUIDs} label="files with UUID suffixes" subLabel="(will be cleaned)" />
                )}
                {sourceType === 'notion' && analysis.csvDatabases !== undefined && analysis.csvDatabases > 0 && (
                  <FeatureItem icon={Table2} count={analysis.csvDatabases} label="CSV databases" subLabel="(will convert to tables)" />
                )}
              </div>
            </div>

            {/* Issues */}
            {(analysis.emptyPages.length > 0 || analysis.untitledPages.length > 0) && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Issues Found</h4>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {analysis.emptyPages.length > 0 && (
                    <div>{analysis.emptyPages.length} empty pages (will be skipped)</div>
                  )}
                  {analysis.untitledPages.length > 0 && (
                    <div>{analysis.untitledPages.length} "Untitled" pages</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Import Options */}
        {step === 'options' && (
          <div className="py-4 space-y-3">
            {/* Obsidian-specific options */}
            {sourceType === 'obsidian' && (
              <>
                <OptionCheckbox
                  checked={options.convertWikiLinks}
                  onChange={(checked) => setOptions({ ...options, convertWikiLinks: checked })}
                  label="Convert wiki-links to standard markdown links"
                />
                <OptionCheckbox
                  checked={options.convertCallouts}
                  onChange={(checked) => setOptions({ ...options, convertCallouts: checked })}
                  label="Convert callouts to styled blockquotes"
                />
              </>
            )}

            {/* Notion-specific options */}
            {sourceType === 'notion' && (
              <>
                <OptionCheckbox
                  checked={options.removeUUIDs}
                  onChange={(checked) => setOptions({ ...options, removeUUIDs: checked })}
                  label="Remove UUID suffixes from filenames"
                />
                <OptionCheckbox
                  checked={options.convertCSVToTables}
                  onChange={(checked) => setOptions({ ...options, convertCSVToTables: checked })}
                  label="Convert CSV databases to Markdown tables"
                />
              </>
            )}

            {/* Common options */}
            <OptionCheckbox
              checked={options.importFrontMatter}
              onChange={(checked) => setOptions({ ...options, importFrontMatter: checked })}
              label="Import front-matter as document metadata"
            />
            <OptionCheckbox
              checked={options.copyAttachments}
              onChange={(checked) => setOptions({ ...options, copyAttachments: checked })}
              label="Copy attachments (images, PDFs)"
            />
            <OptionCheckbox
              checked={options.preserveFolderStructure}
              onChange={(checked) => setOptions({ ...options, preserveFolderStructure: checked })}
              label="Preserve folder structure"
            />
            <OptionCheckbox
              checked={options.skipEmptyPages}
              onChange={(checked) => setOptions({ ...options, skipEmptyPages: checked })}
              label="Skip empty pages"
            />
            <OptionCheckbox
              checked={options.createMidlightFiles}
              onChange={(checked) => setOptions({ ...options, createMidlightFiles: checked })}
              label="Create Midlight metadata files"
            />
          </div>
        )}

        {/* Step 4: Importing */}
        {step === 'importing' && (
          <div className="py-8 space-y-4">
            <div className="flex flex-col items-center gap-4">
              <Loader2 size={48} className="animate-spin text-primary" />
              <div className="text-center">
                <div className="font-medium">
                  {isCancelling && 'Cancelling...'}
                  {!isCancelling && progress?.phase === 'converting' && 'Converting files...'}
                  {!isCancelling && progress?.phase === 'copying' && 'Copying attachments...'}
                  {!isCancelling && progress?.phase === 'finalizing' && 'Finalizing...'}
                  {!isCancelling && !progress && 'Starting import...'}
                </div>
                {progress && !isCancelling && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {progress.current} / {progress.total}
                  </div>
                )}
              </div>
            </div>

            {progress && progress.currentFile && !isCancelling && (
              <div className="text-xs text-muted-foreground text-center truncate px-4">
                {progress.currentFile}
              </div>
            )}

            {/* Progress bar */}
            {progress && (
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            )}

            {/* Cancel button */}
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={handleCancelImport}
                disabled={isCancelling}
                size="sm"
              >
                {isCancelling ? (
                  <>
                    <Loader2 size={14} className="mr-2 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Cancel Import'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Complete */}
        {step === 'complete' && (
          <div className="py-4 space-y-4">
            {result && result.success ? (
              <>
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle size={24} />
                  <span className="font-medium">Import Successful</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">{result.filesImported}</div>
                    <div className="text-xs text-muted-foreground">Files Imported</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <div className="text-2xl font-bold text-primary">{result.linksConverted}</div>
                    <div className="text-xs text-muted-foreground">Links Converted</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <div className="text-2xl font-bold text-primary">{result.attachmentsCopied}</div>
                    <div className="text-xs text-muted-foreground">Attachments</div>
                  </div>
                </div>

                {/* Warnings */}
                {result.warnings.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-1">
                      <AlertTriangle size={14} className="text-amber-500" />
                      Warnings ({result.warnings.length})
                    </h4>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {result.warnings.slice(0, 10).map((warning, i) => (
                        <div key={i} className="text-xs text-muted-foreground p-2 bg-muted rounded">
                          <span className="font-medium">{warning.file}:</span> {warning.message}
                        </div>
                      ))}
                      {result.warnings.length > 10 && (
                        <div className="text-xs text-muted-foreground">
                          ... and {result.warnings.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-destructive">
                <XCircle size={24} />
                <span className="font-medium">Import Failed</span>
                {error && <p className="text-sm text-muted-foreground">{error}</p>}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'select' && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}

          {step === 'analyze' && (
            <>
              <Button variant="outline" onClick={() => setStep('select')} disabled={isStartingImport}>
                Back
              </Button>
              {quickImport ? (
                <Button onClick={handleStartImport} disabled={isStartingImport}>
                  {isStartingImport ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      Start Import
                      <ChevronRight size={16} className="ml-1" />
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={() => setStep('options')}>
                  Configure Options
                  <ChevronRight size={16} className="ml-1" />
                </Button>
              )}
            </>
          )}

          {step === 'options' && (
            <>
              <Button variant="outline" onClick={() => setStep('analyze')} disabled={isStartingImport}>
                Back
              </Button>
              <Button onClick={handleStartImport} disabled={isStartingImport}>
                {isStartingImport ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    Start Import
                    <ChevronRight size={16} className="ml-1" />
                  </>
                )}
              </Button>
            </>
          )}

          {step === 'complete' && (
            <Button onClick={handleClose}>
              {result && result.filesImported > 0 ? 'Done' : 'Close'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper components
function FeatureItem({
  icon: Icon,
  count,
  label,
  subLabel,
  warning,
}: {
  icon: LucideIcon;
  count: number;
  label: string;
  subLabel?: string;
  warning?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 text-sm ${warning ? 'text-amber-600' : 'text-muted-foreground'}`}>
      <Icon size={14} />
      <span>
        {count} {label}
        {subLabel && <span className="text-xs ml-1">{subLabel}</span>}
      </span>
    </div>
  );
}

function OptionCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-border"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}
