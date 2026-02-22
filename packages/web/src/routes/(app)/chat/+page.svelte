<script lang="ts">
  import { onMount } from 'svelte';
  import { Send, Plus, Bot, User, Trash2, MessageSquare } from 'lucide-svelte';
  import type { PageData } from './$types';

  interface Agent {
    name: string;
    description: string;
    model: string;
    category: string;
    type: string;
  }

  interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    isStreaming?: boolean;
  }

  interface ChatSession {
    id: string;
    title: string;
    agentId: string | null;
    messages: ChatMessage[];
    createdAt: number;
  }

  let { data }: { data: PageData } = $props();
  const agents = (data.agents ?? []) as Agent[];

  let sessions = $state<ChatSession[]>([]);
  let activeSessionId = $state<string | null>(null);
  let inputValue = $state('');
  let isStreaming = $state(false);
  let selectedAgent = $state<string | null>(null);
  let messagesEnd: HTMLDivElement | undefined = $state();

  const activeSession = $derived(sessions.find(s => s.id === activeSessionId) ?? null);
  const activeMessages = $derived(activeSession?.messages ?? []);

  function genId() {
    return crypto.randomUUID();
  }

  function createSession() {
    const session: ChatSession = {
      id: genId(),
      title: 'New Chat',
      agentId: selectedAgent,
      messages: [],
      createdAt: Date.now()
    };
    sessions = [session, ...sessions];
    activeSessionId = session.id;
    inputValue = '';
  }

  function deleteSession(id: string) {
    sessions = sessions.filter(s => s.id !== id);
    if (activeSessionId === id) {
      activeSessionId = sessions[0]?.id ?? null;
    }
    saveToStorage();
  }

  function scrollToBottom() {
    setTimeout(() => messagesEnd?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  async function sendMessage() {
    if (!inputValue.trim() || isStreaming) return;
    if (!activeSession) createSession();

    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now()
    };

    const assistantMsg: ChatMessage = {
      id: genId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true
    };

    const sid = activeSessionId!;
    sessions = sessions.map(s => {
      if (s.id !== sid) return s;
      const title = s.messages.length === 0 ? userMsg.content.slice(0, 50) : s.title;
      return { ...s, title, messages: [...s.messages, userMsg, assistantMsg] };
    });

    inputValue = '';
    isStreaming = true;
    scrollToBottom();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          sessionId: sid,
          agentId: selectedAgent
        })
      });

      if (!res.ok || !res.body) throw new Error('Chat request failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;

          try {
            const event = JSON.parse(raw) as { type: string; content?: string };
            if (event.type === 'token' && event.content) {
              sessions = sessions.map(s => {
                if (s.id !== sid) return s;
                return {
                  ...s,
                  messages: s.messages.map(m =>
                    m.id === assistantMsg.id
                      ? { ...m, content: m.content + event.content }
                      : m
                  )
                };
              });
              scrollToBottom();
            } else if (event.type === 'done') {
              sessions = sessions.map(s => {
                if (s.id !== sid) return s;
                return {
                  ...s,
                  messages: s.messages.map(m =>
                    m.id === assistantMsg.id ? { ...m, isStreaming: false } : m
                  )
                };
              });
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      sessions = sessions.map(s => {
        if (s.id !== sid) return s;
        return {
          ...s,
          messages: s.messages.map(m =>
            m.id === assistantMsg.id
              ? { ...m, content: m.content || 'Sorry, something went wrong.', isStreaming: false }
              : m
          )
        };
      });
    } finally {
      isStreaming = false;
      saveToStorage();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
    if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      createSession();
    }
  }

  function formatTime(ts: number) {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function renderMarkdown(text: string): string {
    return text
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="my-2 rounded-lg bg-zinc-900 p-3 text-sm text-green-400 overflow-x-auto dark:bg-zinc-800"><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code class="rounded bg-zinc-200 px-1.5 py-0.5 text-sm dark:bg-zinc-700">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  }

  function saveToStorage() {
    try { localStorage.setItem('convergio-chat', JSON.stringify({ sessions, activeSessionId })); } catch {}
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem('convergio-chat');
      if (raw) {
        const data = JSON.parse(raw);
        sessions = data.sessions ?? [];
        activeSessionId = data.activeSessionId ?? null;
      }
    } catch {}
  }

  onMount(() => {
    loadFromStorage();
    if (sessions.length === 0) createSession();
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-[calc(100vh-3.5rem)] overflow-hidden">
  <!-- Conversation sidebar -->
  <aside class="hidden w-64 shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 md:flex md:flex-col">
    <div class="flex items-center justify-between border-b border-zinc-200 p-3 dark:border-zinc-800">
      <h2 class="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Conversations</h2>
      <button
        type="button"
        class="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-200 dark:hover:bg-zinc-800"
        onclick={createSession}
        title="New chat (⌘N)"
      >
        <Plus class="h-4 w-4" />
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-2">
      {#each sessions as session (session.id)}
        <button
          type="button"
          class={`group mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
            session.id === activeSessionId
              ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200'
              : 'text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800'
          }`}
          onclick={() => { activeSessionId = session.id; }}
        >
          <MessageSquare class="h-4 w-4 shrink-0 opacity-50" />
          <span class="flex-1 truncate">{session.title}</span>
          <span
            role="button"
            tabindex="-1"
            class="hidden rounded p-0.5 text-zinc-400 hover:text-red-500 group-hover:inline-block"
            onclick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
            onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); deleteSession(session.id); } }}
          >
            <Trash2 class="h-3 w-3" />
          </span>
        </button>
      {/each}
    </div>

    <!-- Agent selector -->
    <div class="border-t border-zinc-200 p-3 dark:border-zinc-800">
      <label class="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Agent</label>
      <select
        class="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        bind:value={selectedAgent}
      >
        <option value={null}>Default (Convergio)</option>
        {#each agents as agent}
          <option value={agent.name}>{agent.name} ({agent.model})</option>
        {/each}
      </select>
    </div>
  </aside>

  <!-- Main chat area -->
  <main class="flex flex-1 flex-col">
    {#if !activeSession || activeMessages.length === 0}
      <!-- Empty state -->
      <div class="flex flex-1 flex-col items-center justify-center p-8">
        <div class="mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 p-4 shadow-lg">
          <Bot class="h-8 w-8 text-white" />
        </div>
        <h2 class="text-xl font-semibold text-zinc-800 dark:text-zinc-100">Convergio Chat</h2>
        <p class="mt-2 max-w-md text-center text-sm text-zinc-500 dark:text-zinc-400">
          Start a conversation with the AI orchestration engine. Ask anything about your codebase,
          create plans, run tools, or orchestrate agents.
        </p>
        <div class="mt-6 flex flex-wrap justify-center gap-2">
          {#each ['Analyze my codebase', 'Create a plan for...', 'Run tests', 'Explain this code'] as suggestion}
            <button
              type="button"
              class="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition hover:border-violet-400 hover:text-violet-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-violet-500"
              onclick={() => { inputValue = suggestion; }}
            >
              {suggestion}
            </button>
          {/each}
        </div>
      </div>
    {:else}
      <!-- Messages -->
      <div class="flex-1 overflow-y-auto px-4 py-6">
        <div class="mx-auto max-w-3xl space-y-4">
          {#each activeMessages as msg (msg.id)}
            <div class={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div class={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                msg.role === 'user'
                  ? 'bg-violet-600 text-white'
                  : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
              }`}>
                {#if msg.role === 'user'}
                  <User class="h-4 w-4" />
                {:else}
                  <Bot class="h-4 w-4" />
                {/if}
              </div>
              <div class={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-violet-600 text-white'
                  : 'bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700'
              }`}>
                <div class="prose prose-sm dark:prose-invert max-w-none">
                  {#if msg.content}
                    {@html renderMarkdown(msg.content)}
                  {/if}
                  {#if msg.isStreaming && !msg.content}
                    <div class="flex items-center gap-1">
                      <span class="animate-bounce text-zinc-400">●</span>
                      <span class="animate-bounce text-zinc-400" style="animation-delay: 0.1s">●</span>
                      <span class="animate-bounce text-zinc-400" style="animation-delay: 0.2s">●</span>
                    </div>
                  {/if}
                </div>
                <p class={`mt-1 text-xs opacity-50 ${msg.role === 'user' ? 'text-right' : ''}`}>
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>
          {/each}
          <div bind:this={messagesEnd}></div>
        </div>
      </div>
    {/if}

    <!-- Input area -->
    <div class="border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div class="mx-auto flex max-w-3xl items-end gap-3">
        <textarea
          class="flex-1 resize-none rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm placeholder-zinc-400 transition focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
          placeholder="Message Convergio... (⌘+Enter to send)"
          rows="1"
          bind:value={inputValue}
          onkeydown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              sendMessage();
            }
          }}
          oninput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = Math.min(target.scrollHeight, 150) + 'px';
          }}
          disabled={isStreaming}
        ></textarea>
        <button
          type="button"
          class={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
            inputValue.trim() && !isStreaming
              ? 'bg-violet-600 text-white hover:bg-violet-700'
              : 'bg-zinc-200 text-zinc-400 dark:bg-zinc-800'
          }`}
          disabled={!inputValue.trim() || isStreaming}
          onclick={sendMessage}
        >
          <Send class="h-4 w-4" />
        </button>
      </div>
      <p class="mx-auto mt-2 max-w-3xl text-center text-xs text-zinc-400">
        {selectedAgent ? `Agent: ${selectedAgent}` : 'Convergio AI'} · ⌘+Enter to send · ⌘+N new chat
      </p>
    </div>
  </main>
</div>
