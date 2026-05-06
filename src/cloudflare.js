import globals from "globals"
import { DEFAULT_FILES } from "#constants/files"

// `globals.serviceworker` already covers the web-standard surface, so only what workerd adds is declared. Bindings
// arrive as `env` in module syntax, and a Service Worker syntax project declares its own names as globals.
const WORKERS_GLOBALS = { Cloudflare: "readonly", HTMLRewriter: "readonly", WebSocketPair: "readonly" }

export default [
  { name: "@callbacksystems/cloudflare/ignores", ignores: [ ".wrangler/**" ] },
  {
    name: "@callbacksystems/cloudflare",
    files: DEFAULT_FILES,
    languageOptions: { globals: { ...globals.serviceworker, ...WORKERS_GLOBALS } }
  }
]
