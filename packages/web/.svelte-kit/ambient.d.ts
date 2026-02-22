/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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
  export const SHELL: string;
  export const LSCOLORS: string;
  export const AZURE_TENANT_ID: string;
  export const ZLE_RPROMPT_INDENT: string;
  export const COLORTERM: string;
  export const XPC_FLAGS: string;
  export const AZURE_SUBSCRIPTION_NAME: string;
  export const TERM_PROGRAM_VERSION: string;
  export const DATABASE_URL: string;
  export const AZURE_SERVICE_ID: string;
  export const LOG_LEVEL: string;
  export const PGPORT: string;
  export const AZURE_RESOURCE_GROUP: string;
  export const __CFBundleIdentifier: string;
  export const DOTNET_ROOT: string;
  export const SSH_AUTH_SOCK: string;
  export const WARP_USE_SSH_WRAPPER: string;
  export const ADO_RESOURCE_ID: string;
  export const GEMINI_API_KEY: string;
  export const LINUX_DEV: string;
  export const OUTPUT_DIR: string;
  export const OSLogRateLimit: string;
  export const PYENV_VIRTUALENV_DISABLE_PROMPT: string;
  export const HOMEBREW_PREFIX: string;
  export const CONDA_CHANGEPS1: string;
  export const EDITOR: string;
  export const AZURE_ACR_NAME: string;
  export const PWD: string;
  export const AZURE_OPENAI_DEPLOYMENT: string;
  export const LOGNAME: string;
  export const PERPLEXITY_API_KEY: string;
  export const TCELL_MINIMIZE: string;
  export const LLM_CACHE_DIR: string;
  export const AZURE_OPENAI_REALTIME_ENDPOINT: string;
  export const POSH_SHELL: string;
  export const COMMAND_MODE: string;
  export const HOME: string;
  export const LANG: string;
  export const AZURE_SUBSCRIPTION_ID: string;
  export const AZURE_DEVOPS_PAT: string;
  export const POSH_SHELL_VERSION: string;
  export const ADO_PROJECT: string;
  export const OAUTH_CLIENT_ID: string;
  export const POSH_SESSION_ID: string;
  export const OLLAMA_MAX_LOADED_MODELS: string;
  export const SECRET_KEY: string;
  export const VIRTUAL_ENV_DISABLE_PROMPT: string;
  export const EXTERNAL_TENANT_ID: string;
  export const WARP_HONOR_PS1: string;
  export const OSTYPE: string;
  export const CONDA_PROMPT_MODIFIER: string;
  export const TMPDIR: string;
  export const PGUSER: string;
  export const CLICOLOR: string;
  export const SSH_SOCKET_DIR: string;
  export const GROK_API_KEY: string;
  export const CORS_ORIGINS: string;
  export const AZURE_DEVOPS_ORG: string;
  export const INFOPATH: string;
  export const GRAFANA_SERVICE_ACCOUNT_TOKEN: string;
  export const NVM_DIR: string;
  export const AZURE_DEVOPS_PROJECT: string;
  export const TERM: string;
  export const ADO_ORG_URL: string;
  export const QWEN_API_BASE: string;
  export const AZURE_OPENAI_API_VERSION: string;
  export const DISABLE_AUTH: string;
  export const USER: string;
  export const AZURE_OPENAI_REALTIME_API_KEY: string;
  export const APPLICATIONINSIGHTS_CONNECTION_STRING: string;
  export const HOMEBREW_CELLAR: string;
  export const OAUTH_CLIENT_SECRET: string;
  export const EXTERNAL_TENANT_ADMIN: string;
  export const VISUAL: string;
  export const SHLVL: string;
  export const OLLAMA_NUM_GPU: string;
  export const OLLAMA_NUM_PARALLEL: string;
  export const HOMEBREW_REPOSITORY: string;
  export const AZURE_CLIENT_ID: string;
  export const DISABLE_ORG_CHECK: string;
  export const XPC_SERVICE_NAME: string;
  export const GRAPH_CHAIN_STOP_NAME: string;
  export const LC_CTYPE: string;
  export const AZURE_WEBAPP_NAME: string;
  export const AZURE_OPENAI_REALTIME_DEPLOYMENT: string;
  export const FLASK_DEBUG: string;
  export const GO111MODULE: string;
  export const WARP_IS_LOCAL_SHELL_SESSION: string;
  export const PGHOST: string;
  export const AZURE_OPENAI_TENANT_ID: string;
  export const BUN_INSTALL: string;
  export const PGDATA: string;
  export const LINUX_USER: string;
  export const LC_ALL: string;
  export const PATH: string;
  export const AZURE_PORTAL_URL: string;
  export const OAUTH_TENANT_ID: string;
  export const EXTERNAL_TENANT_PWD: string;
  export const FLASK_ENV: string;
  export const OLLAMA_FLASH_ATTENTION: string;
  export const POWERLINE_COMMAND: string;
  export const AZURE_OPENAI_ENDPOINT: string;
  export const OPENROUTER_API_KEY: string;
  export const OLLAMA_KV_CACHE_TYPE: string;
  export const OLDPWD: string;
  export const __CF_USER_TEXT_ENCODING: string;
  export const TERM_PROGRAM: string;
  export const _: string;
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
declare module '$env/static/public' {}

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
    SHELL: string;
    LSCOLORS: string;
    AZURE_TENANT_ID: string;
    ZLE_RPROMPT_INDENT: string;
    COLORTERM: string;
    XPC_FLAGS: string;
    AZURE_SUBSCRIPTION_NAME: string;
    TERM_PROGRAM_VERSION: string;
    DATABASE_URL: string;
    AZURE_SERVICE_ID: string;
    LOG_LEVEL: string;
    PGPORT: string;
    AZURE_RESOURCE_GROUP: string;
    __CFBundleIdentifier: string;
    DOTNET_ROOT: string;
    SSH_AUTH_SOCK: string;
    WARP_USE_SSH_WRAPPER: string;
    ADO_RESOURCE_ID: string;
    GEMINI_API_KEY: string;
    LINUX_DEV: string;
    OUTPUT_DIR: string;
    OSLogRateLimit: string;
    PYENV_VIRTUALENV_DISABLE_PROMPT: string;
    HOMEBREW_PREFIX: string;
    CONDA_CHANGEPS1: string;
    EDITOR: string;
    AZURE_ACR_NAME: string;
    PWD: string;
    AZURE_OPENAI_DEPLOYMENT: string;
    LOGNAME: string;
    PERPLEXITY_API_KEY: string;
    TCELL_MINIMIZE: string;
    LLM_CACHE_DIR: string;
    AZURE_OPENAI_REALTIME_ENDPOINT: string;
    POSH_SHELL: string;
    COMMAND_MODE: string;
    HOME: string;
    LANG: string;
    AZURE_SUBSCRIPTION_ID: string;
    AZURE_DEVOPS_PAT: string;
    POSH_SHELL_VERSION: string;
    ADO_PROJECT: string;
    OAUTH_CLIENT_ID: string;
    POSH_SESSION_ID: string;
    OLLAMA_MAX_LOADED_MODELS: string;
    SECRET_KEY: string;
    VIRTUAL_ENV_DISABLE_PROMPT: string;
    EXTERNAL_TENANT_ID: string;
    WARP_HONOR_PS1: string;
    OSTYPE: string;
    CONDA_PROMPT_MODIFIER: string;
    TMPDIR: string;
    PGUSER: string;
    CLICOLOR: string;
    SSH_SOCKET_DIR: string;
    GROK_API_KEY: string;
    CORS_ORIGINS: string;
    AZURE_DEVOPS_ORG: string;
    INFOPATH: string;
    GRAFANA_SERVICE_ACCOUNT_TOKEN: string;
    NVM_DIR: string;
    AZURE_DEVOPS_PROJECT: string;
    TERM: string;
    ADO_ORG_URL: string;
    QWEN_API_BASE: string;
    AZURE_OPENAI_API_VERSION: string;
    DISABLE_AUTH: string;
    USER: string;
    AZURE_OPENAI_REALTIME_API_KEY: string;
    APPLICATIONINSIGHTS_CONNECTION_STRING: string;
    HOMEBREW_CELLAR: string;
    OAUTH_CLIENT_SECRET: string;
    EXTERNAL_TENANT_ADMIN: string;
    VISUAL: string;
    SHLVL: string;
    OLLAMA_NUM_GPU: string;
    OLLAMA_NUM_PARALLEL: string;
    HOMEBREW_REPOSITORY: string;
    AZURE_CLIENT_ID: string;
    DISABLE_ORG_CHECK: string;
    XPC_SERVICE_NAME: string;
    GRAPH_CHAIN_STOP_NAME: string;
    LC_CTYPE: string;
    AZURE_WEBAPP_NAME: string;
    AZURE_OPENAI_REALTIME_DEPLOYMENT: string;
    FLASK_DEBUG: string;
    GO111MODULE: string;
    WARP_IS_LOCAL_SHELL_SESSION: string;
    PGHOST: string;
    AZURE_OPENAI_TENANT_ID: string;
    BUN_INSTALL: string;
    PGDATA: string;
    LINUX_USER: string;
    LC_ALL: string;
    PATH: string;
    AZURE_PORTAL_URL: string;
    OAUTH_TENANT_ID: string;
    EXTERNAL_TENANT_PWD: string;
    FLASK_ENV: string;
    OLLAMA_FLASH_ATTENTION: string;
    POWERLINE_COMMAND: string;
    AZURE_OPENAI_ENDPOINT: string;
    OPENROUTER_API_KEY: string;
    OLLAMA_KV_CACHE_TYPE: string;
    OLDPWD: string;
    __CF_USER_TEXT_ENCODING: string;
    TERM_PROGRAM: string;
    _: string;
    NODE_ENV: string;
    [key: `PUBLIC_${string}`]: undefined;
    [key: `${string}`]: string | undefined;
  };
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
  };
}
