
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * Environment variables [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env`. Like [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), this module cannot be imported into client-side code. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * _Unlike_ [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), the values exported from this module are statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * ```ts
 * import { API_KEY } from '$env/static/private';
 * ```
 * 
 * Note that all environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * 
 * ```
 * MY_FEATURE_FLAG=""
 * ```
 * 
 * You can override `.env` values from the command line like so:
 * 
 * ```sh
 * MY_FEATURE_FLAG="enabled" npm run dev
 * ```
 */
declare module '$env/static/private' {
	export const GRAPH_CHAIN_STOP_NAME: string;
	export const DISABLE_AUTH: string;
	export const AZURE_DEVOPS_PAT: string;
	export const AZURE_OPENAI_API_VERSION: string;
	export const TERM_PROGRAM: string;
	export const ZLE_RPROMPT_INDENT: string;
	export const NODE: string;
	export const AZURE_OPENAI_REALTIME_DEPLOYMENT: string;
	export const EXTERNAL_TENANT_ADMIN: string;
	export const APPLICATIONINSIGHTS_CONNECTION_STRING: string;
	export const OLLAMA_MAX_LOADED_MODELS: string;
	export const INIT_CWD: string;
	export const POSH_SHELL: string;
	export const TERM: string;
	export const WARP_HONOR_PS1: string;
	export const SHELL: string;
	export const CORS_ORIGINS: string;
	export const CLICOLOR: string;
	export const TCELL_MINIMIZE: string;
	export const OAUTH_TENANT_ID: string;
	export const HOMEBREW_REPOSITORY: string;
	export const TMPDIR: string;
	export const npm_config_global_prefix: string;
	export const CONDA_PROMPT_MODIFIER: string;
	export const TERM_PROGRAM_VERSION: string;
	export const AZURE_OPENAI_REALTIME_API_KEY: string;
	export const AZURE_SUBSCRIPTION_NAME: string;
	export const OAUTH_CLIENT_SECRET: string;
	export const COLOR: string;
	export const FLASK_ENV: string;
	export const npm_config_noproxy: string;
	export const npm_config_local_prefix: string;
	export const POWERLINE_COMMAND: string;
	export const LC_ALL: string;
	export const OLLAMA_NUM_GPU: string;
	export const USER: string;
	export const AZURE_DEVOPS_PROJECT: string;
	export const NVM_DIR: string;
	export const POSH_SESSION_ID: string;
	export const AZURE_OPENAI_ENDPOINT: string;
	export const PGPORT: string;
	export const COMMAND_MODE: string;
	export const npm_config_globalconfig: string;
	export const OLLAMA_KV_CACHE_TYPE: string;
	export const OLLAMA_FLASH_ATTENTION: string;
	export const PGUSER: string;
	export const SSH_AUTH_SOCK: string;
	export const __CF_USER_TEXT_ENCODING: string;
	export const WARP_IS_LOCAL_SHELL_SESSION: string;
	export const AZURE_CLIENT_ID: string;
	export const PYENV_VIRTUALENV_DISABLE_PROMPT: string;
	export const npm_execpath: string;
	export const AZURE_DEVOPS_ORG: string;
	export const AZURE_TENANT_ID: string;
	export const GO111MODULE: string;
	export const VIRTUAL_ENV_DISABLE_PROMPT: string;
	export const WARP_USE_SSH_WRAPPER: string;
	export const LLM_CACHE_DIR: string;
	export const AZURE_OPENAI_TENANT_ID: string;
	export const LSCOLORS: string;
	export const PATH: string;
	export const GRAFANA_SERVICE_ACCOUNT_TOKEN: string;
	export const npm_package_json: string;
	export const _: string;
	export const npm_config_userconfig: string;
	export const npm_config_init_module: string;
	export const QWEN_API_BASE: string;
	export const SECRET_KEY: string;
	export const ADO_PROJECT: string;
	export const __CFBundleIdentifier: string;
	export const AZURE_RESOURCE_GROUP: string;
	export const npm_command: string;
	export const PWD: string;
	export const DOTNET_ROOT: string;
	export const OPENROUTER_API_KEY: string;
	export const npm_lifecycle_event: string;
	export const PERPLEXITY_API_KEY: string;
	export const EDITOR: string;
	export const npm_package_name: string;
	export const EXTERNAL_TENANT_PWD: string;
	export const POSH_SHELL_VERSION: string;
	export const LANG: string;
	export const AZURE_OPENAI_DEPLOYMENT: string;
	export const PGHOST: string;
	export const FLASK_DEBUG: string;
	export const npm_config_npm_version: string;
	export const OLLAMA_NUM_PARALLEL: string;
	export const OAUTH_CLIENT_ID: string;
	export const XPC_FLAGS: string;
	export const AZURE_ACR_NAME: string;
	export const npm_config_node_gyp: string;
	export const npm_package_version: string;
	export const XPC_SERVICE_NAME: string;
	export const ADO_ORG_URL: string;
	export const GEMINI_API_KEY: string;
	export const SHLVL: string;
	export const HOME: string;
	export const LOG_LEVEL: string;
	export const OSTYPE: string;
	export const HOMEBREW_PREFIX: string;
	export const AZURE_OPENAI_REALTIME_ENDPOINT: string;
	export const npm_config_cache: string;
	export const LOGNAME: string;
	export const npm_lifecycle_script: string;
	export const VISUAL: string;
	export const LC_CTYPE: string;
	export const npm_config_fund: string;
	export const SSH_SOCKET_DIR: string;
	export const PGDATA: string;
	export const BUN_INSTALL: string;
	export const npm_config_user_agent: string;
	export const LINUX_USER: string;
	export const EXTERNAL_TENANT_ID: string;
	export const HOMEBREW_CELLAR: string;
	export const INFOPATH: string;
	export const DISABLE_ORG_CHECK: string;
	export const OSLogRateLimit: string;
	export const AZURE_SERVICE_ID: string;
	export const AZURE_PORTAL_URL: string;
	export const GROK_API_KEY: string;
	export const CONDA_CHANGEPS1: string;
	export const AZURE_SUBSCRIPTION_ID: string;
	export const DATABASE_URL: string;
	export const LINUX_DEV: string;
	export const npm_node_execpath: string;
	export const npm_config_prefix: string;
	export const AZURE_WEBAPP_NAME: string;
	export const OUTPUT_DIR: string;
	export const ADO_RESOURCE_ID: string;
	export const COLORTERM: string;
	export const NODE_ENV: string;
}

/**
 * Similar to [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private), except that it only includes environment variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Values are replaced statically at build time.
 * 
 * ```ts
 * import { PUBLIC_BASE_URL } from '$env/static/public';
 * ```
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to runtime environment variables, as defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * This module cannot be imported into client-side code.
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * console.log(env.DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` always includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 */
declare module '$env/dynamic/private' {
	export const env: {
		GRAPH_CHAIN_STOP_NAME: string;
		DISABLE_AUTH: string;
		AZURE_DEVOPS_PAT: string;
		AZURE_OPENAI_API_VERSION: string;
		TERM_PROGRAM: string;
		ZLE_RPROMPT_INDENT: string;
		NODE: string;
		AZURE_OPENAI_REALTIME_DEPLOYMENT: string;
		EXTERNAL_TENANT_ADMIN: string;
		APPLICATIONINSIGHTS_CONNECTION_STRING: string;
		OLLAMA_MAX_LOADED_MODELS: string;
		INIT_CWD: string;
		POSH_SHELL: string;
		TERM: string;
		WARP_HONOR_PS1: string;
		SHELL: string;
		CORS_ORIGINS: string;
		CLICOLOR: string;
		TCELL_MINIMIZE: string;
		OAUTH_TENANT_ID: string;
		HOMEBREW_REPOSITORY: string;
		TMPDIR: string;
		npm_config_global_prefix: string;
		CONDA_PROMPT_MODIFIER: string;
		TERM_PROGRAM_VERSION: string;
		AZURE_OPENAI_REALTIME_API_KEY: string;
		AZURE_SUBSCRIPTION_NAME: string;
		OAUTH_CLIENT_SECRET: string;
		COLOR: string;
		FLASK_ENV: string;
		npm_config_noproxy: string;
		npm_config_local_prefix: string;
		POWERLINE_COMMAND: string;
		LC_ALL: string;
		OLLAMA_NUM_GPU: string;
		USER: string;
		AZURE_DEVOPS_PROJECT: string;
		NVM_DIR: string;
		POSH_SESSION_ID: string;
		AZURE_OPENAI_ENDPOINT: string;
		PGPORT: string;
		COMMAND_MODE: string;
		npm_config_globalconfig: string;
		OLLAMA_KV_CACHE_TYPE: string;
		OLLAMA_FLASH_ATTENTION: string;
		PGUSER: string;
		SSH_AUTH_SOCK: string;
		__CF_USER_TEXT_ENCODING: string;
		WARP_IS_LOCAL_SHELL_SESSION: string;
		AZURE_CLIENT_ID: string;
		PYENV_VIRTUALENV_DISABLE_PROMPT: string;
		npm_execpath: string;
		AZURE_DEVOPS_ORG: string;
		AZURE_TENANT_ID: string;
		GO111MODULE: string;
		VIRTUAL_ENV_DISABLE_PROMPT: string;
		WARP_USE_SSH_WRAPPER: string;
		LLM_CACHE_DIR: string;
		AZURE_OPENAI_TENANT_ID: string;
		LSCOLORS: string;
		PATH: string;
		GRAFANA_SERVICE_ACCOUNT_TOKEN: string;
		npm_package_json: string;
		_: string;
		npm_config_userconfig: string;
		npm_config_init_module: string;
		QWEN_API_BASE: string;
		SECRET_KEY: string;
		ADO_PROJECT: string;
		__CFBundleIdentifier: string;
		AZURE_RESOURCE_GROUP: string;
		npm_command: string;
		PWD: string;
		DOTNET_ROOT: string;
		OPENROUTER_API_KEY: string;
		npm_lifecycle_event: string;
		PERPLEXITY_API_KEY: string;
		EDITOR: string;
		npm_package_name: string;
		EXTERNAL_TENANT_PWD: string;
		POSH_SHELL_VERSION: string;
		LANG: string;
		AZURE_OPENAI_DEPLOYMENT: string;
		PGHOST: string;
		FLASK_DEBUG: string;
		npm_config_npm_version: string;
		OLLAMA_NUM_PARALLEL: string;
		OAUTH_CLIENT_ID: string;
		XPC_FLAGS: string;
		AZURE_ACR_NAME: string;
		npm_config_node_gyp: string;
		npm_package_version: string;
		XPC_SERVICE_NAME: string;
		ADO_ORG_URL: string;
		GEMINI_API_KEY: string;
		SHLVL: string;
		HOME: string;
		LOG_LEVEL: string;
		OSTYPE: string;
		HOMEBREW_PREFIX: string;
		AZURE_OPENAI_REALTIME_ENDPOINT: string;
		npm_config_cache: string;
		LOGNAME: string;
		npm_lifecycle_script: string;
		VISUAL: string;
		LC_CTYPE: string;
		npm_config_fund: string;
		SSH_SOCKET_DIR: string;
		PGDATA: string;
		BUN_INSTALL: string;
		npm_config_user_agent: string;
		LINUX_USER: string;
		EXTERNAL_TENANT_ID: string;
		HOMEBREW_CELLAR: string;
		INFOPATH: string;
		DISABLE_ORG_CHECK: string;
		OSLogRateLimit: string;
		AZURE_SERVICE_ID: string;
		AZURE_PORTAL_URL: string;
		GROK_API_KEY: string;
		CONDA_CHANGEPS1: string;
		AZURE_SUBSCRIPTION_ID: string;
		DATABASE_URL: string;
		LINUX_DEV: string;
		npm_node_execpath: string;
		npm_config_prefix: string;
		AZURE_WEBAPP_NAME: string;
		OUTPUT_DIR: string;
		ADO_RESOURCE_ID: string;
		COLORTERM: string;
		NODE_ENV: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * Similar to [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), but only includes variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Note that public dynamic environment variables must all be sent from the server to the client, causing larger network requests — when possible, use `$env/static/public` instead.
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.PUBLIC_DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
