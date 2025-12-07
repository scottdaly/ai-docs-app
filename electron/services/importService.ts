import fs from 'node:fs/promises';
import { Stats } from 'node:fs';
import path from 'node:path';

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
  type: 'broken_link' | 'dataview_removed' | 'unsupported_feature';
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
// Fixed: Use [^\n]* instead of .* to prevent backtracking across lines
const CALLOUT_REGEX = /^>\s*\[!(\w+)\]([+-])?(?:\s+([^\n]*))?\n((?:>[^\n]*\n?)*)/gm;
// Fixed: Limit dataview block size to prevent ReDoS
const DATAVIEW_REGEX = /```dataview\n[^`]{0,10000}?```/g;
const DATAVIEW_INLINE_REGEX = /`=[^`]{0,1000}?`/g;

// Maximum content size to process (10MB)
const MAX_CONTENT_SIZE = 10 * 1024 * 1024;

// Image extensions for attachment detection
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico']);
const ATTACHMENT_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, '.pdf', '.mp3', '.mp4', '.wav', '.mov']);

/**
 * Sanitize a relative path to prevent path traversal attacks
 * Removes '..' segments, normalizes slashes, and ensures the path stays relative
 */
export function sanitizeRelativePath(relativePath: string): string {
  // Normalize path separators
  let sanitized = relativePath.replace(/\\/g, '/');

  // Split into segments and filter out dangerous parts
  const segments = sanitized.split('/').filter(segment => {
    // Remove empty segments, current dir, and parent dir references
    if (!segment || segment === '.' || segment === '..') {
      return false;
    }
    // Remove segments that could be null bytes or other tricks
    if (segment.includes('\0')) {
      return false;
    }
    return true;
  });

  // Rejoin the path
  return segments.join('/');
}

/**
 * Validate that a destination path is safely within the target directory
 */
export function isPathSafe(destPath: string, basePath: string): boolean {
  const normalizedDest = path.normalize(path.resolve(destPath));
  const normalizedBase = path.normalize(path.resolve(basePath));

  // Check that the destination starts with the base path
  return normalizedDest.startsWith(normalizedBase + path.sep) || normalizedDest === normalizedBase;
}

/**
 * Validate and sanitize a user-provided path
 */
export function validatePath(inputPath: string): { valid: boolean; error?: string } {
  if (!inputPath || typeof inputPath !== 'string') {
    return { valid: false, error: 'Path must be a non-empty string' };
  }

  // Check for null bytes
  if (inputPath.includes('\0')) {
    return { valid: false, error: 'Path contains invalid characters' };
  }

  // Check path length (Windows MAX_PATH is 260, but we'll be generous)
  if (inputPath.length > 1000) {
    return { valid: false, error: 'Path is too long' };
  }

  return { valid: true };
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
 * Recursively get all files in a directory
 * Handles errors gracefully for individual files/directories
 */
async function getAllFiles(
  dirPath: string,
  basePath: string,
  skipFolders: Set<string> = new Set(['.obsidian', '.git', '.trash', 'node_modules'])
): Promise<{ path: string; relativePath: string; stat: Stats }[]> {
  const results: { path: string; relativePath: string; stat: Stats }[] = [];

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    console.warn(`Failed to read directory ${dirPath}:`, error);
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    try {
      if (entry.isDirectory()) {
        if (!skipFolders.has(entry.name) && !entry.name.startsWith('.')) {
          const subFiles = await getAllFiles(fullPath, basePath, skipFolders);
          results.push(...subFiles);
        }
      } else {
        const stat = await fs.stat(fullPath);
        results.push({ path: fullPath, relativePath, stat });
      }
    } catch (error) {
      // Log but continue - don't fail the whole operation for one bad file
      console.warn(`Failed to process ${fullPath}:`, error);
    }
  }

  return results;
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
  };

  try {
    const allFiles = await getAllFiles(vaultPath, vaultPath);
    analysis.totalFiles = allFiles.length;

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
 * Convert wiki-links to standard markdown links
 */
export function convertWikiLinks(
  content: string,
  fileMap: Map<string, string> // maps original names to new relative paths
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

    // Try to find the target in the file map
    let targetPath: string | undefined = fileMap.get(target) || fileMap.get(target + '.md');

    if (!targetPath) {
      // Try case-insensitive search
      for (const [key, value] of fileMap.entries()) {
        if (key.toLowerCase() === target.toLowerCase() ||
            key.toLowerCase() === (target + '.md').toLowerCase()) {
          targetPath = value;
          break;
        }
      }
    }

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
 * Parse front-matter from markdown content
 */
export function parseFrontMatter(content: string): {
  frontMatter: Record<string, any> | null;
  content: string;
} {
  // Skip processing for very large content
  if (content.length > MAX_CONTENT_SIZE) {
    console.warn('Content too large for front-matter parsing');
    return { frontMatter: null, content };
  }

  const match = content.match(FRONT_MATTER_REGEX);

  if (!match) {
    return { frontMatter: null, content };
  }

  try {
    // Simple YAML parsing (for basic key: value pairs)
    const yamlContent = match[1];
    const frontMatter: Record<string, any> = {};

    const lines = yamlContent.split('\n');
    let currentKey = '';
    let currentValue: any = '';
    let inArray = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check for array item
      if (trimmed.startsWith('- ')) {
        if (inArray && currentKey) {
          if (!Array.isArray(frontMatter[currentKey])) {
            frontMatter[currentKey] = [];
          }
          frontMatter[currentKey].push(trimmed.slice(2).trim());
        }
        continue;
      }

      // Check for key: value
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        // Save previous key if exists
        if (currentKey && !inArray) {
          frontMatter[currentKey] = currentValue;
        }

        currentKey = trimmed.slice(0, colonIndex).trim();
        const value = trimmed.slice(colonIndex + 1).trim();

        if (value === '') {
          // Could be start of array or multi-line
          inArray = true;
          frontMatter[currentKey] = [];
        } else if (value.startsWith('[') && value.endsWith(']')) {
          // Inline array
          frontMatter[currentKey] = value.slice(1, -1).split(',').map(s => s.trim());
          inArray = false;
        } else {
          frontMatter[currentKey] = value;
          inArray = false;
        }
        currentValue = value;
      }
    }

    // Save last key
    if (currentKey && !inArray && !frontMatter[currentKey]) {
      frontMatter[currentKey] = currentValue;
    }

    const contentWithoutFrontMatter = content.slice(match[0].length);
    return { frontMatter, content: contentWithoutFrontMatter };
  } catch (error) {
    console.error('Failed to parse front-matter:', error);
    return { frontMatter: null, content };
  }
}

/**
 * Build a file map for wiki-link resolution
 */
export function buildFileMap(files: ImportFileInfo[]): Map<string, string> {
  const fileMap = new Map<string, string>();

  for (const file of files) {
    if (file.type === 'markdown' || file.type === 'attachment') {
      // Map by filename without extension
      const nameWithoutExt = file.name.replace(/\.[^.]+$/, '');
      fileMap.set(nameWithoutExt, file.relativePath);

      // Also map by full filename
      fileMap.set(file.name, file.relativePath);

      // Map by relative path without extension
      const relativeWithoutExt = file.relativePath.replace(/\.[^.]+$/, '');
      fileMap.set(relativeWithoutExt, file.relativePath);
    }
  }

  return fileMap;
}

/**
 * Import files from an Obsidian vault
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

  // Phase 1: Convert and copy markdown files
  onProgress({
    phase: 'converting',
    current: 0,
    total: markdownFiles.length,
    currentFile: '',
    errors: [],
    warnings: [],
  });

  for (const file of markdownFiles) {
    currentStep++;

    // Skip empty pages if option is set
    if (options.skipEmptyPages && analysis.emptyPages.includes(file.relativePath)) {
      continue;
    }

    onProgress({
      phase: 'converting',
      current: currentStep,
      total: totalSteps,
      currentFile: file.relativePath,
      errors: result.errors,
      warnings: result.warnings,
    });

    try {
      let content = await fs.readFile(file.sourcePath, 'utf-8');
      let metadata: Record<string, any> = {};

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
      const sanitizedRelativePath = sanitizeRelativePath(file.relativePath);
      const sanitizedName = path.basename(file.name); // Ensure no path traversal in filename
      const destFilePath = options.preserveFolderStructure
        ? path.join(destPath, sanitizedRelativePath)
        : path.join(destPath, sanitizedName);

      // Validate the destination is within the target directory
      if (!isPathSafe(destFilePath, destPath)) {
        result.errors.push({
          file: file.relativePath,
          message: 'Invalid file path - path traversal detected',
        });
        continue;
      }

      // Create destination directory if needed
      const destDir = path.dirname(destFilePath);
      await fs.mkdir(destDir, { recursive: true });

      // Write the converted markdown file
      await fs.writeFile(destFilePath, content, 'utf-8');

      // Create .md.midlight file if option is set
      if (options.createMidlightFiles) {
        const midlightPath = destFilePath + '.midlight';
        const midlightContent = JSON.stringify({
          version: 1,
          created: new Date().toISOString(),
          importedFrom: 'obsidian',
          originalPath: file.relativePath,
          metadata,
        }, null, 2);
        await fs.writeFile(midlightPath, midlightContent, 'utf-8');
      }

      result.filesImported++;
    } catch (error) {
      result.errors.push({
        file: file.relativePath,
        message: String(error),
      });
    }
  }

  // Phase 2: Copy attachments
  if (options.copyAttachments) {
    onProgress({
      phase: 'copying',
      current: currentStep,
      total: totalSteps,
      currentFile: '',
      errors: result.errors,
      warnings: result.warnings,
    });

    for (const file of attachmentFiles) {
      currentStep++;

      onProgress({
        phase: 'copying',
        current: currentStep,
        total: totalSteps,
        currentFile: file.relativePath,
        errors: result.errors,
        warnings: result.warnings,
      });

      try {
        // Sanitize paths for attachments too
        const sanitizedRelativePath = sanitizeRelativePath(file.relativePath);
        const sanitizedName = path.basename(file.name);
        const destFilePath = options.preserveFolderStructure
          ? path.join(destPath, sanitizedRelativePath)
          : path.join(destPath, 'attachments', sanitizedName);

        // Validate the destination is within the target directory
        if (!isPathSafe(destFilePath, destPath)) {
          result.errors.push({
            file: file.relativePath,
            message: 'Invalid file path - path traversal detected',
          });
          continue;
        }

        const destDir = path.dirname(destFilePath);
        await fs.mkdir(destDir, { recursive: true });

        await fs.copyFile(file.sourcePath, destFilePath);
        result.attachmentsCopied++;
      } catch (error) {
        result.errors.push({
          file: file.relativePath,
          message: String(error),
        });
      }
    }
  }

  // Phase 3: Finalize
  onProgress({
    phase: 'complete',
    current: totalSteps,
    total: totalSteps,
    currentFile: '',
    errors: result.errors,
    warnings: result.warnings,
  });

  result.success = result.errors.length === 0;
  return result;
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

  // Build header row
  let table = '| ' + headers.join(' | ') + ' |\n';

  // Build separator row
  table += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

  // Build data rows
  for (const row of dataRows) {
    // Pad row to match header length
    while (row.length < headers.length) {
      row.push('');
    }
    table += '| ' + row.map(cell => cell.replace(/\|/g, '\\|')).join(' | ') + ' |\n';
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
 * Rebuild internal links in content after filenames have been changed
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
    const decoded = decodeURIComponent(href);

    // Check if this is an internal link (relative path)
    if (decoded.startsWith('http://') || decoded.startsWith('https://') || decoded.startsWith('mailto:')) {
      return match; // External link, don't modify
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
  };

  try {
    const allFiles = await getAllFiles(exportPath, exportPath, new Set(['.git', 'node_modules']));
    analysis.totalFiles = allFiles.length;

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

  // Phase 1: Convert and copy markdown files
  onProgress({
    phase: 'converting',
    current: 0,
    total: markdownFiles.length,
    currentFile: '',
    errors: [],
    warnings: [],
  });

  // Track file paths for link rebuilding
  const importedFiles: { path: string; content: string }[] = [];

  for (const file of markdownFiles) {
    currentStep++;

    // Skip empty pages if option is set
    if (options.skipEmptyPages && analysis.emptyPages.includes(file.relativePath)) {
      continue;
    }

    onProgress({
      phase: 'converting',
      current: currentStep,
      total: totalSteps,
      currentFile: file.relativePath,
      errors: result.errors,
      warnings: result.warnings,
    });

    try {
      let content = await fs.readFile(file.sourcePath, 'utf-8');
      let metadata: Record<string, any> = {};

      // Parse front-matter if option is set
      if (options.importFrontMatter) {
        const { frontMatter, content: contentWithoutFM } = parseFrontMatter(content);
        if (frontMatter) {
          metadata = { ...metadata, frontMatter };
          content = contentWithoutFM;
        }
      }

      // Determine new filename
      const newFilename = options.removeUUIDs
        ? (filenameMap.get(file.name) || file.name)
        : file.name;

      // Handle "Untitled" pages
      if (options.untitledHandling === 'number') {
        // Already handled by conflict resolution in buildNotionFilenameMap
      }

      // Determine destination path
      const sanitizedRelativePath = sanitizeRelativePath(
        options.preserveFolderStructure
          ? path.join(path.dirname(file.relativePath), newFilename)
          : newFilename
      );
      const destFilePath = path.join(destPath, sanitizedRelativePath);

      // Validate path safety
      if (!isPathSafe(destFilePath, destPath)) {
        result.errors.push({
          file: file.relativePath,
          message: 'Invalid file path - path traversal detected',
        });
        continue;
      }

      // Create destination directory
      const destDir = path.dirname(destFilePath);
      await fs.mkdir(destDir, { recursive: true });

      // Write the markdown file
      await fs.writeFile(destFilePath, content, 'utf-8');

      // Track for link rebuilding
      importedFiles.push({ path: destFilePath, content });

      // Create .md.midlight file if option is set
      if (options.createMidlightFiles) {
        const midlightPath = destFilePath + '.midlight';
        const midlightContent = JSON.stringify({
          version: 1,
          created: new Date().toISOString(),
          importedFrom: 'notion',
          originalPath: file.relativePath,
          metadata,
        }, null, 2);
        await fs.writeFile(midlightPath, midlightContent, 'utf-8');
      }

      result.filesImported++;
    } catch (error) {
      result.errors.push({
        file: file.relativePath,
        message: String(error),
      });
    }
  }

  // Phase 1.5: Convert CSV databases to markdown tables
  if (options.convertCSVToTables) {
    for (const file of csvFiles) {
      currentStep++;

      onProgress({
        phase: 'converting',
        current: currentStep,
        total: totalSteps,
        currentFile: file.relativePath,
        errors: result.errors,
        warnings: result.warnings,
      });

      try {
        const csvContent = await fs.readFile(file.sourcePath, 'utf-8');
        const tableContent = csvToMarkdownTable(csvContent);

        // Determine new filename (change .csv to .md)
        let newFilename = file.name.replace(/\.csv$/i, '.md');
        if (options.removeUUIDs) {
          newFilename = filenameMap.get(file.name)?.replace(/\.csv$/i, '.md') || newFilename;
        }

        // Determine destination path
        const sanitizedRelativePath = sanitizeRelativePath(
          options.preserveFolderStructure
            ? path.join(path.dirname(file.relativePath), newFilename)
            : newFilename
        );
        const destFilePath = path.join(destPath, sanitizedRelativePath);

        // Validate path safety
        if (!isPathSafe(destFilePath, destPath)) {
          result.errors.push({
            file: file.relativePath,
            message: 'Invalid file path - path traversal detected',
          });
          continue;
        }

        // Create destination directory
        const destDir = path.dirname(destFilePath);
        await fs.mkdir(destDir, { recursive: true });

        // Add a header to the table
        const dbName = path.basename(newFilename, '.md');
        const markdownContent = `# ${dbName}\n\n${tableContent}`;

        // Write the markdown file
        await fs.writeFile(destFilePath, markdownContent, 'utf-8');

        // Create .md.midlight file if option is set
        if (options.createMidlightFiles) {
          const midlightPath = destFilePath + '.midlight';
          const midlightContent = JSON.stringify({
            version: 1,
            created: new Date().toISOString(),
            importedFrom: 'notion',
            originalPath: file.relativePath,
            convertedFrom: 'csv',
          }, null, 2);
          await fs.writeFile(midlightPath, midlightContent, 'utf-8');
        }

        result.filesImported++;
      } catch (error) {
        result.errors.push({
          file: file.relativePath,
          message: String(error),
        });
      }
    }
  }

  // Phase 2: Copy attachments
  if (options.copyAttachments) {
    onProgress({
      phase: 'copying',
      current: currentStep,
      total: totalSteps,
      currentFile: '',
      errors: result.errors,
      warnings: result.warnings,
    });

    for (const file of attachmentFiles) {
      currentStep++;

      onProgress({
        phase: 'copying',
        current: currentStep,
        total: totalSteps,
        currentFile: file.relativePath,
        errors: result.errors,
        warnings: result.warnings,
      });

      try {
        // Determine new filename
        const newFilename = options.removeUUIDs
          ? (filenameMap.get(file.name) || file.name)
          : file.name;

        const sanitizedRelativePath = sanitizeRelativePath(
          options.preserveFolderStructure
            ? path.join(path.dirname(file.relativePath), newFilename)
            : path.join('attachments', newFilename)
        );
        const destFilePath = path.join(destPath, sanitizedRelativePath);

        // Validate path safety
        if (!isPathSafe(destFilePath, destPath)) {
          result.errors.push({
            file: file.relativePath,
            message: 'Invalid file path - path traversal detected',
          });
          continue;
        }

        // Create destination directory
        const destDir = path.dirname(destFilePath);
        await fs.mkdir(destDir, { recursive: true });

        // Copy the file
        await fs.copyFile(file.sourcePath, destFilePath);
        result.attachmentsCopied++;
      } catch (error) {
        result.errors.push({
          file: file.relativePath,
          message: String(error),
        });
      }
    }
  }

  // Phase 3: Rebuild internal links if UUIDs were removed
  if (options.removeUUIDs && importedFiles.length > 0) {
    onProgress({
      phase: 'finalizing',
      current: currentStep,
      total: totalSteps,
      currentFile: 'Rebuilding links...',
      errors: result.errors,
      warnings: result.warnings,
    });

    for (const file of importedFiles) {
      try {
        const content = await fs.readFile(file.path, 'utf-8');
        const { content: updatedContent, linksUpdated } = rebuildNotionLinks(content, filenameMap);

        if (linksUpdated > 0) {
          await fs.writeFile(file.path, updatedContent, 'utf-8');
          result.linksConverted += linksUpdated;
        }
      } catch (error) {
        result.warnings.push({
          file: file.path,
          message: `Failed to rebuild links: ${String(error)}`,
          type: 'broken_link',
        });
      }
    }
  }

  // Phase 4: Complete
  onProgress({
    phase: 'complete',
    current: totalSteps,
    total: totalSteps,
    currentFile: '',
    errors: result.errors,
    warnings: result.warnings,
  });

  result.success = result.errors.length === 0;
  return result;
}
