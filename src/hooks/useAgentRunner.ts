import { useCallback, useRef } from 'react';
import { useAgentStore } from '../store/useAgentStore';
import { useAIStore } from '../store/useAIStore';
import { useFileSystem } from '../store/useFileSystem';

// Maximum iterations to prevent infinite loops
const MAX_ITERATIONS = 10;

// Timeout constants
const TOTAL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes total
const LLM_CALL_TIMEOUT_MS = 60 * 1000; // 60 seconds per LLM call

// Maximum result length to send back to LLM (save tokens)
const MAX_RESULT_LENGTH = 2000;

// System prompt for the agent
const AGENT_SYSTEM_PROMPT = `You are an AI writing assistant that helps users with their documents in a writing workspace.

You have access to tools that can manage documents in the user's workspace:
- list_documents: List all documents in a folder
- read_document: Read the content of a document
- create_document: Create a new document with content
- edit_document: Edit an existing document (replace, append, or prepend)
- move_document: Move or rename a document
- delete_document: Delete a document (moves to trash)
- create_folder: Create a new folder
- search_documents: Search for text across all documents

WHEN TO USE TOOLS vs RESPOND DIRECTLY:

Use tools when the user explicitly wants to:
- Create, write, or make a new document (use create_document)
- Edit, update, modify, or change an existing document (use edit_document)
- Move, rename, or reorganize documents (use move_document)
- Delete or remove a document (use delete_document)
- Find, search, or look for documents (use search_documents or list_documents)
- See what documents exist (use list_documents)

Respond directly WITHOUT tools when the user wants:
- Writing help, brainstorming, or feedback (just answer them)
- Questions about their document content (use context provided, or read_document if needed)
- General conversation or questions
- Suggestions or ideas (just provide them)
- Help drafting text that they'll copy themselves

Examples:
- "Write me a poem about hope" → Respond with the poem directly
- "Create a document called Hope with a poem" → Use create_document tool
- "What documents do I have?" → Use list_documents tool
- "Help me improve this paragraph" → Respond with suggestions directly
- "Add a new section about pricing to my proposal" → Use edit_document to append

IMPORTANT:
- Paths are relative to the workspace root
- Use forward slashes for paths (e.g., "folder/document.md")
- Document files should have .md extension
- For edits, use the appropriate operation: "replace" for full rewrites, "append" to add at end, "prepend" to add at beginning`;

/**
 * Truncate tool results to save LLM context tokens
 */
function formatToolResult(result: unknown): string {
  const str = JSON.stringify(result, null, 2);
  if (str.length > MAX_RESULT_LENGTH) {
    return str.substring(0, MAX_RESULT_LENGTH) + '\n...[result truncated]';
  }
  return str;
}

/**
 * Create a timeout promise that rejects after the specified duration
 */
function createTimeout<T>(ms: number, message: string): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

export function useAgentRunner() {
  const {
    status,
    workspaceRoot,
    startExecution,
    setThinking,
    setCurrentTool,
    addPendingChange,
    finishExecution,
    setError,
    reset,
  } = useAgentStore();

  const { selectedProvider, selectedModel, temperature } = useAIStore();
  const { rootDir, loadDir } = useFileSystem();

  // Track if agent is currently running
  const isRunningRef = useRef(false);

  // Run the agent with a user prompt
  const runAgent = useCallback(
    async (
      userPrompt: string,
      documentContext?: string
    ): Promise<{ success: boolean; response?: string; error?: string }> => {
      // Prevent concurrent runs
      if (isRunningRef.current) {
        return { success: false, error: 'Agent is already running' };
      }

      const workspace = workspaceRoot || rootDir;
      if (!workspace) {
        return { success: false, error: 'No workspace open' };
      }

      isRunningRef.current = true;
      startExecution();
      const startTime = Date.now();

      try {
        // Get available tools
        const tools = await window.electronAPI.agent.getTools();

        // Build initial messages
        const messages: AgentMessage[] = [
          {
            role: 'system',
            content: documentContext
              ? `${AGENT_SYSTEM_PROMPT}\n\nCurrent document context:\n${documentContext}`
              : AGENT_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ];

        let iterations = 0;
        let finalResponse = '';

        // Agent loop - continues until LLM doesn't return tool calls
        while (iterations < MAX_ITERATIONS) {
          iterations++;

          // Check total timeout
          if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
            throw new Error('Agent execution timed out after 5 minutes');
          }

          // Check if cancelled
          if (!isRunningRef.current) {
            throw new Error('Agent execution was cancelled');
          }

          setThinking();

          // Call LLM with tools (with timeout)
          const response = await Promise.race([
            window.electronAPI.llm.chatWithTools({
              provider: selectedProvider,
              model: selectedModel,
              messages: messages.map((m) => ({
                role: m.role === 'tool' ? 'user' : m.role,
                content:
                  m.role === 'tool'
                    ? `Tool result for ${m.toolCallId}:\n${m.content}`
                    : m.content,
              })),
              tools,
              temperature,
              requestType: 'agent',
            }),
            createTimeout<never>(LLM_CALL_TIMEOUT_MS, 'LLM request timed out'),
          ]);

          // Check if there are tool calls
          if (!response.toolCalls || response.toolCalls.length === 0) {
            // No tool calls - agent is done
            finalResponse = response.content || '';
            break;
          }

          // Add assistant message with tool calls
          messages.push({
            role: 'assistant',
            content: response.content || '',
            toolCalls: response.toolCalls,
          });

          // Execute each tool call
          for (const toolCall of response.toolCalls) {
            // Check cancellation between tool calls
            if (!isRunningRef.current) {
              throw new Error('Agent execution was cancelled');
            }

            setCurrentTool(toolCall.name);

            // Execute the tool
            const result = await window.electronAPI.agent.executeTools(
              workspace,
              [
                {
                  id: toolCall.id,
                  name: toolCall.name,
                  arguments: toolCall.arguments,
                },
              ]
            );

            if (result.success && result.results) {
              const toolResult = result.results[0];

              // Add tool result to messages (truncated to save tokens)
              messages.push({
                role: 'tool',
                content: toolResult.success
                  ? formatToolResult(toolResult.result)
                  : `Error: ${toolResult.error}`,
                toolCallId: toolCall.id,
              });

              // Track changes for the UI
              if (toolResult.change) {
                addPendingChange(toolCall.id, toolResult.change);
              }
            } else {
              // Tool execution failed
              messages.push({
                role: 'tool',
                content: `Error: ${result.error || 'Tool execution failed'}`,
                toolCallId: toolCall.id,
              });
            }
          }

          setCurrentTool(null);
        }

        // Warn if max iterations reached
        if (iterations >= MAX_ITERATIONS && !finalResponse) {
          finalResponse = '[Agent stopped: reached maximum iterations]';
        }

        // Refresh the file tree if any changes were made
        const { pendingChanges } = useAgentStore.getState();
        if (pendingChanges.length > 0 && rootDir) {
          await loadDir(rootDir);
        }

        finishExecution();
        return { success: true, response: finalResponse };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        // Always reset running state to prevent race conditions
        isRunningRef.current = false;
      }
    },
    [
      workspaceRoot,
      rootDir,
      selectedProvider,
      selectedModel,
      temperature,
      startExecution,
      setThinking,
      setCurrentTool,
      addPendingChange,
      finishExecution,
      setError,
      loadDir,
    ]
  );

  // Cancel the current agent run
  const cancelAgent = useCallback(() => {
    isRunningRef.current = false;
    reset();
  }, [reset]);

  return {
    runAgent,
    cancelAgent,
    isRunning: status === 'thinking' || status === 'executing',
    status,
  };
}
