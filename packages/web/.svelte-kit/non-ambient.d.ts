
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	export interface AppTypes {
		RouteId(): "/(app)" | "/" | "/(app)/agents" | "/api" | "/api/agents" | "/api/chat" | "/api/events" | "/api/git-status" | "/api/kanban" | "/api/metrics" | "/api/plans" | "/api/plans/[id]" | "/api/test-results" | "/(app)/chat" | "/(app)/dashboard" | "/(app)/metrics" | "/(app)/plans" | "/(app)/plans/[id]" | "/(app)/settings";
		RouteParams(): {
			"/api/plans/[id]": { id: string };
			"/(app)/plans/[id]": { id: string }
		};
		LayoutParams(): {
			"/(app)": { id?: string };
			"/": { id?: string };
			"/(app)/agents": Record<string, never>;
			"/api": { id?: string };
			"/api/agents": Record<string, never>;
			"/api/chat": Record<string, never>;
			"/api/events": Record<string, never>;
			"/api/git-status": Record<string, never>;
			"/api/kanban": Record<string, never>;
			"/api/metrics": Record<string, never>;
			"/api/plans": { id?: string };
			"/api/plans/[id]": { id: string };
			"/api/test-results": Record<string, never>;
			"/(app)/chat": Record<string, never>;
			"/(app)/dashboard": Record<string, never>;
			"/(app)/metrics": Record<string, never>;
			"/(app)/plans": { id?: string };
			"/(app)/plans/[id]": { id: string };
			"/(app)/settings": Record<string, never>
		};
		Pathname(): "/" | "/agents" | "/api/agents" | "/api/chat" | "/api/events" | "/api/git-status" | "/api/kanban" | "/api/metrics" | "/api/plans" | `/api/plans/${string}` & {} | "/api/test-results" | "/chat" | "/dashboard" | "/metrics" | "/plans" | `/plans/${string}` & {} | "/settings";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): string & {};
	}
}