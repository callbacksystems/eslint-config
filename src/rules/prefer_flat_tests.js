// Tests read as a flat list of full sentences, the way Minitest writes them. Nesting with `describe` and `it` splits a
// case's name across blocks, so reading one means assembling it from its ancestors, and the same `it` text repeats
// under different parents. One `test()` per case, named in full. The check is by name, not by import, so it reaches
// `describe`/`it` from any framework, including `describe.only` and the `test.describe` that Playwright uses. The name
// has to open the call, since a block is called on nothing: `hours.describe()` and `this.describe()` are methods.
// `context` is left out on purpose: it is a common identifier outside test files.

import { staticAccessKeyOf } from "#helpers/syntax/classes"

const BLOCK_NAMES = new Set([ "describe", "it", "suite", "specify" ])
const RUNNER = "test"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow `describe` and `it` blocks in favor of flat `test` calls" },
    schema: [],
    messages: { testBlock: "`{{name}}` nests tests. Write each case as a single `test` call, named in full." }
  },
  create(context) {
    return {
      CallExpression({ callee }) {
        const name = new CalleePath(callee).blockName
        if (name) context.report({ node: callee, messageId: "testBlock", data: { name } })
      }
    }
  }
}

class CalleePath {
  #node

  constructor(node) {
    this.#node = node
  }

  get blockName() {
    const [ opening, next ] = this.#names
    if (BLOCK_NAMES.has(opening)) return opening

    return opening === RUNNER && BLOCK_NAMES.has(next) ? next : null
  }

  get #names() {
    return this.#hasStaticIdentifierRoot ? Array.from(this.#reversedNames()).reverse() : []
  }

  // A receiver the source cannot name (`this`, a call) leaves the chain unnamed; otherwise its property alone would
  // read as a bare `describe`.
  get #hasStaticIdentifierRoot() {
    let current = this.#node
    while (current.type === "MemberExpression") {
      if (!staticAccessKeyOf(current)) return false

      current = current.object
    }

    return current.type === "Identifier"
  }

  *#reversedNames() {
    let current = this.#node
    while (current.type === "MemberExpression") {
      yield staticAccessKeyOf(current).name
      current = current.object
    }
    yield current.name
  }
}
