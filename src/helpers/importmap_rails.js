import { existsSync } from "node:fs"
import path from "node:path"

const IMPORTMAP_CONFIG = path.join("config", "importmap.rb")
const RAILS_ROOT_MARKER = "Gemfile"
const REPOSITORY_MARKER = ".git"

export function usesImportmapRails(from = process.cwd()) {
  const root = railsRootFrom(from)
  return Boolean(root) && existsSync(path.join(root, IMPORTMAP_CONFIG))
}

// A Rails root carries both markers, and reaching `.git` first keeps the search inside the repository.
function railsRootFrom(directory) {
  if (existsSync(path.join(directory, RAILS_ROOT_MARKER))) return directory
  if (existsSync(path.join(directory, REPOSITORY_MARKER))) return null

  const parent = path.dirname(directory)
  return parent === directory ? null : railsRootFrom(parent)
}
