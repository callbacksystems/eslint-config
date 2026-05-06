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
  return new RailsRoot(path.resolve(directory)).value
}

class RailsRoot {
  #directory

  constructor(directory) {
    this.#directory = directory
  }

  get value() {
    while (!this.#isBoundary) this.#ascend()
    return this.#isRails ? this.#directory : null
  }

  get #isBoundary() {
    return this.#isRails || this.#isRepository || this.#isFilesystemRoot
  }

  get #isRails() {
    return existsSync(path.join(this.#directory, RAILS_ROOT_MARKER))
  }

  get #isRepository() {
    return existsSync(path.join(this.#directory, REPOSITORY_MARKER))
  }

  get #isFilesystemRoot() {
    return path.dirname(this.#directory) === this.#directory
  }

  #ascend() {
    this.#directory = path.dirname(this.#directory)
  }
}
