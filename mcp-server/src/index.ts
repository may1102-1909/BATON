#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  answerExitQuestion,
  getExitInterviews,
  getFileContext,
  getGithubActivity,
  pushMemory,
  queryContext
} from './api.js';
import { redactData } from './redact.js';
import { bootstrapProject } from './snapshot.js';

dotenv.config();
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const server = new McpServer({ name: 'baton-mcp-server', version: '0.1.0' });

function toolResult(result: { success: boolean; message: string; data?: unknown }) {
  return {
    isError: !result.success,
    content: [{ type: 'text' as const, text: JSON.stringify(redactData(result), null, 2) }]
  };
}

server.tool(
  'log_decision',
  'Record an architectural decision, library change, or significant design choice in Baton.',
  {
    decision: z.string().min(1).max(4000),
    reason: z.string().min(1).max(4000),
    alternatives: z.union([z.string().max(2000), z.array(z.string().max(1000)).max(20)]).optional(),
    files_affected: z.union([z.string().max(2000), z.array(z.string().max(500)).max(100)]).optional()
  },
  async ({ decision, reason, alternatives, files_affected }) => {
    const payload = redactData({
      decision,
      reason,
      alternatives: Array.isArray(alternatives) ? alternatives : alternatives ? [alternatives] : [],
      files_affected: Array.isArray(files_affected) ? files_affected : files_affected ? [files_affected] : []
    });
    return toolResult(await pushMemory('decision', payload));
  }
);

server.tool(
  'log_blocker',
  'Record a blocker, bug, temporary workaround, or unfinished task in Baton.',
  {
    problem: z.string().min(1).max(4000),
    status: z.enum(['active', 'investigating', 'blocked', 'workaround_applied', 'resolved']).default('active'),
    workaround_notes: z.string().max(4000).optional()
  },
  async ({ problem, status = 'active', workaround_notes = '' }) =>
    toolResult(await pushMemory('blocker', redactData({ problem, status, workaround_notes })))
);

server.tool(
  'get_context',
  'Search repository-scoped Baton memory for relevant decisions, blockers, and codebase context.',
  { query: z.string().min(1).max(1000) },
  async ({ query }) => toolResult(await queryContext(query))
);

server.tool(
  'bootstrap_project',
  'Send an initial safe snapshot of tracked-file names, bounded architecture hints, and file hashes; later calls send only incremental changes. Never reads untracked files or environment/credential files.',
  {},
  async () => toolResult(await bootstrapProject())
);

server.tool(
  'save_memory',
  'Save one new decision, blocker, context note, or concise change delta from this session. Do not submit full transcripts, prior history, or unchanged repository content.',
  {
    type: z.enum(['context', 'change', 'decision', 'blocker']),
    content: z.string().min(1).max(10_000)
  },
  async ({ type, content }) => toolResult(await pushMemory(type, { content: redactData(content) }))
);

server.tool(
  'get_file_context',
  'Retrieve codebase understanding, architecture summary, and recent decisions touching a specific file path.',
  { path: z.string().min(1).max(500) },
  async ({ path }) => toolResult(await getFileContext(path))
);

server.tool(
  'sync_history',
  'Trigger an on-demand synchronization of the latest git commit, changed file summaries, and agent conversation turns.',
  {},
  async () => {
    try {
      const { syncCommit, syncTranscripts } = await import('./cli.js');
      const cRes = await syncCommit('HEAD');
      const tRes = await syncTranscripts();
      return toolResult({
        success: true,
        message: `Synchronized commit ${cRes.commitSha.slice(0, 8)} (${cRes.filesSynced} files) and ${tRes.messagesSynced} transcript turns.`
      });
    } catch (err) {
      return toolResult({
        success: false,
        message: err instanceof Error ? err.message : 'Sync history failed'
      });
    }
  }
);

server.tool(
  'github_activity',
  'Retrieve GitHub/repository tracking state and recent sources for the configured repository.',
  {},
  async () => toolResult(await getGithubActivity())
);

server.tool(
  'get_exit_interview',
  'Retrieve assigned exit-interview questions for the configured repository.',
  {},
  async () => toolResult(await getExitInterviews())
);

server.tool(
  'answer_exit_question',
  'Submit an answer to an assigned exit-interview question.',
  {
    interview_id: z.string().min(1).max(200),
    question_id: z.string().min(1).max(200),
    answer: z.string().min(1).max(10_000)
  },
  async ({ interview_id, question_id, answer }) =>
    toolResult(await answerExitQuestion(interview_id, question_id, answer))
);

server.prompt(
  'baton_bootstrap',
  'Bootstrap and maintain Baton project continuity',
  {},
  async () => ({
    description: 'Use Baton tools for concise repository continuity; never store full conversation transcripts or secrets.',
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: [
          'At the beginning of a new project session, call bootstrap_project first, then get_context with a focused question about the task or current blockers.',
          'After each substantive turn, save only new decision, blocker, context, or change deltas. Use log_decision and log_blocker when their compatibility-specific fields apply. Never save full transcripts, secrets, or unchanged history.',
          'Before ending a session with assigned questions, call get_exit_interview and answer_exit_question for the questions you can answer.',
          'This prompt is guidance only: MCP clients generally do not guarantee that tools run automatically on every turn. Configure the prompt/rules in the client and verify tool use in the conversation.'
        ].join('\n\n')
      }
    }]
  })
);

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Baton MCP server connected over stdio.');
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error';
  console.error('Baton MCP server failed to start:', redactData(message));
  process.exit(1);
});