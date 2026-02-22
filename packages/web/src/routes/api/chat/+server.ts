import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getChatEngine,
  type ChatRequest,
  type ChatStreamEvent
} from '$server/chat-engine';

const encoder = new TextEncoder();

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive'
} as const;

function toSseEvent(event: ChatStreamEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

function isChatRequest(payload: unknown): payload is ChatRequest {
  if (!payload || typeof payload !== 'object') return false;
  const record = payload as Record<string, unknown>;
  return typeof record.message === 'string' && typeof record.sessionId === 'string';
}

export const POST: RequestHandler = async ({ request }) => {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isChatRequest(payload)) {
    return json({ error: 'Invalid chat request payload' }, { status: 400 });
  }

  const engine = getChatEngine();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of engine.stream(payload)) {
          controller.enqueue(toSseEvent(event));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected stream error';
        controller.enqueue(toSseEvent({ type: 'token', content: `Error: ${message}` }));
        controller.enqueue(toSseEvent({ type: 'done' }));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, { headers: SSE_HEADERS });
};
