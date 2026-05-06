import { Linter } from "eslint"

const LANGUAGE_OPTIONS = { ecmaVersion: "latest", sourceType: "module" }

// One `Linter` pass over a snippet, so its nodes carry their `parent` links and the scope analysis helpers ask for.
export class ParsedCode {
  #code
  #nodes = []
  #languageOptions

  constructor(code, { sourceType = "module" } = {}) {
    this.#code = code
    this.#languageOptions = { ...LANGUAGE_OPTIONS, sourceType }
    this.#verify()
  }

  firstNodeOfType(type) {
    return this.nodesOfType(type)[0]
  }

  nodesOfType(type) {
    return this.#nodes.filter((node) => node.type === type)
  }

  #verify() {
    const fatal = new Linter().verify(this.#code, this.#config).find((message) => message.fatal)
    if (fatal) throw new Error(fatal.message)
  }

  get #config() {
    return {
      plugins: { probe: { rules: { probe: { create: (context) => this.#listenersFor(context) } } } },
      languageOptions: this.#languageOptions,
      rules: { "probe/probe": "error" }
    }
  }

  #listenersFor(context) {
    this.sourceCode = context.sourceCode
    return { "*": (node) => void this.#nodes.push(node) }
  }
}
