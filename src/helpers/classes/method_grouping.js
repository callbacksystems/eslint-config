import { isAccessor } from "#helpers/syntax/classes"

export class MethodGrouping {
  #patterns
  #separateAccessors
  #groupsByName = new Map()

  static isAccessor(method) {
    return isAccessor(method)
  }

  constructor({ nameGroups, separateAccessors }) {
    this.#patterns = nameGroups.map((pattern) => new NameGroupPattern(pattern))
    this.#separateAccessors = separateAccessors
  }

  get isValid() {
    return this.#invalidPatterns.length === 0
  }

  invalidAnalysisAt(node) {
    return new InvalidNameGroups(node, this.#invalidPatterns)
  }

  nameGroupOf(name) {
    return name ? this.#groupOf(name) : -1
  }

  // Where accessors are a section of their own (Stimulus getters below the actions), pairing them with the methods
  // fights the rule drawing that section.
  isSeparatedAccessor(method) {
    return this.#separateAccessors && MethodGrouping.isAccessor(method)
  }

  get #invalidPatterns() {
    return this.#patterns.filter((pattern) => !pattern.isValid)
  }

  #groupOf(name) {
    if (!this.#groupsByName.has(name)) {
      this.#groupsByName.set(name, this.#patterns.findIndex((pattern) => pattern.matches(name)))
    }
    return this.#groupsByName.get(name)
  }
}

class NameGroupPattern {
  #source
  #value

  constructor(source) {
    this.#source = source
    try {
      this.#value = new RegExp(source, "u")
    } catch {
      this.#value = null
    }
  }

  get isValid() {
    return Boolean(this.#value)
  }

  get displaySource() {
    return JSON.stringify(this.#source)
  }

  matches(name) {
    return Boolean(this.#value?.test(name))
  }
}

class InvalidNameGroups {
  #node
  #patterns

  constructor(node, patterns) {
    this.#node = node
    this.#patterns = patterns
  }

  get problems() {
    return this.#patterns.map((pattern) => ({
      node: this.#node,
      messageId: "invalidNameGroup",
      data: { pattern: pattern.displaySource }
    }))
  }
}
