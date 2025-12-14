/**
 * LLM Service
 *
 * Handles LLM API calls to the Midlight backend.
 * - Chat completions with streaming support
 * - Function calling for AI agents
 * - Quota tracking
 */

import { net, BrowserWindow } from 'electron';
import { getAccessToken } from './authService';

// API endpoint
const API_BASE = process.env.MIDLIGHT_API_URL || 'https://midlight.ai';

// Types
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  provider: 'openai' | 'anthropic';
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  requestType?: 'chat' | 'inline_edit' | 'agent';
}

export interface ChatResponse {
  id: string;
  provider: string;
  model: string;
  content: string;
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ChatWithToolsResponse extends ChatResponse {
  toolCalls: ToolCall[];
}

export interface AvailableModels {
  openai: Array<{ id: string; name: string; tier: string }>;
  anthropic: Array<{ id: string; name: string; tier: string }>;
}

export interface QuotaInfo {
  tier: string;
  limit: number | null;
  used: number;
  remaining: number | null;
}

/**
 * Make a chat completion request
 */
export async function chat(options: ChatOptions): Promise<ChatResponse> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await makeAuthenticatedRequest('/api/llm/chat', {
    method: 'POST',
    body: JSON.stringify({
      ...options,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 429) {
      const err = new Error(error.error || 'Quota exceeded');
      (err as any).code = 'QUOTA_EXCEEDED';
      (err as any).quota = error.quota;
      throw err;
    }
    throw new Error(error.error || 'Chat request failed');
  }

  return response.json();
}

/**
 * Make a streaming chat completion request
 * Sends chunks via IPC to the renderer
 */
export async function chatStream(
  options: ChatOptions,
  channelId: string,
  window: BrowserWindow
): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    window.webContents.send(`llm:stream:${channelId}:error`, { error: 'Not authenticated' });
    return;
  }

  return new Promise((resolve) => {
    const url = `${API_BASE}/api/llm/chat`;

    const request = net.request({
      method: 'POST',
      url,
    });

    request.setHeader('Content-Type', 'application/json');
    request.setHeader('Authorization', `Bearer ${token}`);
    request.setHeader('X-Client-Type', 'desktop'); // Exempt from CSRF checks

    let buffer = '';

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        let errorData = '';
        response.on('data', (chunk) => {
          errorData += chunk.toString();
        });
        response.on('end', () => {
          try {
            const error = JSON.parse(errorData);
            window.webContents.send(`llm:stream:${channelId}:error`, error);
          } catch {
            window.webContents.send(`llm:stream:${channelId}:error`, {
              error: `HTTP ${response.statusCode}`,
            });
          }
          resolve();
        });
        return;
      }

      response.on('data', (chunk) => {
        buffer += chunk.toString();

        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();

            if (data === '[DONE]') {
              window.webContents.send(`llm:stream:${channelId}:done`);
              continue;
            }

            try {
              const parsed = JSON.parse(data);

              if (parsed.error) {
                window.webContents.send(`llm:stream:${channelId}:error`, parsed);
              } else if (parsed.content) {
                window.webContents.send(`llm:stream:${channelId}:chunk`, {
                  content: parsed.content,
                });
              } else if (parsed.done) {
                window.webContents.send(`llm:stream:${channelId}:usage`, {
                  usage: parsed.usage,
                });
              }
            } catch (e) {
              // Ignore parse errors for incomplete JSON
            }
          }
        }
      });

      response.on('end', () => {
        // Process any remaining data in buffer
        if (buffer.startsWith('data: ')) {
          const data = buffer.slice(6).trim();
          if (data && data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                window.webContents.send(`llm:stream:${channelId}:chunk`, {
                  content: parsed.content,
                });
              }
            } catch {
              // Ignore
            }
          }
        }
        resolve();
      });
    });

    request.on('error', (error) => {
      window.webContents.send(`llm:stream:${channelId}:error`, {
        error: error.message,
      });
      resolve();
    });

    request.write(
      JSON.stringify({
        ...options,
        stream: true,
      })
    );
    request.end();
  });
}

/**
 * Make a chat request with tool/function calling
 */
export async function chatWithTools(
  options: ChatOptions & { tools: ToolDefinition[] }
): Promise<ChatWithToolsResponse> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await makeAuthenticatedRequest('/api/llm/chat-with-tools', {
    method: 'POST',
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 429) {
      const err = new Error(error.error || 'Quota exceeded');
      (err as any).code = 'QUOTA_EXCEEDED';
      (err as any).quota = error.quota;
      throw err;
    }
    throw new Error(error.error || 'Chat with tools failed');
  }

  return response.json();
}

/**
 * Get available models for the user's subscription tier
 * Returns empty arrays if not authenticated (fails silently)
 */
export async function getModels(): Promise<AvailableModels> {
  const token = await getAccessToken();
  if (!token) {
    // Return empty models if not authenticated (don't throw)
    return { openai: [], anthropic: [] };
  }

  try {
    const response = await makeAuthenticatedRequest('/api/llm/models');
    console.log('[LLM] Models API response status:', response.status);

    if (!response.ok) {
      console.error('[LLM] Failed to get models:', response.status);
      return { openai: [], anthropic: [] };
    }

    const data = await response.json();
    console.log('[LLM] Models API response data:', JSON.stringify(data));
    return data.models;
  } catch (error) {
    console.error('[LLM] Error fetching models:', error);
    return { openai: [], anthropic: [] };
  }
}

/**
 * Get current quota status
 */
export async function getQuota(): Promise<QuotaInfo> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await makeAuthenticatedRequest('/api/llm/quota');

  if (!response.ok) {
    throw new Error('Failed to get quota');
  }

  return response.json();
}

/**
 * Check if LLM service is available
 */
export async function getStatus(): Promise<{ status: string; providers: Record<string, boolean> }> {
  const token = await getAccessToken();
  if (!token) {
    return { status: 'unauthenticated', providers: {} };
  }

  try {
    const response = await makeAuthenticatedRequest('/api/llm/status');

    if (!response.ok) {
      return { status: 'error', providers: {} };
    }

    return response.json();
  } catch {
    return { status: 'offline', providers: {} };
  }
}

// Helper function for authenticated requests
async function makeAuthenticatedRequest(
  path: string,
  options: { method?: string; body?: string } = {}
): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  const token = await getAccessToken();

  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${path}`;

    const request = net.request({
      method: options.method || 'GET',
      url,
    });

    request.setHeader('Content-Type', 'application/json');
    request.setHeader('X-Client-Type', 'desktop'); // Exempt from CSRF checks
    if (token) {
      request.setHeader('Authorization', `Bearer ${token}`);
    }

    let responseData = '';

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        responseData += chunk.toString();
      });

      response.on('end', () => {
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 300,
          status: response.statusCode,
          json: async () => JSON.parse(responseData),
        });
      });
    });

    request.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      request.write(options.body);
    }

    request.end();
  });
}
