// Importmap-rails owns module resolution, which leaves `import-x/no-unresolved` with nothing to check. The search
// climbs, since ESLint can be run from a subdirectory, and stops at the project so a stray map further up never counts.

import { existsSync } from "node:fs"
import path from "node:path"

const IMPORTMAP_CONFIG = path.join("config", "importmap.rb")
const RAILS_ROOT_MARKER = "Gemfile"
const REPOSITORY_MARKER = ".git"

export function usesImportmapRails(from = process.cwd()) {
  const root = railsRootFrom(from)
  return Boolean(root) && existsSync(path.join(root, IMPORTMAP_CONFIG))
}

// The `Gemfile` is checked first, since a Rails root carries both markers. Reaching `.git` without one means the
// project is not Rails, and stopping there keeps the search inside the repository.
function railsRootFrom(directory) {
  if (existsSync(path.join(directory, RAILS_ROOT_MARKER))) return directory
  if (existsSync(path.join(directory, REPOSITORY_MARKER))) return null

  const parent = path.dirname(directory)
  return parent === directory ? null : railsRootFrom(parent)
}
