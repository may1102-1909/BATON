#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import dotenv from 'dotenv';
import { pushMemory, queryContext } from './api.js';

// Load environment variables (.env file in current or parent directory)
dotenv.config();

// Initialize Baton MCP Server
const server = new McpServer({
  name: 'baton-mcp-server',
  version: '0.1.0'
});

/**
 * Tool 1: log_decision
 * Records architectural, framework, or library changes with rationale, alternatives, and affected files.
 */
server.tool(
  'log_decision',
  'Log an architectural decision, library change, or significant design choice to Baton knowledge memory.',
  {
    decision: z
      .string()
      .describe('Summary of the architectural decision or choice made'),
    reason: z
      .string()
      .describe('Rationale explaining why this decision was made and what prompted it'),
    alternatives: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe('Alternative options considered and rejected'),
    files_affected: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe('File paths, components, or modules impacted by this change')
  },
  async ({ decision, reason, alternatives, files_affected }) => {
    const formattedAlternatives = Array.isArray(alternatives)
      ? alternatives
      : alternatives
      ? [alternatives]
      : [];

    const formattedFiles = Array.isArray(files_affected)
      ? files_affected
      : files_affected
      ? [files_affected]
      : [];

    const result = await pushMemory('decision', {
      decision,
      reason,
      alternatives: formattedAlternatives,
      files_affected: formattedFiles
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: result.success ? 'recorded' : 'recorded_offline',
              message: result.message,
              data: {
                decision,
                reason,
                alternatives: formattedAlternatives,
                files_affected: formattedFiles
              }
            },
            null,
            2
          )
        }
      ]
    };
  }
);

/**
 * Tool 2: log_blocker
 * Records bugs, blockers, obstacles, and unfinished tasks along with current status and workaround notes.
 */
server.tool(
  'log_blocker',
  'Log a blocker, critical bug, unfinished work, or technical obstacle to Baton memory.',
  {
    problem: z
      .string()
      .describe('Description of the issue, bug, limitation, or blocking obstacle'),
    status: z
      .enum(['active', 'investigating', 'blocked', 'workaround_applied', 'resolved'])
      .default('active')
      .describe('Current status of the blocker'),
    workaround_notes: z
      .string()
      .optional()
      .describe('Temporary workaround, debugging notes, or recommended next steps')
  },
  async ({ problem, status = 'active', workaround_notes = '' }) => {
    const result = await pushMemory('blocker', {
      problem,
      status,
      workaround_notes
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: result.success ? 'recorded' : 'recorded_offline',
              message: result.message,
              data: {
                problem,
                status,
                workaround_notes
              }
            },
            null,
            2
          )
        }
      ]
    };
  }
);

/**
 * Tool 3: get_context
 * Searches Baton backend memory for relevant decisions, past blockers, and architectural context.
 */
server.tool(
  'get_context',
  'Search Baton continuity memory for relevant architectural decisions, past blockers, and project context.',
  {
    query: z
      .string()
      .describe('Search query or question regarding the architecture, codebase, or decisions')
  },
  async ({ query }) => {
    const result = await queryContext(query);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              query,
              success: result.success,
              message: result.message,
              context: result.data || []
            },
            null,
            2
          )
        }
      ]
    };
  }
);

/**
 * Main server startup using StdioServerTransport
 */
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Baton MCP Server is running over StdioServerTransport.');
}

run().catch((error) => {
  console.error('Fatal error running Baton MCP Server:', error);
  process.exit(1);
});
