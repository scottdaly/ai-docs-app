/**
 * Import Security Module
 *
 * Centralized security utilities, validation functions, and configuration
 * for the import service. Addresses audit findings for path traversal,
 * input validation, and other security concerns.
 */

import path from 'path';
import yaml from 'js-yaml';

// ============================================
// CONFIGURATION CONSTANTS
// ============================================

export const IMPORT_CONFIG = {
  // File size limits
  MAX_CONTENT_SIZE: 10 * 1024 * 1024,        // 10MB - max file size for regex processing
  MAX_LARGE_FILE_CHECKSUM: 10 * 1024 * 1024, // 10MB - threshold for checksum verification

  // Path limits
  MAX_PATH_LENGTH: 1000,
  MAX_FILENAME_LENGTH: 255,

  // Progress reporting
  PROGRESS_THROTTLE_MS: 100,

  // Regex safety limits (ReDoS prevention)
  MAX_DATAVIEW_BLOCK_SIZE: 10000,
  MAX_INLINE_DATAVIEW_SIZE: 1000,
  MAX_CALLOUT_LINES: 500,

  // Parallel processing
  PARALLEL_BATCH_SIZE: 10,

  // Disk space
  DISK_SPACE_BUFFER_PERCENT: 1.1, // Require 10% more space than needed

  // JSON input limits
  MAX_JSON_INPUT_SIZE: 10 * 1024 * 1024, // 10MB max for JSON inputs

  // YAML safety limits (bomb protection)
  MAX_YAML_SIZE: 1024 * 1024,           // 1MB max YAML size
  MAX_YAML_ALIASES: 100,                 // Max alias references (prevents billion laughs)
  MAX_YAML_DEPTH: 50,                    // Max nesting depth
  MAX_YAML_KEYS: 10000,                  // Max keys in a single document
} as const;

// ============================================
// WINDOWS RESERVED NAMES
// ============================================

const WINDOWS_RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

// ============================================
// FILENAME SANITIZATION
// ============================================

/**
 * Sanitizes a filename to be safe for all platforms.
 * Handles:
 * - Null bytes
 * - Windows reserved names
 * - Control characters
 * - Trailing dots/spaces (Windows)
 * - Empty or dangerous names (., ..)
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return '_unnamed_';
  }

  // Remove path components first
  let safe = path.basename(filename);

  // Remove null bytes
  safe = safe.replace(/\0/g, '');

  // Remove control characters (0x00-0x1F and 0x80-0x9F)
  safe = safe.replace(/[\x00-\x1f\x80-\x9f]/g, '');

  // Reject dangerous names
  if (safe === '.' || safe === '..' || safe === '' || /^\.+$/.test(safe)) {
    return '_unnamed_';
  }

  // Handle Windows reserved names (case-insensitive)
  const nameWithoutExt = safe.replace(/\.[^.]*$/, '').toUpperCase();
  if (WINDOWS_RESERVED_NAMES.has(nameWithoutExt)) {
    safe = '_' + safe;
  }

  // Remove trailing dots and spaces (Windows compatibility)
  safe = safe.replace(/[. ]+$/, '');

  // If we've sanitized to nothing, return a placeholder
  if (!safe) {
    return '_unnamed_';
  }

  // Truncate if too long
  if (safe.length > IMPORT_CONFIG.MAX_FILENAME_LENGTH) {
    const ext = path.extname(safe);
    const name = path.basename(safe, ext);
    const maxNameLength = IMPORT_CONFIG.MAX_FILENAME_LENGTH - ext.length;
    safe = name.slice(0, maxNameLength) + ext;
  }

  return safe;
}

// ============================================
// PATH SANITIZATION
// ============================================

/**
 * Sanitizes a relative path to prevent path traversal attacks.
 * Handles:
 * - URL encoding bypass attempts
 * - Unicode normalization
 * - Absolute path rejection
 * - Null bytes
 * - Directory traversal (.. and .)
 * - Trailing dots/spaces on Windows
 */
export function sanitizeRelativePath(relativePath: string): string {
  if (!relativePath || typeof relativePath !== 'string') {
    return '';
  }

  let sanitized = relativePath;

  // Decode URL encoding first (prevents %2e%2e bypass)
  try {
    // Decode multiple times in case of double-encoding
    let decoded = sanitized;
    let prevDecoded = '';
    let iterations = 0;
    while (decoded !== prevDecoded && iterations < 3) {
      prevDecoded = decoded;
      decoded = decodeURIComponent(decoded);
      iterations++;
    }
    sanitized = decoded;
  } catch {
    // Invalid encoding, use original but be cautious
    // Remove any obvious encoded patterns
    sanitized = sanitized.replace(/%[0-9a-fA-F]{2}/g, '');
  }

  // Normalize Unicode (prevents lookalike character attacks)
  sanitized = sanitized.normalize('NFC');

  // Remove null bytes BEFORE any other processing
  sanitized = sanitized.replace(/\0/g, '');

  // Reject absolute paths (Unix and Windows)
  if (path.isAbsolute(sanitized) || /^[a-zA-Z]:/.test(sanitized)) {
    return '';
  }

  // Normalize path separators to forward slash
  sanitized = sanitized.replace(/\\/g, '/');

  // Split and filter dangerous segments
  const segments = sanitized.split('/').filter(segment => {
    // Remove empty segments
    if (!segment) return false;

    // Trim whitespace
    const trimmed = segment.trim();

    // Remove . and .. segments
    if (trimmed === '.' || trimmed === '..') return false;

    // Remove segments that are ONLY dots (any number)
    if (/^\.+$/.test(trimmed)) return false;

    // Check for null bytes in segment
    if (trimmed.includes('\0')) return false;

    return true;
  }).map(segment => {
    // Trim each segment
    let clean = segment.trim();

    // Remove trailing dots and spaces (Windows compatibility)
    clean = clean.replace(/[. ]+$/, '');

    // Sanitize the filename component
    return sanitizeFilename(clean);
  }).filter(segment => segment && segment !== '_unnamed_');

  return segments.join('/');
}

// ============================================
// PATH SAFETY VALIDATION
// ============================================

/**
 * Validates that a destination path stays within the target directory.
 * Prevents path traversal attacks that could write outside the target.
 */
export function isPathSafe(destPath: string, basePath: string): boolean {
  if (!destPath || !basePath) return false;

  try {
    // Resolve both paths to absolute paths
    const resolvedDest = path.resolve(destPath);
    const resolvedBase = path.resolve(basePath);

    // Normalize both paths for comparison
    const normalizedDest = path.normalize(resolvedDest);
    const normalizedBase = path.normalize(resolvedBase);

    // Check if destination starts with base path
    // Add separator to prevent partial matches (e.g., /base-extra matching /base)
    const baseWithSep = normalizedBase.endsWith(path.sep)
      ? normalizedBase
      : normalizedBase + path.sep;

    return normalizedDest === normalizedBase ||
           normalizedDest.startsWith(baseWithSep);
  } catch {
    return false;
  }
}

// ============================================
// INPUT PATH VALIDATION
// ============================================

/**
 * Validates a user-provided path string.
 * Returns an object with validation result and error message.
 */
export function validatePath(inputPath: string): { valid: boolean; error?: string } {
  // Type check
  if (!inputPath || typeof inputPath !== 'string') {
    return { valid: false, error: 'Path must be a non-empty string' };
  }

  // Null byte check
  if (inputPath.includes('\0')) {
    return { valid: false, error: 'Path contains invalid characters' };
  }

  // Length check
  if (inputPath.length > IMPORT_CONFIG.MAX_PATH_LENGTH) {
    return { valid: false, error: 'Path is too long' };
  }

  // Control character check
  if (/[\x00-\x1f]/.test(inputPath)) {
    return { valid: false, error: 'Path contains control characters' };
  }

  return { valid: true };
}

// ============================================
// JSON INPUT VALIDATION
// ============================================

/**
 * Validates and parses JSON input with size limits.
 * Returns parsed object or error.
 */
export function validateAndParseJSON<T>(
  jsonString: string,
  maxSize: number = IMPORT_CONFIG.MAX_JSON_INPUT_SIZE
): { success: true; data: T } | { success: false; error: string } {
  if (!jsonString || typeof jsonString !== 'string') {
    return { success: false, error: 'Input must be a non-empty string' };
  }

  if (jsonString.length > maxSize) {
    return { success: false, error: `Input too large (max ${Math.round(maxSize / 1024 / 1024)}MB)` };
  }

  try {
    const data = JSON.parse(jsonString) as T;
    return { success: true, data };
  } catch (e) {
    return { success: false, error: 'Invalid JSON format' };
  }
}

// ============================================
// IMPORT ANALYSIS SCHEMA VALIDATION
// ============================================

/**
 * Validates the structure of an ImportAnalysis object.
 * Ensures all required fields are present and have correct types.
 */
export function validateImportAnalysis(data: unknown): { valid: true; data: ValidatedImportAnalysis } | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Analysis must be an object' };
  }

  const analysis = data as Record<string, unknown>;

  // Required string fields
  if (!analysis.sourceType || typeof analysis.sourceType !== 'string') {
    return { valid: false, error: 'Missing or invalid sourceType' };
  }
  if (!['obsidian', 'notion', 'generic'].includes(analysis.sourceType)) {
    return { valid: false, error: 'sourceType must be obsidian, notion, or generic' };
  }

  if (!analysis.sourcePath || typeof analysis.sourcePath !== 'string') {
    return { valid: false, error: 'Missing or invalid sourcePath' };
  }

  // Validate sourcePath for security
  const pathValidation = validatePath(analysis.sourcePath);
  if (!pathValidation.valid) {
    return { valid: false, error: `Invalid sourcePath: ${pathValidation.error}` };
  }

  // Required number fields
  const requiredNumbers = ['totalFiles', 'markdownFiles', 'attachments', 'folders'];
  for (const field of requiredNumbers) {
    if (typeof analysis[field] !== 'number' || analysis[field] < 0) {
      return { valid: false, error: `Missing or invalid ${field}` };
    }
  }

  // Required array field: filesToImport
  if (!Array.isArray(analysis.filesToImport)) {
    return { valid: false, error: 'filesToImport must be an array' };
  }

  // Validate each file in filesToImport (limit to prevent DoS)
  if (analysis.filesToImport.length > 100000) {
    return { valid: false, error: 'Too many files in analysis (max 100,000)' };
  }

  for (let i = 0; i < analysis.filesToImport.length; i++) {
    const file = analysis.filesToImport[i] as Record<string, unknown>;
    if (!file || typeof file !== 'object') {
      return { valid: false, error: `Invalid file entry at index ${i}` };
    }
    if (!file.sourcePath || typeof file.sourcePath !== 'string') {
      return { valid: false, error: `Missing sourcePath in file at index ${i}` };
    }
    if (!file.relativePath || typeof file.relativePath !== 'string') {
      return { valid: false, error: `Missing relativePath in file at index ${i}` };
    }
    if (!file.name || typeof file.name !== 'string') {
      return { valid: false, error: `Missing name in file at index ${i}` };
    }
    if (!file.type || !['markdown', 'attachment', 'other'].includes(file.type as string)) {
      return { valid: false, error: `Invalid type in file at index ${i}` };
    }
    if (typeof file.size !== 'number' || file.size < 0) {
      return { valid: false, error: `Invalid size in file at index ${i}` };
    }
  }

  return { valid: true, data: analysis as unknown as ValidatedImportAnalysis };
}

/**
 * Validated ImportAnalysis type - guaranteed to have required fields
 */
export interface ValidatedImportAnalysis {
  sourceType: 'obsidian' | 'notion' | 'generic';
  sourcePath: string;
  totalFiles: number;
  markdownFiles: number;
  attachments: number;
  folders: number;
  filesToImport: Array<{
    sourcePath: string;
    relativePath: string;
    name: string;
    type: 'markdown' | 'attachment' | 'other';
    size: number;
    hasWikiLinks?: boolean;
    hasFrontMatter?: boolean;
    hasCallouts?: boolean;
    hasDataview?: boolean;
  }>;
  // Optional fields
  wikiLinks?: number;
  filesWithWikiLinks?: number;
  frontMatter?: number;
  callouts?: number;
  dataviewBlocks?: number;
  untitledPages?: string[];
  emptyPages?: string[];
  csvDatabases?: number;
  filesWithUUIDs?: number;
}

/**
 * Validates the structure of ImportOptions.
 */
export function validateImportOptions(data: unknown): { valid: true; data: ValidatedImportOptions } | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Options must be an object' };
  }

  const options = data as Record<string, unknown>;

  // All boolean fields (with defaults)
  const booleanFields = [
    'convertWikiLinks',
    'importFrontMatter',
    'convertCallouts',
    'copyAttachments',
    'preserveFolderStructure',
    'skipEmptyPages',
    'createMidlightFiles',
  ];

  for (const field of booleanFields) {
    if (options[field] !== undefined && typeof options[field] !== 'boolean') {
      return { valid: false, error: `${field} must be a boolean` };
    }
  }

  // Notion-specific options
  if (options.removeUUIDs !== undefined && typeof options.removeUUIDs !== 'boolean') {
    return { valid: false, error: 'removeUUIDs must be a boolean' };
  }
  if (options.convertCSVToTables !== undefined && typeof options.convertCSVToTables !== 'boolean') {
    return { valid: false, error: 'convertCSVToTables must be a boolean' };
  }
  if (options.untitledHandling !== undefined &&
      !['number', 'keep', 'prompt'].includes(options.untitledHandling as string)) {
    return { valid: false, error: 'untitledHandling must be number, keep, or prompt' };
  }

  return { valid: true, data: options as unknown as ValidatedImportOptions };
}

/**
 * Validated ImportOptions type
 */
export interface ValidatedImportOptions {
  convertWikiLinks?: boolean;
  importFrontMatter?: boolean;
  convertCallouts?: boolean;
  copyAttachments?: boolean;
  preserveFolderStructure?: boolean;
  skipEmptyPages?: boolean;
  createMidlightFiles?: boolean;
  // Notion-specific
  removeUUIDs?: boolean;
  convertCSVToTables?: boolean;
  untitledHandling?: 'number' | 'keep' | 'prompt';
}

// ============================================
// CSV INJECTION PROTECTION
// ============================================

/**
 * Sanitizes a CSV cell value to prevent formula injection.
 * Excel/Sheets can execute formulas starting with =, +, -, @
 */
export function sanitizeCSVCell(cell: string): string {
  if (!cell || typeof cell !== 'string') {
    return '';
  }

  // Escape pipe characters for markdown tables
  let safe = cell.replace(/\|/g, '\\|');

  // Prevent formula injection
  // Characters that trigger formula execution in spreadsheets
  if (/^[=+\-@]/.test(safe)) {
    safe = "'" + safe;
  }

  // Remove or escape other potentially dangerous characters
  safe = safe.replace(/[\t\r\n]/g, ' '); // Replace tabs and newlines with spaces

  return safe;
}

// ============================================
// URL SCHEME VALIDATION
// ============================================

/**
 * Checks if a URL is an external link (http, https, mailto).
 * Blocks potentially dangerous schemes like javascript:, data:, file:
 */
export function isExternalUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Allowlist of safe external schemes
  const safeSchemes = ['http:', 'https:', 'mailto:'];

  try {
    // Check for scheme-like patterns
    const schemeMatch = url.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/?\/?/);
    if (schemeMatch) {
      const scheme = schemeMatch[1].toLowerCase() + ':';
      return safeSchemes.includes(scheme);
    }

    // Also check for protocol-relative URLs
    if (url.startsWith('//')) {
      return true; // Protocol-relative, will use page protocol
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Checks if a URL scheme is dangerous (javascript:, data:, vbscript:, etc.)
 */
export function isDangerousScheme(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const dangerousSchemes = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
  ];

  const lowerUrl = url.toLowerCase().trim();
  return dangerousSchemes.some(scheme => lowerUrl.startsWith(scheme));
}

// ============================================
// USER-FRIENDLY ERROR MESSAGES
// ============================================

/**
 * Converts system errors to user-friendly messages.
 * Preserves technical details for logging while providing
 * actionable messages for users.
 */
export function formatUserError(error: unknown): { message: string; technicalDetails: string } {
  const technicalDetails = error instanceof Error
    ? error.message
    : String(error);

  let message = 'An unexpected error occurred';

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    if (msg.includes('eacces') || msg.includes('eperm')) {
      message = 'Permission denied - check file access rights';
    } else if (msg.includes('enoent')) {
      message = 'File or folder not found - it may have been moved or deleted';
    } else if (msg.includes('enospc')) {
      message = 'Not enough disk space';
    } else if (msg.includes('eexist')) {
      message = 'A file with this name already exists';
    } else if (msg.includes('eisdir')) {
      message = 'Expected a file but found a folder';
    } else if (msg.includes('enotdir')) {
      message = 'Expected a folder but found a file';
    } else if (msg.includes('emfile') || msg.includes('enfile')) {
      message = 'Too many files open - try closing some applications';
    } else if (msg.includes('ebusy')) {
      message = 'File is in use by another program';
    } else if (msg.includes('etimedout') || msg.includes('timeout')) {
      message = 'Operation timed out - please try again';
    } else if (msg.includes('cancelled') || msg.includes('aborted')) {
      message = 'Operation was cancelled';
    } else {
      // Use a sanitized version of the error message
      message = error.message.replace(/[\x00-\x1f]/g, '').slice(0, 200);
    }
  }

  return { message, technicalDetails };
}

// ============================================
// FILE TYPE VALIDATION
// ============================================

/**
 * Allowed file extensions for import (case-insensitive)
 */
export const ALLOWED_EXTENSIONS = {
  MARKDOWN: new Set(['.md', '.markdown', '.mdown', '.mkd']),
  IMAGE: new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico']),
  ATTACHMENT: new Set(['.pdf', '.mp3', '.mp4', '.wav', '.mov', '.webm', '.ogg']),
  DATA: new Set(['.csv', '.json']),
} as const;

/**
 * Validates file extension is allowed for import
 */
export function isAllowedExtension(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.MARKDOWN.has(ext) ||
         ALLOWED_EXTENSIONS.IMAGE.has(ext) ||
         ALLOWED_EXTENSIONS.ATTACHMENT.has(ext) ||
         ALLOWED_EXTENSIONS.DATA.has(ext);
}

/**
 * Gets the category of a file based on extension
 */
export function getFileCategory(filename: string): 'markdown' | 'image' | 'attachment' | 'data' | 'unknown' {
  const ext = path.extname(filename).toLowerCase();

  if (ALLOWED_EXTENSIONS.MARKDOWN.has(ext)) return 'markdown';
  if (ALLOWED_EXTENSIONS.IMAGE.has(ext)) return 'image';
  if (ALLOWED_EXTENSIONS.ATTACHMENT.has(ext)) return 'attachment';
  if (ALLOWED_EXTENSIONS.DATA.has(ext)) return 'data';

  return 'unknown';
}

// ============================================
// SAFE YAML PARSING (Bomb Protection)
// ============================================

/**
 * Result of safe YAML parsing
 */
export interface SafeYamlResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Counts keys recursively in a parsed YAML object
 */
function countKeys(obj: unknown, depth = 0): { keys: number; maxDepth: number } {
  if (depth > IMPORT_CONFIG.MAX_YAML_DEPTH) {
    return { keys: 0, maxDepth: depth };
  }

  if (obj === null || typeof obj !== 'object') {
    return { keys: 0, maxDepth: depth };
  }

  let keys = 0;
  let maxDepth = depth;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const result = countKeys(item, depth + 1);
      keys += result.keys;
      maxDepth = Math.max(maxDepth, result.maxDepth);
    }
  } else {
    const entries = Object.entries(obj);
    keys = entries.length;
    for (const [, value] of entries) {
      const result = countKeys(value, depth + 1);
      keys += result.keys;
      maxDepth = Math.max(maxDepth, result.maxDepth);
    }
  }

  return { keys, maxDepth };
}

/**
 * Safely parses YAML with protection against:
 * - Billion laughs attack (exponential entity expansion)
 * - Deep nesting attacks
 * - Large document attacks
 * - Alias abuse
 *
 * Uses js-yaml in safe mode (no custom types, no function execution)
 *
 * @param yamlString - The YAML string to parse
 * @param maxSize - Maximum allowed size (default: IMPORT_CONFIG.MAX_YAML_SIZE)
 * @returns SafeYamlResult with parsed data or error message
 */
export function safeParseYaml<T = Record<string, unknown>>(
  yamlString: string,
  maxSize: number = IMPORT_CONFIG.MAX_YAML_SIZE
): SafeYamlResult<T> {
  // Size check
  if (!yamlString || typeof yamlString !== 'string') {
    return { success: false, error: 'Invalid input: expected a string' };
  }

  if (yamlString.length > maxSize) {
    return {
      success: false,
      error: `YAML content too large (${Math.round(yamlString.length / 1024)}KB exceeds ${Math.round(maxSize / 1024)}KB limit)`,
    };
  }

  // Check for excessive aliases (potential bomb)
  // Count alias definitions (*name) and references (&name)
  const aliasMatches = yamlString.match(/[&*][a-zA-Z_][a-zA-Z0-9_]*/g) || [];
  if (aliasMatches.length > IMPORT_CONFIG.MAX_YAML_ALIASES * 2) {
    return {
      success: false,
      error: `Too many YAML aliases (${aliasMatches.length} exceeds limit of ${IMPORT_CONFIG.MAX_YAML_ALIASES * 2})`,
    };
  }

  try {
    // Parse with js-yaml in safe mode
    // YAML_SCHEMA (formerly DEFAULT_SAFE_SCHEMA) only allows standard YAML types
    // No !!js/function, !!python/object, etc.
    const parsed = yaml.load(yamlString, {
      schema: yaml.CORE_SCHEMA, // Most restrictive - only JSON-compatible types
      json: true,               // Duplicate keys will throw
    });

    // Post-parse validation
    if (parsed !== null && typeof parsed === 'object') {
      const { keys, maxDepth } = countKeys(parsed);

      if (maxDepth > IMPORT_CONFIG.MAX_YAML_DEPTH) {
        return {
          success: false,
          error: `YAML nesting too deep (depth ${maxDepth} exceeds limit of ${IMPORT_CONFIG.MAX_YAML_DEPTH})`,
        };
      }

      if (keys > IMPORT_CONFIG.MAX_YAML_KEYS) {
        return {
          success: false,
          error: `Too many keys in YAML (${keys} exceeds limit of ${IMPORT_CONFIG.MAX_YAML_KEYS})`,
        };
      }
    }

    return { success: true, data: parsed as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown YAML parsing error';
    return { success: false, error: `Invalid YAML: ${message}` };
  }
}

/**
 * Parses YAML front-matter from markdown content safely.
 *
 * Extracts content between --- markers and parses it as YAML
 * with full bomb protection.
 *
 * @param content - Full markdown content with potential front-matter
 * @returns Object with parsed frontMatter and remaining content
 */
export function safeParseFrontMatter(content: string): {
  frontMatter: Record<string, unknown> | null;
  content: string;
  error?: string;
} {
  if (!content || typeof content !== 'string') {
    return { frontMatter: null, content: content || '' };
  }

  // Quick check - front-matter must start at beginning
  if (!content.startsWith('---')) {
    return { frontMatter: null, content };
  }

  // Find the closing ---
  const endMatch = content.indexOf('\n---', 3);
  if (endMatch === -1) {
    return { frontMatter: null, content };
  }

  // Extract YAML content (between the --- markers)
  const yamlContent = content.slice(4, endMatch).trim();

  // Empty front-matter
  if (!yamlContent) {
    const remainingContent = content.slice(endMatch + 4);
    return { frontMatter: {}, content: remainingContent };
  }

  // Parse the YAML safely
  const result = safeParseYaml<Record<string, unknown>>(yamlContent);

  if (!result.success) {
    return {
      frontMatter: null,
      content,
      error: result.error,
    };
  }

  // Ensure we got an object (not a scalar or array)
  if (result.data === null || typeof result.data !== 'object' || Array.isArray(result.data)) {
    return {
      frontMatter: null,
      content,
      error: 'Front-matter must be a YAML object (key-value pairs)',
    };
  }

  const remainingContent = content.slice(endMatch + 4);
  return { frontMatter: result.data, content: remainingContent };
}
