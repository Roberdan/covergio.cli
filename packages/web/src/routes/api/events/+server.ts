import type { RequestHandler } from './$types';
import { queryKanban, queryMetrics } from '$server/db';

export const GET: RequestHandler = async () => {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send('metrics', queryMetrics());
      send('kanban', queryKanban());

      const interval = setInterval(() => {
        try {
          send('metrics', queryMetrics());
          send('kanban', queryKanban());
        } catch {
          clearInterval(interval);
          controller.close();
        }
      }, 5000);

      setTimeout(() => {
        clearInterval(interval);
        controller.close();
      }, 300000);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    }
  });
};
