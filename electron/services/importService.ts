import fs from 'node:fs/promises';
import { Stats } from 'node:fs';
import path from 'node:path';
import pLimit from 'p-limit';

// Import security utilities
import {
  IMPORT_CONFIG,
  sanitizeFilename,
  sanitizeRelativePath as secureSanitizeRelativePath,
  isPathSafe as secureIsPathSafe,
  validatePath as secureValidatePath,
  sanitizeCSVCell,
  formatUserError,
  isExternalUrl,
  isDangerousScheme,
  safeParseFrontMatter,
} from './importSecurity';

// Import transaction for atomic operations
import { ImportTransaction, validateDiskSpace } from './importTransaction';

// Error reporting
import { reportImportError } from './errorReportingService';

// Re-export security functions for backward compatibility
export { IMPORT_CONFIG } from './importSecurity';
export { ImportTransaction, validateDiskSpace } from './importTransaction';

// Types for import analysis and operations
export type ImportSourceType = 'obsidian' | 'notion' | 'generic';

export interface ImportAnalysis {
  sourceType: ImportSourceType;
  sourcePath: string;
  totalFiles: number;
  markdownFiles: number;
  attachments: number;
  folders: number;

  // Detected features (for Obsidian)
  wikiLinks: number;
  filesWithWikiLinks: number;
  frontMatter: number;
  callouts: number;
  dataviewBlocks: number;

  // Issues
  untitledPages: string[];
  emptyPages: string[];

  // File list for import
  filesToImport: ImportFileInfo[];

  // Access warnings (files/folders that couldn't be read)
  accessWarnings?: Array<{ path: string; message: string }>;
}

export interface ImportFileInfo {
  sourcePath: string;
  relativePath: string;
  name: string;
  type: 'markdown' | 'attachment' | 'other';
  size: number;
  hasWikiLinks: boolean;
  hasFrontMatter: boolean;
  hasCallouts: boolean;
  hasDataview: boolean;
}

export interface ImportOptions {
  convertWikiLinks: boolean;
  importFrontMatter: boolean;
  convertCallouts: boolean;
  copyAttachments: boolean;
  preserveFolderStructure: boolean;
  skipEmptyPages: boolean;
  createMidlightFiles: boolean;
  /** AbortSignal for cancellation support */
  signal?: AbortSignal;
}

export interface ImportProgress {
  phase: 'analyzing' | 'converting' | 'copying' | 'finalizing' | 'complete';
  current: number;
  total: number;
  currentFile: string;
  errors: ImportError[];
  warnings: ImportWarning[];
}

export interface ImportError {
  file: string;
  message: string;
}

export interface ImportWarning {
  file: string;
  message: string;
  type: 'broken_link' | 'dataview_removed' | 'unsupported_feature' | 'file_too_large';
}

export interface ImportResult {
  success: boolean;
  filesImported: number;
  linksConverted: number;
  attachmentsCopied: number;
  errors: ImportError[];
  warnings: ImportWarning[];
}

// Regular expressions for parsing
// Note: These patterns are designed to be resistant to ReDoS attacks
const WIKI_LINK_REGEX = /(!?)\[\[([^\]|#^]+)(?:#([^\]|^]+))?(?:\^([^\]|]+))?(?:\|([^\]]+))?\]\]/g;
const FRONT_MATTER_REGEX = /^---\n([\s\S]*?)\n---\n?/;
// FIXED ReDoS: Added {0,500} limit to prevent catastrophic backtracking
const CALLOUT_REGEX = /^>\s*\[!(\w+)\]([+-])?(?:\s+([^\n]*))?\n((?:>[^\n]*\n?){0,500})/gm;
// FIXED ReDoS: Limit dataview block size to prevent catastrophic backtracking
const DATAVIEW_REGEX = new RegExp(`\`\`\`dataview\\n[^\`]{0,${IMPORT_CONFIG.MAX_DATAVIEW_BLOCK_SIZE}}?\`\`\``, 'g');
const DATAVIEW_INLINE_REGEX = new RegExp(`\`=[^\`]{0,${IMPORT_CONFIG.MAX_INLINE_DATAVIEW_SIZE}}?\``, 'g');

// Use centralized config for max content size
const MAX_CONTENT_SIZE = IMPORT_CONFIG.MAX_CONTENT_SIZE;

// Image extensions for attachment detection
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico']);
const ATTACHMENT_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, '.pdf', '.mp3', '.mp4', '.wav', '.mov']);

/**
 * Sanitize a relative path to prevent path traversal attacks
 * Removes '..' segments, normalizes slashes, and ensures the path stays relative
 * @deprecated Use secureSanitizeRelativePath from importSecurity.ts for enhanced protection
 */
export function sanitizeRelativePath(relativePath: string): string {
  // Delegate to the enhanced secure version
  return secureSanitizeRelativePath(relativePath);
}

/**
 * Validate that a destination path is safely within the target directory
 * @deprecated Use secureIsPathSafe from importSecurity.ts for enhanced protection
 */
export function isPathSafe(destPath: string, basePath: string): boolean {
  // Delegate to the enhanced secure version
  return secureIsPathSafe(destPath, basePath);
}

/**
 * Validate and sanitize a user-provided path
 * @deprecated Use secureValidatePath from importSecurity.ts for enhanced protection
 */
export function validatePath(inputPath: string): { valid: boolean; error?: string } {
  // Delegate to the enhanced secure version
  return secureValidatePath(inputPath);
}

/**
 * Detect the type of import source (Obsidian vault, Notion export, or generic folder)
 */
export async function detectSourceType(folderPath: string): Promise<ImportSourceType> {
  try {
    const contents = await fs.readdir(folderPath);

    // Check for Obsidian vault (.obsidian folder)
    if (contents.includes('.obsidian')) {
      return 'obsidian';
    }

    // Check for Notion export (UUID patterns in filenames)
    const hasUUIDs = contents.some(name =>
      /\s[a-f0-9]{32}\.(md|csv)$/i.test(name)
    );
    if (hasUUIDs) {
      return 'notion';
    }

    return 'generic';
  } catch (error) {
    console.error('Failed to detect source type:', error);
    return 'generic';
  }
}

/**
 * Result from getAllFiles including any access errors encountered
 */
interface GetAllFilesResult {
  files: { path: string; relativePath: string; stat: Stats }[];
  accessErrors: { path: string; message: string }[];
}

/**
 * Recursively get all files in a directory.
 * Handles errors gracefully and collects them for reporting to user.
 */
async function getAllFiles(
  dirPath: string,
  basePath: string,
  skipFolders: Set<string> = new Set(['.obsidian', '.git', '.trash', 'node_modules']),
  accessErrors: { path: string; message: string }[] = []
): Promise<GetAllFilesResult> {
  const files: { path: string; relativePath: string; stat: Stats }[] = [];

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    const { message } = formatUserError(error);
    accessErrors.push({
      path: path.relative(basePath, dirPath) || dirPath,
      message: `Cannot access directory: ${message}`
    });
    return { files, accessErrors };
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    try {
      if (entry.isDirectory()) {
        if (!skipFolders.has(entry.name) && !entry.name.startsWith('.')) {
          const subResult = await getAllFiles(fullPath, basePath, skipFolders, accessErrors);
          files.push(...subResult.files);
        }
      } else {
        const stat = await fs.stat(fullPath);
        files.push({ path: fullPath, relativePath, stat });
      }
    } catch (error) {
      // Collect error but continue - don't fail for one bad file
      const { message } = formatUserError(error);
      accessErrors.push({
        path: relativePath,
        message: `Cannot access file: ${message}`
      });
    }
  }

  return { files, accessErrors };
}

/**
 * Analyze markdown content for Obsidian-specific features
 */
function analyzeMarkdownContent(content: string): {
  wikiLinkCount: number;
  hasFrontMatter: boolean;
  hasCallouts: boolean;
  hasDataview: boolean;
  isEmpty: boolean;
} {
  // Skip regex processing for very large content to prevent DoS
  if (content.length > MAX_CONTENT_SIZE) {
    console.warn('Content too large for detailed analysis, skipping regex processing');
    return {
      wikiLinkCount: 0,
      hasFrontMatter: false,
      hasCallouts: false,
      hasDataview: false,
      isEmpty: content.trim().length === 0,
    };
  }

  const wikiLinks = content.match(WIKI_LINK_REGEX) || [];
  const hasFrontMatter = FRONT_MATTER_REGEX.test(content);
  const hasCallouts = CALLOUT_REGEX.test(content);
  const hasDataview = DATAVIEW_REGEX.test(content) || DATAVIEW_INLINE_REGEX.test(content);

  // Check if file is empty (just whitespace or front-matter only)
  const contentWithoutFrontMatter = content.replace(FRONT_MATTER_REGEX, '').trim();
  const isEmpty = contentWithoutFrontMatter.length === 0;

  // Reset regex lastIndex
  CALLOUT_REGEX.lastIndex = 0;

  return {
    wikiLinkCount: wikiLinks.length,
    hasFrontMatter,
    hasCallouts,
    hasDataview,
    isEmpty,
  };
}

/**
 * Analyze an Obsidian vault for import
 */
export async function analyzeObsidianVault(vaultPath: string): Promise<ImportAnalysis> {
  const analysis: ImportAnalysis = {
    sourceType: 'obsidian',
    sourcePath: vaultPath,
    totalFiles: 0,
    markdownFiles: 0,
    attachments: 0,
    folders: 0,
    wikiLinks: 0,
    filesWithWikiLinks: 0,
    frontMatter: 0,
    callouts: 0,
    dataviewBlocks: 0,
    untitledPages: [],
    emptyPages: [],
    filesToImport: [],
    accessWarnings: [],
  };

  try {
    const { files: allFiles, accessErrors } = await getAllFiles(vaultPath, vaultPath);
    analysis.totalFiles = allFiles.length;

    // Add any access errors as warnings
    if (accessErrors.length > 0) {
      analysis.accessWarnings = accessErrors;
    }

    // Count folders
    const folderSet = new Set<string>();
    allFiles.forEach(f => {
      const dir = path.dirname(f.relativePath);
      if (dir !== '.') folderSet.add(dir);
    });
    analysis.folders = folderSet.size;

    for (const file of allFiles) {
      const ext = path.extname(file.path).toLowerCase();
      const fileName = path.basename(file.path);

      if (ext === '.md') {
        analysis.markdownFiles++;

        // Read and analyze content
        const content = await fs.readFile(file.path, 'utf-8');
        const contentAnalysis = analyzeMarkdownContent(content);

        // Update counts
        if (contentAnalysis.wikiLinkCount > 0) {
          analysis.wikiLinks += contentAnalysis.wikiLinkCount;
          analysis.filesWithWikiLinks++;
        }
        if (contentAnalysis.hasFrontMatter) analysis.frontMatter++;
        if (contentAnalysis.hasCallouts) analysis.callouts++;
        if (contentAnalysis.hasDataview) analysis.dataviewBlocks++;

        // Check for issues
        if (fileName.toLowerCase().startsWith('untitled')) {
          analysis.untitledPages.push(file.relativePath);
        }
        if (contentAnalysis.isEmpty) {
          analysis.emptyPages.push(file.relativePath);
        }

        analysis.filesToImport.push({
          sourcePath: file.path,
          relativePath: file.relativePath,
          name: fileName,
          type: 'markdown',
          size: file.stat.size,
          hasWikiLinks: contentAnalysis.wikiLinkCount > 0,
          hasFrontMatter: contentAnalysis.hasFrontMatter,
          hasCallouts: contentAnalysis.hasCallouts,
          hasDataview: contentAnalysis.hasDataview,
        });
      } else if (ATTACHMENT_EXTENSIONS.has(ext)) {
        analysis.attachments++;
        analysis.filesToImport.push({
          sourcePath: file.path,
          relativePath: file.relativePath,
          name: fileName,
          type: 'attachment',
          size: file.stat.size,
          hasWikiLinks: false,
          hasFrontMatter: false,
          hasCallouts: false,
          hasDataview: false,
        });
      } else {
        analysis.filesToImport.push({
          sourcePath: file.path,
          relativePath: file.relativePath,
          name: fileName,
          type: 'other',
          size: file.stat.size,
          hasWikiLinks: false,
          hasFrontMatter: false,
          hasCallouts: false,
          hasDataview: false,
        });
      }
    }
  } catch (error) {
    console.error('Failed to analyze Obsidian vault:', error);
    throw error;
  }

  return analysis;
}

/**
 * Convert wiki-links to standard markdown links.
 * Uses FileMapIndex for O(1) case-insensitive lookups instead of O(n) iteration.
 */
export function convertWikiLinks(
  content: string,
  fileMap: FileMapIndex // maps original names to new relative paths with case-insensitive support
): { content: string; convertedCount: number; brokenLinks: string[] } {
  // Skip processing for very large content
  if (content.length > MAX_CONTENT_SIZE) {
    console.warn('Content too large for wiki-link conversion');
    return { content, convertedCount: 0, brokenLinks: [] };
  }

  let convertedCount = 0;
  const brokenLinks: string[] = [];

  const converted = content.replace(WIKI_LINK_REGEX, (_match, embed, target, heading, _blockRef, alias) => {
    convertedCount++;

    const displayText = alias || target;
    const isEmbed = embed === '!';

    // Check if target is an image
    const ext = path.extname(target).toLowerCase();
    const isImage = IMAGE_EXTENSIONS.has(ext) || (ext === '' && isEmbed);

    // Try to find the target in the file map - O(1) lookups
    // First try exact match, then case-insensitive
    let targetPath: string | undefined =
      fileMap.exact.get(target) ||
      fileMap.exact.get(target + '.md') ||
      fileMap.lowercase.get(target.toLowerCase()) ||
      fileMap.lowercase.get((target + '.md').toLowerCase());

    // If no targetPath found, create a fallback path
    const resolvedPath: string = targetPath || (target.includes('.') ? target : target + '.md');

    if (!targetPath) {
      brokenLinks.push(target);
    }

    // URL encode the path
    const encodedPath = encodeURI(resolvedPath);

    // Add heading anchor if present
    let href = encodedPath;
    if (heading) {
      const anchor = heading.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      href += '#' + anchor;
    }

    // Generate the appropriate link format
    if (isEmbed && isImage) {
      return `![${displayText}](${href})`;
    } else if (isEmbed) {
      // Note embed - convert to regular link since we can't embed notes
      return `[📄 ${displayText}](${href})`;
    } else {
      return `[${displayText}](${href})`;
    }
  });

  return { content: converted, convertedCount, brokenLinks };
}

/**
 * Convert Obsidian callouts to styled blockquotes
 */
export function convertCallouts(content: string): { content: string; convertedCount: number } {
  // Skip processing for very large content
  if (content.length > MAX_CONTENT_SIZE) {
    console.warn('Content too large for callout conversion');
    return { content, convertedCount: 0 };
  }

  let convertedCount = 0;

  // Reset regex lastIndex
  CALLOUT_REGEX.lastIndex = 0;

  const converted = content.replace(CALLOUT_REGEX, (_match, type, _foldable, title, body) => {
    convertedCount++;

    // Clean up the body - remove leading '>' from each line
    const cleanBody = body
      .split('\n')
      .map((line: string) => line.replace(/^>\s?/, ''))
      .join('\n')
      .trim();

    // Format as a styled blockquote
    const typeLabel = type.toUpperCase();
    const titlePart = title ? `**${title}**\n>\n` : '';

    // Reconstruct as blockquote with type indicator
    const bodyLines = cleanBody.split('\n').map((line: string) => `> ${line}`).join('\n');

    return `> **${typeLabel}**\n> ${titlePart}${bodyLines}\n`;
  });

  return { content: converted, convertedCount };
}

/**
 * Remove dataview blocks from content
 */
export function removeDataview(content: string): { content: string; removedCount: number } {
  // Skip processing for very large content
  if (content.length > MAX_CONTENT_SIZE) {
    console.warn('Content too large for dataview removal');
    return { content, removedCount: 0 };
  }

  let removedCount = 0;

  // Remove dataview code blocks
  let converted = content.replace(DATAVIEW_REGEX, () => {
    removedCount++;
    return '<!-- Dataview query removed -->';
  });

  // Remove inline dataview
  converted = converted.replace(DATAVIEW_INLINE_REGEX, () => {
    removedCount++;
    return '';
  });

  return { content: converted, removedCount };
}

/**
 * Parse front-matter from markdown content.
 *
 * Uses safe YAML parsing with protection against:
 * - YAML bombs (billion laughs attack)
 * - Deep nesting attacks
 * - Excessive alias expansion
 * - Oversized documents
 *
 * @param content - Full markdown content with potential front-matter
 * @returns Object with parsed frontMatter and remaining content
 */
export function parseFrontMatter(content: string): {
  frontMatter: Record<string, unknown> | null;
  content: string;
} {
  // Skip processing for very large content
  if (content.length > MAX_CONTENT_SIZE) {
    console.warn('Content too large for front-matter parsing');
    return { frontMatter: null, content };
  }

  // Use the safe parser from importSecurity
  const result = safeParseFrontMatter(content);

  if (result.error) {
    console.warn('Front-matter parsing warning:', result.error);
  }

  return {
    frontMatter: result.frontMatter,
    content: result.content,
  };
}

/**
 * File map with both exact and case-insensitive lookups.
 * The exact map provides O(1) lookup for case-sensitive matches.
 * The lowercase map provides O(1) lookup for case-insensitive matches.
 */
export interface FileMapIndex {
  exact: Map<string, string>;
  lowercase: Map<string, string>;
}

/**
 * Build a file map for wiki-link resolution with case-insensitive support.
 * Returns both exact and lowercase maps for O(1) lookups in both modes.
 */
export function buildFileMap(files: ImportFileInfo[]): FileMapIndex {
  const exact = new Map<string, string>();
  const lowercase = new Map<string, string>();

  for (const file of files) {
    if (file.type === 'markdown' || file.type === 'attachment') {
      // Map by filename without extension
      const nameWithoutExt = file.name.replace(/\.[^.]+$/, '');
      exact.set(nameWithoutExt, file.relativePath);
      lowercase.set(nameWithoutExt.toLowerCase(), file.relativePath);

      // Also map by full filename
      exact.set(file.name, file.relativePath);
      lowercase.set(file.name.toLowerCase(), file.relativePath);

      // Map by relative path without extension
      const relativeWithoutExt = file.relativePath.replace(/\.[^.]+$/, '');
      exact.set(relativeWithoutExt, file.relativePath);
      lowercase.set(relativeWithoutExt.toLowerCase(), file.relativePath);
    }
  }

  return { exact, lowercase };
}

/**
 * Import files from an Obsidian vault
 *
 * Features:
 * - Atomic operations with rollback on failure
 * - Cancellation support via AbortSignal
 * - Parallel file processing for better performance
 * - Enhanced error handling with user-friendly messages
 */
export async function importObsidianVault(
  analysis: ImportAnalysis,
  destPath: string,
  options: ImportOptions,
  onProgress: (progress: ImportProgress) => void
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    filesImported: 0,
    linksConverted: 0,
    attachmentsCopied: 0,
    errors: [],
    warnings: [],
  };

  const markdownFiles = analysis.filesToImport.filter(f => f.type === 'markdown');
  const attachmentFiles = analysis.filesToImport.filter(f => f.type === 'attachment');

  // Build file map for wiki-link resolution
  const fileMap = buildFileMap(analysis.filesToImport);

  const totalSteps = markdownFiles.length + (options.copyAttachments ? attachmentFiles.length : 0);
  let currentStep = 0;

  // Throttled progress reporting to reduce IPC overhead
  let lastProgressTime = 0;

  const reportProgress = (phase: ImportProgress['phase'], currentFile: string, force = false) => {
    const now = Date.now();
    if (force || now - lastProgressTime >= IMPORT_CONFIG.PROGRESS_THROTTLE_MS) {
      lastProgressTime = now;
      onProgress({
        phase,
        current: currentStep,
        total: totalSteps,
        currentFile,
        // Clone arrays to prevent mutation issues
        errors: [...result.errors],
        warnings: [...result.warnings],
      });
    }
  };

  // Check for cancellation
  const checkCancelled = () => {
    if (options.signal?.aborted) {
      throw new Error('Import cancelled by user');
    }
  };

  // Pre-flight disk space check
  const totalSize = analysis.filesToImport.reduce((sum, f) => sum + f.size, 0);
  const spaceCheck = await validateDiskSpace(destPath, totalSize);
  if (!spaceCheck.valid) {
    reportImportError('disk_space', spaceCheck.error || 'Insufficient disk space', {
      sourceType: 'obsidian',
      fileCount: analysis.totalFiles,
      phase: 'analyzing',
    });
    result.errors.push({ file: '', message: spaceCheck.error || 'Insufficient disk space' });
    result.success = false;
    return result;
  }

  // Create transaction for atomic operations
  const transaction = new ImportTransaction(destPath);

  try {
    await transaction.initialize();
    checkCancelled();

    // Phase 1: Convert and copy markdown files (Obsidian)
    reportProgress('converting', '', true);

    // Process markdown files with concurrency limit
    const limit = pLimit(IMPORT_CONFIG.PARALLEL_BATCH_SIZE);
    const mdProcessingErrors: Array<{ file: string; error: unknown }> = [];

    const mdTasks = markdownFiles.map(file => limit(async () => {
      checkCancelled();
      currentStep++;

      // Skip empty pages if option is set
      if (options.skipEmptyPages && analysis.emptyPages.includes(file.relativePath)) {
        return;
      }

      reportProgress('converting', file.relativePath);

      try {
        // Check file size before reading to prevent memory exhaustion
        if (file.size > IMPORT_CONFIG.MAX_CONTENT_SIZE) {
          result.warnings.push({
            file: file.relativePath,
            message: `File too large (${Math.round(file.size / 1024 / 1024)}MB) - copying without conversion`,
            type: 'file_too_large',
          });
          // Copy file as-is without processing
          const sanitizedRelPath = sanitizeRelativePath(file.relativePath);
          const safeName = sanitizeFilename(file.name);
          const relativeDestPath = options.preserveFolderStructure ? sanitizedRelPath : safeName;
          await transaction.stageCopy(file.sourcePath, relativeDestPath);
          result.filesImported++;
          return;
        }

        let content = await fs.readFile(file.sourcePath, 'utf-8');
        let metadata: Record<string, unknown> = {};

        // Parse and optionally store front-matter
        if (options.importFrontMatter) {
          const { frontMatter, content: contentWithoutFM } = parseFrontMatter(content);
          if (frontMatter) {
            metadata = { ...metadata, frontMatter };
            content = contentWithoutFM;
          }
        }

        // Convert wiki-links
        if (options.convertWikiLinks && file.hasWikiLinks) {
          const { content: converted, convertedCount, brokenLinks } = convertWikiLinks(content, fileMap);
          content = converted;
          result.linksConverted += convertedCount;

          for (const broken of brokenLinks) {
            result.warnings.push({
              file: file.relativePath,
              message: `Broken link: [[${broken}]]`,
              type: 'broken_link',
            });
          }
        }

        // Convert callouts
        if (options.convertCallouts && file.hasCallouts) {
          const { content: converted } = convertCallouts(content);
          content = converted;
        }

        // Remove dataview blocks
        if (file.hasDataview) {
          const { content: converted, removedCount } = removeDataview(content);
          content = converted;

          if (removedCount > 0) {
            result.warnings.push({
              file: file.relativePath,
              message: `${removedCount} Dataview block(s) removed`,
              type: 'dataview_removed',
            });
          }
        }

        // Determine destination path with sanitization
        const sanitizedRelPath = sanitizeRelativePath(file.relativePath);
        const safeName = sanitizeFilename(file.name);
        const relativeDestPath = options.preserveFolderStructure
          ? sanitizedRelPath
          : safeName;

        // Stage the converted markdown file
        await transaction.stageFile(relativeDestPath, content);

        // Stage .md.midlight file if option is set
        if (options.createMidlightFiles) {
          const midlightContent = JSON.stringify({
            version: 1,
            created: new Date().toISOString(),
            importedFrom: 'obsidian',
            originalPath: file.relativePath,
            metadata,
          }, null, 2);
          await transaction.stageFile(relativeDestPath + '.midlight', midlightContent);
        }

        result.filesImported++;
      } catch (error) {
        mdProcessingErrors.push({ file: file.relativePath, error });
      }
    }));

    await Promise.all(mdTasks);

    // Add any processing errors to result
    for (const { file, error } of mdProcessingErrors) {
      const { message } = formatUserError(error);
      result.errors.push({ file, message });
    }

    checkCancelled();

    // Phase 2: Copy attachments
    if (options.copyAttachments) {
      reportProgress('copying', '', true);

      const attachmentErrors: Array<{ file: string; error: unknown }> = [];

      const attachmentTasks = attachmentFiles.map(file => limit(async () => {
        checkCancelled();
        currentStep++;

        reportProgress('copying', file.relativePath);

        try {
          // Sanitize paths for attachments too
          const sanitizedRelPath = sanitizeRelativePath(file.relativePath);
          const safeName = sanitizeFilename(file.name);
          const relativeDestPath = options.preserveFolderStructure
            ? sanitizedRelPath
            : path.join('attachments', safeName);

          // Stage the attachment copy
          await transaction.stageCopy(file.sourcePath, relativeDestPath);

          // Verify large file copies
          if (file.size > IMPORT_CONFIG.MAX_LARGE_FILE_CHECKSUM) {
            const stagingPath = path.join(transaction.getStagingDir(), relativeDestPath);
            const verified = await transaction.verifyCopy(file.sourcePath, stagingPath);
            if (!verified) {
              throw new Error('File copy verification failed - checksum mismatch');
            }
          }

          result.attachmentsCopied++;
        } catch (error) {
          attachmentErrors.push({ file: file.relativePath, error });
        }
      }));

      await Promise.all(attachmentTasks);

      // Add attachment errors to result
      for (const { file, error } of attachmentErrors) {
        const { message } = formatUserError(error);
        result.errors.push({ file, message });
      }
    }

    checkCancelled();

    // Phase 3: Commit transaction (move files from staging to final location)
    reportProgress('finalizing', 'Committing files...', true);
    await transaction.commit();

    // Phase 4: Complete
    reportProgress('complete', '', true);

    result.success = result.errors.length === 0;
    return result;

  } catch (error) {
    // Rollback on any error
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error('Failed to rollback transaction:', rollbackError);
      reportImportError('rollback', 'Transaction rollback failed', {
        sourceType: 'obsidian',
        fileCount: analysis.totalFiles,
        phase: 'finalizing',
      });
    }

    // Check if it was a cancellation
    if (options.signal?.aborted) {
      reportImportError('cancelled', 'Import cancelled by user', {
        sourceType: 'obsidian',
        fileCount: result.filesImported,
        phase: 'converting',
      });
      result.errors.push({ file: '', message: 'Import cancelled by user' });
    } else {
      const { message } = formatUserError(error);
      reportImportError('unknown', message, {
        sourceType: 'obsidian',
        fileCount: analysis.totalFiles,
        phase: 'converting',
      });
      result.errors.push({ file: '', message });
    }

    result.success = false;
    reportProgress('complete', '', true);
    return result;
  }

  // Report aggregate import errors if any
  if (result.errors.length > 0) {
    reportImportError('file_read', `Import completed with ${result.errors.length} errors`, {
      sourceType: 'obsidian',
      fileCount: result.filesImported,
      errorCount: result.errors.length,
      phase: 'complete',
    });
  }
}

// ============================================
// NOTION IMPORT FUNCTIONALITY
// ============================================

// Notion UUID pattern - 32 hex chars at end of filename before extension
const NOTION_UUID_REGEX = /\s+[a-f0-9]{32}(\.[^.]+)$/i;
const NOTION_UUID_FILENAME_REGEX = /^(.+)\s+[a-f0-9]{32}(\.[^.]+)$/i;

/**
 * Notion-specific analysis extending base ImportAnalysis
 */
export interface NotionAnalysis extends ImportAnalysis {
  csvDatabases: number;
  untitledPages: string[];
  filesWithUUIDs: number;
}

/**
 * Notion-specific import options extending base ImportOptions
 */
export interface NotionImportOptions extends ImportOptions {
  removeUUIDs: boolean;
  convertCSVToTables: boolean;
  untitledHandling: 'number' | 'keep' | 'prompt';
}

/**
 * Strip Notion UUID from filename
 * "Page Name abc123def456.md" → "Page Name.md"
 */
export function stripNotionUUID(filename: string): string {
  const match = filename.match(NOTION_UUID_FILENAME_REGEX);
  if (match) {
    return match[1] + match[2];
  }
  return filename;
}

/**
 * Check if filename has a Notion UUID suffix
 */
export function hasNotionUUID(filename: string): boolean {
  return NOTION_UUID_REGEX.test(filename);
}

/**
 * Build a filename map that handles conflicts when stripping UUIDs
 */
export function buildNotionFilenameMap(files: ImportFileInfo[]): Map<string, string> {
  const oldToNew = new Map<string, string>();
  const usedNames = new Set<string>();

  for (const file of files) {
    let cleanName = stripNotionUUID(file.name);

    // Handle conflicts
    let finalName = cleanName;
    let counter = 1;
    const ext = path.extname(cleanName);
    const base = path.basename(cleanName, ext);

    while (usedNames.has(finalName.toLowerCase())) {
      finalName = `${base} (${counter})${ext}`;
      counter++;
    }

    usedNames.add(finalName.toLowerCase());
    oldToNew.set(file.name, finalName);
  }

  return oldToNew;
}

/**
 * Convert CSV content to Markdown table
 */
export function csvToMarkdownTable(csvContent: string): string {
  const lines = csvContent.trim().split('\n');
  if (lines.length === 0) return '';

  const rows = lines.map(line => parseCSVLine(line));
  if (rows.length === 0) return '';

  const headers = rows[0];
  const dataRows = rows.slice(1);

  // Build header row (sanitize for formula injection)
  let table = '| ' + headers.map(h => sanitizeCSVCell(h)).join(' | ') + ' |\n';

  // Build separator row
  table += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

  // Build data rows
  for (const row of dataRows) {
    // Pad row to match header length
    while (row.length < headers.length) {
      row.push('');
    }
    // Use sanitizeCSVCell for formula injection protection
    table += '| ' + row.map(cell => sanitizeCSVCell(cell)).join(' | ') + ' |\n';
  }

  return table;
}

/**
 * Parse a single CSV line (handles quoted fields)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Rebuild internal links in content after filenames have been changed.
 * Also validates URL schemes to prevent XSS attacks.
 */
export function rebuildNotionLinks(
  content: string,
  filenameMap: Map<string, string>
): { content: string; linksUpdated: number } {
  let linksUpdated = 0;

  // Match markdown links: [text](path)
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;

  const updatedContent = content.replace(linkRegex, (match, text, href) => {
    // Decode the href to get the original filename
    let decoded: string;
    try {
      decoded = decodeURIComponent(href);
    } catch {
      // Invalid URL encoding, keep original
      return match;
    }

    // First check for dangerous schemes (javascript:, data:, vbscript:, file:)
    // This must come before the external URL check
    if (isDangerousScheme(decoded)) {
      // Replace dangerous links with safe placeholder
      return `[${text}](#dangerous-link-removed)`;
    }

    // Check if this is a safe external URL (http:, https:, mailto:)
    if (isExternalUrl(decoded)) {
      return match; // Safe external link, don't modify
    }

    // Extract just the filename from the path
    const filename = path.basename(decoded);

    // Check if we have a mapping for this file
    const newFilename = filenameMap.get(filename);
    if (newFilename) {
      linksUpdated++;
      // Reconstruct the path with the new filename
      const dir = path.dirname(decoded);
      const newPath = dir === '.' ? newFilename : path.join(dir, newFilename);
      return `[${text}](${encodeURI(newPath)})`;
    }

    return match;
  });

  return { content: updatedContent, linksUpdated };
}

/**
 * Analyze a Notion export folder
 */
export async function analyzeNotionExport(exportPath: string): Promise<NotionAnalysis> {
  const analysis: NotionAnalysis = {
    sourceType: 'notion',
    sourcePath: exportPath,
    totalFiles: 0,
    markdownFiles: 0,
    attachments: 0,
    folders: 0,
    wikiLinks: 0,
    filesWithWikiLinks: 0,
    frontMatter: 0,
    callouts: 0,
    dataviewBlocks: 0,
    untitledPages: [],
    emptyPages: [],
    filesToImport: [],
    csvDatabases: 0,
    filesWithUUIDs: 0,
    accessWarnings: [],
  };

  try {
    const { files: allFiles, accessErrors } = await getAllFiles(exportPath, exportPath, new Set(['.git', 'node_modules']));
    analysis.totalFiles = allFiles.length;

    // Add any access errors as warnings
    if (accessErrors.length > 0) {
      analysis.accessWarnings = accessErrors;
    }

    // Count folders
    const folderSet = new Set<string>();
    allFiles.forEach(f => {
      const dir = path.dirname(f.relativePath);
      if (dir !== '.') folderSet.add(dir);
    });
    analysis.folders = folderSet.size;

    for (const file of allFiles) {
      const ext = path.extname(file.path).toLowerCase();
      const fileName = path.basename(file.path);

      // Check for UUID in filename
      if (hasNotionUUID(fileName)) {
        analysis.filesWithUUIDs++;
      }

      // Check for "Untitled" pages
      const cleanName = stripNotionUUID(fileName);
      if (cleanName.toLowerCase().startsWith('untitled')) {
        analysis.untitledPages.push(file.relativePath);
      }

      if (ext === '.md') {
        analysis.markdownFiles++;

        // Read and analyze content
        try {
          const content = await fs.readFile(file.path, 'utf-8');
          const contentAnalysis = analyzeMarkdownContent(content);

          if (contentAnalysis.isEmpty) {
            analysis.emptyPages.push(file.relativePath);
          }

          if (contentAnalysis.hasFrontMatter) analysis.frontMatter++;
          if (contentAnalysis.hasCallouts) analysis.callouts++;

          analysis.filesToImport.push({
            sourcePath: file.path,
            relativePath: file.relativePath,
            name: fileName,
            type: 'markdown',
            size: file.stat.size,
            hasWikiLinks: false, // Notion uses standard links
            hasFrontMatter: contentAnalysis.hasFrontMatter,
            hasCallouts: contentAnalysis.hasCallouts,
            hasDataview: false, // Notion doesn't have dataview
          });
        } catch (error) {
          console.warn(`Failed to read file ${file.path}:`, error);
        }
      } else if (ext === '.csv') {
        analysis.csvDatabases++;
        analysis.filesToImport.push({
          sourcePath: file.path,
          relativePath: file.relativePath,
          name: fileName,
          type: 'other', // Will be converted to markdown
          size: file.stat.size,
          hasWikiLinks: false,
          hasFrontMatter: false,
          hasCallouts: false,
          hasDataview: false,
        });
      } else if (ATTACHMENT_EXTENSIONS.has(ext)) {
        analysis.attachments++;
        analysis.filesToImport.push({
          sourcePath: file.path,
          relativePath: file.relativePath,
          name: fileName,
          type: 'attachment',
          size: file.stat.size,
          hasWikiLinks: false,
          hasFrontMatter: false,
          hasCallouts: false,
          hasDataview: false,
        });
      }
    }
  } catch (error) {
    console.error('Failed to analyze Notion export:', error);
    throw error;
  }

  return analysis;
}

/**
 * Import files from a Notion export
 *
 * Features:
 * - Atomic operations with rollback on failure
 * - Cancellation support via AbortSignal
 * - Parallel file processing for better performance
 * - Enhanced error handling with user-friendly messages
 */
export async function importNotionExport(
  analysis: NotionAnalysis,
  destPath: string,
  options: NotionImportOptions,
  onProgress: (progress: ImportProgress) => void
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    filesImported: 0,
    linksConverted: 0,
    attachmentsCopied: 0,
    errors: [],
    warnings: [],
  };

  const markdownFiles = analysis.filesToImport.filter(f => f.type === 'markdown');
  const csvFiles = analysis.filesToImport.filter(f =>
    f.type === 'other' && path.extname(f.name).toLowerCase() === '.csv'
  );
  const attachmentFiles = analysis.filesToImport.filter(f => f.type === 'attachment');

  // Build filename map for UUID stripping
  const filenameMap = options.removeUUIDs
    ? buildNotionFilenameMap([...markdownFiles, ...csvFiles, ...attachmentFiles])
    : new Map<string, string>();

  const totalSteps = markdownFiles.length + csvFiles.length + (options.copyAttachments ? attachmentFiles.length : 0);
  let currentStep = 0;

  // Throttled progress reporting to reduce IPC overhead
  let lastProgressTime = 0;

  const reportProgress = (phase: ImportProgress['phase'], currentFile: string, force = false) => {
    const now = Date.now();
    if (force || now - lastProgressTime >= IMPORT_CONFIG.PROGRESS_THROTTLE_MS) {
      lastProgressTime = now;
      onProgress({
        phase,
        current: currentStep,
        total: totalSteps,
        currentFile,
        // Clone arrays to prevent mutation issues
        errors: [...result.errors],
        warnings: [...result.warnings],
      });
    }
  };

  // Check for cancellation
  const checkCancelled = () => {
    if (options.signal?.aborted) {
      throw new Error('Import cancelled by user');
    }
  };

  // Pre-flight disk space check
  const totalSize = analysis.filesToImport.reduce((sum, f) => sum + f.size, 0);
  const spaceCheck = await validateDiskSpace(destPath, totalSize);
  if (!spaceCheck.valid) {
    reportImportError('disk_space', spaceCheck.error || 'Insufficient disk space', {
      sourceType: 'notion',
      fileCount: analysis.totalFiles,
      phase: 'analyzing',
    });
    result.errors.push({ file: '', message: spaceCheck.error || 'Insufficient disk space' });
    result.success = false;
    return result;
  }

  // Create transaction for atomic operations
  const transaction = new ImportTransaction(destPath);

  // Track staged file paths for link rebuilding
  const stagedFiles: Array<{ relativePath: string; content: string }> = [];

  try {
    await transaction.initialize();
    checkCancelled();

    // Process markdown files with concurrency limit
    const limit = pLimit(IMPORT_CONFIG.PARALLEL_BATCH_SIZE);
    const processingErrors: Array<{ file: string; error: unknown }> = [];

    // Phase 1: Convert and stage markdown files
    reportProgress('converting', '', true);

    const mdTasks = markdownFiles.map(file => limit(async () => {
      checkCancelled();
      currentStep++;

      // Skip empty pages if option is set
      if (options.skipEmptyPages && analysis.emptyPages.includes(file.relativePath)) {
        return;
      }

      reportProgress('converting', file.relativePath);

      try {
        // Determine new filename (needed for both large file copy and normal processing)
        const newFilename = options.removeUUIDs
          ? sanitizeFilename(filenameMap.get(file.name) || file.name)
          : sanitizeFilename(file.name);

        // Determine destination path
        const relativePath = sanitizeRelativePath(
          options.preserveFolderStructure
            ? path.join(path.dirname(file.relativePath), newFilename)
            : newFilename
        );

        // Check file size before reading to prevent memory exhaustion
        if (file.size > IMPORT_CONFIG.MAX_CONTENT_SIZE) {
          result.warnings.push({
            file: file.relativePath,
            message: `File too large (${Math.round(file.size / 1024 / 1024)}MB) - copying without conversion`,
            type: 'file_too_large',
          });
          // Copy file as-is without processing
          await transaction.stageCopy(file.sourcePath, relativePath);
          result.filesImported++;
          return;
        }

        let content = await fs.readFile(file.sourcePath, 'utf-8');
        let metadata: Record<string, unknown> = {};

        // Parse front-matter if option is set
        if (options.importFrontMatter) {
          const { frontMatter, content: contentWithoutFM } = parseFrontMatter(content);
          if (frontMatter) {
            metadata = { ...metadata, frontMatter };
            content = contentWithoutFM;
          }
        }

        // Stage the markdown file
        await transaction.stageFile(relativePath, content);

        // Track for link rebuilding
        stagedFiles.push({ relativePath, content });

        // Stage .md.midlight file if option is set
        if (options.createMidlightFiles) {
          const midlightContent = JSON.stringify({
            version: 1,
            created: new Date().toISOString(),
            importedFrom: 'notion',
            originalPath: file.relativePath,
            metadata,
          }, null, 2);
          await transaction.stageFile(relativePath + '.midlight', midlightContent);
        }

        result.filesImported++;
      } catch (error) {
        processingErrors.push({ file: file.relativePath, error });
      }
    }));

    await Promise.all(mdTasks);
    checkCancelled();

    // Phase 1.5: Convert CSV databases to markdown tables
    if (options.convertCSVToTables) {
      const csvTasks = csvFiles.map(file => limit(async () => {
        checkCancelled();
        currentStep++;

        reportProgress('converting', file.relativePath);

        try {
          const csvContent = await fs.readFile(file.sourcePath, 'utf-8');
          const tableContent = csvToMarkdownTable(csvContent);

          // Determine new filename (change .csv to .md)
          let newFilename = file.name.replace(/\.csv$/i, '.md');
          if (options.removeUUIDs) {
            newFilename = filenameMap.get(file.name)?.replace(/\.csv$/i, '.md') || newFilename;
          }
          newFilename = sanitizeFilename(newFilename);

          // Determine destination path
          const relativePath = sanitizeRelativePath(
            options.preserveFolderStructure
              ? path.join(path.dirname(file.relativePath), newFilename)
              : newFilename
          );

          // Add a header to the table
          const dbName = path.basename(newFilename, '.md');
          const markdownContent = `# ${dbName}\n\n${tableContent}`;

          // Stage the markdown file
          await transaction.stageFile(relativePath, markdownContent);

          // Stage .md.midlight file if option is set
          if (options.createMidlightFiles) {
            const midlightContent = JSON.stringify({
              version: 1,
              created: new Date().toISOString(),
              importedFrom: 'notion',
              originalPath: file.relativePath,
              convertedFrom: 'csv',
            }, null, 2);
            await transaction.stageFile(relativePath + '.midlight', midlightContent);
          }

          result.filesImported++;
        } catch (error) {
          processingErrors.push({ file: file.relativePath, error });
        }
      }));

      await Promise.all(csvTasks);
    }

    checkCancelled();

    // Add any processing errors to result
    for (const { file, error } of processingErrors) {
      const { message } = formatUserError(error);
      result.errors.push({ file, message });
    }

    // Phase 2: Copy attachments
    if (options.copyAttachments) {
      reportProgress('copying', '', true);

      const attachmentErrors: Array<{ file: string; error: unknown }> = [];

      const attachmentTasks = attachmentFiles.map(file => limit(async () => {
        checkCancelled();
        currentStep++;

        reportProgress('copying', file.relativePath);

        try {
          // Determine new filename
          const newFilename = options.removeUUIDs
            ? sanitizeFilename(filenameMap.get(file.name) || file.name)
            : sanitizeFilename(file.name);

          const relativePath = sanitizeRelativePath(
            options.preserveFolderStructure
              ? path.join(path.dirname(file.relativePath), newFilename)
              : path.join('attachments', newFilename)
          );

          // Stage the attachment copy
          await transaction.stageCopy(file.sourcePath, relativePath);

          // Verify large file copies
          if (file.size > IMPORT_CONFIG.MAX_LARGE_FILE_CHECKSUM) {
            const stagingPath = path.join(transaction.getStagingDir(), relativePath);
            const verified = await transaction.verifyCopy(file.sourcePath, stagingPath);
            if (!verified) {
              throw new Error('File copy verification failed - checksum mismatch');
            }
          }

          result.attachmentsCopied++;
        } catch (error) {
          attachmentErrors.push({ file: file.relativePath, error });
        }
      }));

      await Promise.all(attachmentTasks);

      // Add attachment errors to result
      for (const { file, error } of attachmentErrors) {
        const { message } = formatUserError(error);
        result.errors.push({ file, message });
      }
    }

    checkCancelled();

    // Phase 3: Rebuild internal links if UUIDs were removed
    if (options.removeUUIDs && stagedFiles.length > 0) {
      reportProgress('finalizing', 'Rebuilding links...', true);

      for (const { relativePath, content } of stagedFiles) {
        try {
          const { content: updatedContent, linksUpdated } = rebuildNotionLinks(content, filenameMap);

          if (linksUpdated > 0) {
            // Re-stage the file with updated links
            await transaction.stageFile(relativePath, updatedContent);
            result.linksConverted += linksUpdated;
          }
        } catch (error) {
          const stagingPath = path.join(transaction.getStagingDir(), relativePath);
          result.warnings.push({
            file: stagingPath,
            message: `Failed to rebuild links: ${formatUserError(error).message}`,
            type: 'broken_link',
          });
        }
      }
    }

    checkCancelled();

    // Phase 4: Commit transaction (move files from staging to final location)
    reportProgress('finalizing', 'Committing files...', true);
    await transaction.commit();

    // Phase 5: Complete
    reportProgress('complete', '', true);

    result.success = result.errors.length === 0;
    return result;

  } catch (error) {
    // Rollback on any error
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error('Failed to rollback transaction:', rollbackError);
      reportImportError('rollback', 'Transaction rollback failed', {
        sourceType: 'notion',
        fileCount: analysis.totalFiles,
        phase: 'finalizing',
      });
    }

    // Check if it was a cancellation
    if (options.signal?.aborted) {
      reportImportError('cancelled', 'Import cancelled by user', {
        sourceType: 'notion',
        fileCount: result.filesImported,
        phase: 'converting',
      });
      result.errors.push({ file: '', message: 'Import cancelled by user' });
    } else {
      const { message } = formatUserError(error);
      reportImportError('unknown', message, {
        sourceType: 'notion',
        fileCount: analysis.totalFiles,
        phase: 'converting',
      });
      result.errors.push({ file: '', message });
    }

    result.success = false;
    reportProgress('complete', '', true);
    return result;
  }

  // Report aggregate import errors if any
  if (result.errors.length > 0) {
    reportImportError('file_read', `Import completed with ${result.errors.length} errors`, {
      sourceType: 'notion',
      fileCount: result.filesImported,
      errorCount: result.errors.length,
      phase: 'complete',
    });
  }
}
