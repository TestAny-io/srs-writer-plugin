/**
 * MCP JSON-RPC Client
 *
 * Handles communication with MCP servers via JSON-RPC protocol.
 * Supports both stdio and HTTP transports as per MCP specification.
 *
 * JSON-RPC 2.0 Protocol:
 * - Request: { jsonrpc: "2.0", id: number, method: string, params: object }
 * - Response: { jsonrpc: "2.0", id: number, result: any } or { jsonrpc: "2.0", id: number, error: object }
 */

import { Logger } from '../../utils/logger';
import { MCPServerInfo } from './mcp-types';
import { spawn, ChildProcess } from 'child_process';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class MCPClient {
  private logger = Logger.getInstance();
  private requestId = 0;
  private activeProcesses: Map<string, ChildProcess> = new Map();

  /**
   * List available tools on an MCP server
   * @returns Array of tool names
   */
  async listTools(server: MCPServerInfo): Promise<string[]> {
    try {
      this.logger.info(`📋 Listing tools for MCP server: ${server.name}`);

      const response = await this.sendRequest(server, 'tools/list', {});

      // Parse tool names from response
      if (response.result && Array.isArray(response.result.tools)) {
        return response.result.tools.map((tool: any) => tool.name);
      }

      return [];
    } catch (error) {
      this.logger.error(`Failed to list tools: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Invoke a tool on an MCP server
   * @throws Error if invocation fails
   */
  async invokeTool(
    server: MCPServerInfo,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<any> {
    try {
      this.logger.info(`🔧 Invoking MCP tool: ${server.name}/${toolName}`);

      const response = await this.sendRequest(server, 'tools/call', {
        name: toolName,
        arguments: parameters
      });

      if (response.error) {
        throw new Error(`MCP tool error: ${response.error.message}`);
      }

      return response.result;
    } catch (error) {
      this.logger.error(`MCP tool invocation failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Check if MCP server is healthy
   * @returns true if server responds, false otherwise
   */
  async healthCheck(server: MCPServerInfo): Promise<boolean> {
    try {
      // Try to list tools as a health check
      await this.listTools(server);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Send a JSON-RPC request to an MCP server
   * Handles both stdio and HTTP transports
   */
  private async sendRequest(
    server: MCPServerInfo,
    method: string,
    params: any
  ): Promise<JsonRpcResponse> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params
    };

    // Route to appropriate transport
    if (server.config.type === 'http') {
      return await this.sendHttpRequest(server, request);
    } else {
      // Default to stdio
      return await this.sendStdioRequest(server, request);
    }
  }

  /**
   * Send request via HTTP transport
   */
  private async sendHttpRequest(
    server: MCPServerInfo,
    request: JsonRpcRequest
  ): Promise<JsonRpcResponse> {
    if (!server.config.url) {
      throw new Error('HTTP MCP server must have a URL');
    }

    const response = await fetch(server.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    const jsonResponse = await response.json() as JsonRpcResponse;
    return jsonResponse;
  }

  /**
   * Send request via stdio transport
   * This is more complex as it requires spawning a process and managing stdio communication
   */
  private async sendStdioRequest(
    server: MCPServerInfo,
    request: JsonRpcRequest
  ): Promise<JsonRpcResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MCP request timeout (30s)'));
      }, 30000);

      try {
        // Spawn the MCP server process
        const childProcess = spawn(server.config.command, server.config.args || [], {
          env: { ...process.env, ...server.config.env },
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdoutData = '';
        let stderrData = '';

        // Collect stdout
        childProcess.stdout?.on('data', (data: Buffer) => {
          stdoutData += data.toString();
        });

        // Collect stderr (for debugging)
        childProcess.stderr?.on('data', (data: Buffer) => {
          stderrData += data.toString();
          this.logger.debug(`MCP stderr: ${data.toString()}`);
        });

        // Handle process exit
        childProcess.on('close', (code: number | null) => {
          clearTimeout(timeout);

          if (code !== 0) {
            reject(new Error(`MCP process exited with code ${code}. stderr: ${stderrData}`));
            return;
          }

          try {
            // Parse JSON-RPC response from stdout
            const lines = stdoutData.split('\n').filter(line => line.trim());

            // Find the response matching our request ID
            for (const line of lines) {
              try {
                const response: JsonRpcResponse = JSON.parse(line);
                if (response.id === request.id) {
                  resolve(response);
                  return;
                }
              } catch (e) {
                // Skip invalid JSON lines
                continue;
              }
            }

            reject(new Error('No matching JSON-RPC response found'));
          } catch (error) {
            reject(new Error(`Failed to parse MCP response: ${(error as Error).message}`));
          }
        });

        // Handle process errors
        childProcess.on('error', (error: Error) => {
          clearTimeout(timeout);
          reject(new Error(`Failed to spawn MCP process: ${error.message}`));
        });

        // Send request to stdin
        childProcess.stdin?.write(JSON.stringify(request) + '\n');
        childProcess.stdin?.end();

      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Cleanup: terminate all active processes
   */
  dispose(): void {
    for (const [name, process] of this.activeProcesses) {
      this.logger.debug(`Terminating MCP process: ${name}`);
      process.kill();
    }
    this.activeProcesses.clear();
  }
}
