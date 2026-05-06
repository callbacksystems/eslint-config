import { existsSync } from "node:fs"
import path from "node:path"
import { findUpSync } from "find-up"

const IMPORTMAP_CONFIG = path.join("config", "importmap.rb")
const RAILS_ROOT_MARKER = "Gemfile"
const REPOSITORY_MARKER = ".git"

export function usesImportmapRails(from = process.cwd()) {
  const root = railsRootFrom(from)
  return Boolean(root) && existsSync(path.join(root, IMPORTMAP_CONFIG))
}

// A Rails root carries both markers, and reaching `.git` first keeps the search inside the repository.
function railsRootFrom(directory) {
  const marker = findUpSync([ RAILS_ROOT_MARKER, REPOSITORY_MARKER ], { cwd: directory, type: "both" })
  return marker && path.basename(marker) === RAILS_ROOT_MARKER ? path.dirname(marker) : null
}
