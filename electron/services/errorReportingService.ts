/**
 * Error Reporting Service
 *
 * Sends anonymized error reports to help improve the application.
 * - Opt-in only (respects user privacy)
 * - No personally identifiable information collected
 * - Only sends data necessary for debugging
 */

import { app } from 'electron';
import { net } from 'electron';

// Endpoint for error reports
const ERROR_REPORT_ENDPOINT = 'https://midlight.ai/api/error-report';

// Types of errors we track
export type ErrorCategory =
  | 'update'
  | 'import'
  | 'file_system'
  | 'crash'
  | 'uncaught';

export interface ErrorReport {
  // Error identification
  category: ErrorCategory;
  errorType: string;
  message: string;

  // Context (no PII)
  appVersion: string;
  platform: NodeJS.Platform;
  arch: string;
  osVersion: string;

  // Optional additional context
  context?: Record<string, string | number | boolean>;

  // Timestamp
  timestamp: string;

  // Anonymous session ID (regenerated each app launch)
  sessionId: string;
}

// Generate a random session ID for this app instance
// This helps correlate errors within a session without tracking users
let sessionId: string | null = null;
function getSessionId(): string {
  if (!sessionId) {
    sessionId = Math.random().toString(36).substring(2, 15);
  }
  return sessionId;
}

// In-memory flag for whether reporting is enabled
// Default to true (opt-out), synced from renderer preferences on startup
let reportingEnabled = true;

/**
 * Set whether error reporting is enabled
 */
export function setErrorReportingEnabled(enabled: boolean): void {
  reportingEnabled = enabled;
}

/**
 * Check if error reporting is enabled
 */
export function isErrorReportingEnabled(): boolean {
  return reportingEnabled;
}

/**
 * Send an error report
 *
 * @param category - The category of error
 * @param errorType - Specific type within category (e.g., 'checksum', 'network')
 * @param message - Error message (sanitized, no file paths or user data)
 * @param context - Optional additional context
 */
export async function reportError(
  category: ErrorCategory,
  errorType: string,
  message: string,
  context?: Record<string, string | number | boolean>
): Promise<void> {
  // Don't send if reporting is disabled
  if (!reportingEnabled) {
    console.log('[ErrorReporting] Skipped (disabled):', category, errorType);
    return;
  }

  // Sanitize the message - remove potential file paths and user data
  const sanitizedMessage = sanitizeErrorMessage(message);

  const report: ErrorReport = {
    category,
    errorType,
    message: sanitizedMessage,
    appVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    osVersion: process.getSystemVersion(),
    context,
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
  };

  try {
    const request = net.request({
      method: 'POST',
      url: ERROR_REPORT_ENDPOINT,
    });

    request.setHeader('Content-Type', 'application/json');

    // Don't wait for response - fire and forget
    request.on('error', (error) => {
      // Silently fail - we don't want error reporting to cause issues
      console.log('[ErrorReporting] Failed to send:', error.message);
    });

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        console.log('[ErrorReporting] Server returned:', response.statusCode);
      }
    });

    request.write(JSON.stringify(report));
    request.end();

    console.log('[ErrorReporting] Sent:', category, errorType);
  } catch (error) {
    // Silently fail
    console.log('[ErrorReporting] Exception:', error);
  }
}

/**
 * Sanitize error messages to remove potential PII
 */
function sanitizeErrorMessage(message: string): string {
  if (!message) return '';

  let sanitized = message;

  // Remove file paths (Unix-style)
  sanitized = sanitized.replace(/\/Users\/[^\s,)]+/g, '/Users/[REDACTED]');
  sanitized = sanitized.replace(/\/home\/[^\s,)]+/g, '/home/[REDACTED]');

  // Remove file paths (Windows-style)
  sanitized = sanitized.replace(/[A-Z]:\\Users\\[^\s,)]+/gi, 'C:\\Users\\[REDACTED]');
  sanitized = sanitized.replace(/[A-Z]:\\[^\s,)]+/gi, '[PATH_REDACTED]');

  // Remove potential email addresses
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');

  // Limit message length
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 500) + '...[truncated]';
  }

  return sanitized;
}

/**
 * Report an update error with relevant context
 */
export function reportUpdateError(
  errorType: 'checksum' | 'network' | 'download' | 'install' | 'unknown',
  message: string,
  additionalContext?: {
    targetVersion?: string;
    currentVersion?: string;
    downloadUrl?: string;
  }
): void {
  // Don't include full download URL, just the filename
  const context: Record<string, string | number | boolean> = {};

  if (additionalContext?.targetVersion) {
    context.targetVersion = additionalContext.targetVersion;
  }
  if (additionalContext?.currentVersion) {
    context.currentVersion = additionalContext.currentVersion;
  }
  if (additionalContext?.downloadUrl) {
    // Only include filename, not full URL
    try {
      const url = new URL(additionalContext.downloadUrl);
      context.filename = url.pathname.split('/').pop() || 'unknown';
    } catch {
      context.filename = 'unknown';
    }
  }

  reportError('update', errorType, message, context);
}

/**
 * Report an import error with relevant context
 */
export function reportImportError(
  errorType:
    | 'path_traversal'
    | 'file_read'
    | 'file_write'
    | 'parse'
    | 'disk_space'
    | 'checksum'
    | 'rollback'
    | 'cancelled'
    | 'unknown',
  message: string,
  additionalContext?: {
    sourceType?: 'obsidian' | 'notion' | 'generic';
    fileCount?: number;
    phase?: 'analyzing' | 'converting' | 'copying' | 'finalizing' | 'complete';
    errorCount?: number;
  }
): void {
  const context: Record<string, string | number | boolean> = {};

  if (additionalContext?.sourceType) {
    context.sourceType = additionalContext.sourceType;
  }
  if (additionalContext?.fileCount !== undefined) {
    context.fileCount = additionalContext.fileCount;
  }
  if (additionalContext?.phase) {
    context.phase = additionalContext.phase;
  }
  if (additionalContext?.errorCount !== undefined) {
    context.errorCount = additionalContext.errorCount;
  }

  reportError('import', errorType, message, context);
}
