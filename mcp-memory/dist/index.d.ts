#!/usr/bin/env node
/**
 * Tars memory MCP server.
 *
 * The point of this server is that it is not Claude-specific. Every CLI Tars
 * can run registers it, so an agent on Codex, Gemini, Grok, opencode or pi
 * reaches the same memory as an agent on Claude: the project's own memory
 * files, what other sessions observed, the Hermes gateway's memory and
 * session history, and the gbrain / Honcho backends.
 */
export {};
