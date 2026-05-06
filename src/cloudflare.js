// Cloudflare Workers. `globals.serviceworker` already carries the runtime's web-standard surface, so only the three
// globals workerd adds on top are declared here. Bindings stay out, since a KV or D1 binding is named by the project
// and in module syntax it arrives as `fetch(request, env, ctx)` rather than as a global. A Service Worker syntax
// project declares its own binding names under `languageOptions.globals`.

import globals from "globals"
import { DEFAULT_FILES } from "#constants/files"

const WORKERS_GLOBALS = { Cloudflare: "readonly", HTMLRewriter: "readonly", WebSocketPair: "readonly" }

export default [
  { name: "@callbacksystems/cloudflare/ignores", ignores: [ ".wrangler/**" ] },
  {
    name: "@callbacksystems/cloudflare",
    files: DEFAULT_FILES,
    languageOptions: { globals: { ...globals.serviceworker, ...WORKERS_GLOBALS } }
  }
]
