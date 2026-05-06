// Tests read as a flat list of full sentences, the way Minitest writes them. Nesting with `describe` and `it` splits a
// case's name across blocks, so reading one means assembling it from its ancestors, and the same `it` text repeats
// under different parents. One `test()` per case, named in full. The check is by name, not by import, so it reaches
// `describe`/`it` from any framework, including `describe.only` and the `test.describe` that Playwright uses. The name
// has to open the call, since a block is called on nothing: `hours.describe()` and `this.describe()` are methods.
// `context` is left out on purpose: it is a common identifier outside test files.
// In statement lists containing tests, hooks precede cases and run from suite setup to per-test setup, per-test
// teardown, then suite teardown. Moving registrations can change execution, so this rule does not autofix their order.

import { staticAccessKeyOf } from "#helpers/syntax/classes"
import { reportProblems } from "#helpers/eslint/report"

const BLOCK_NAMES = new Set([ "describe", "it", "suite", "specify" ])
const RUNNER = "test"
const TEST_MODIFIERS = new Set([ "only", "skip", "todo", "concurrent", "serial", "failing", "fails", "each" ])
const HOOK_ORDER = new Map([
  [ "before", 0 ], [ "beforeAll", 0 ], [ "suiteSetup", 0 ],
  [ "beforeEach", 1 ], [ "setup", 1 ],
  [ "afterEach", 2 ], [ "teardown", 2 ],
  [ "after", 3 ], [ "afterAll", 3 ], [ "suiteTeardown", 3 ]
])

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Require flat `test` calls with setup and teardown hooks ordered before tests" },
    schema: [],
    messages: {
      testBlock: "`{{name}}` nests tests. Write each case as a single `test` call, named in full.",
      hooksFirst: "Move `{{name}}` before the first test.",
      hookOrder: "Move `{{name}}` before `{{previous}}`; order hooks as suite setup, per-test setup, "
        + "per-test teardown, then suite teardown."
    }
  },
  create(context) {
    return {
      Program: (node) => reportProblems(context, new TestLayout(node.body)),
      BlockStatement: (node) => reportProblems(context, new TestLayout(node.body)),
      CallExpression({ callee }) {
        const name = callee.type === "CallExpression" ? null : new CalleePath(callee).blockName
        if (name) context.report({ node: callee, messageId: "testBlock", data: { name } })
      }
    }
  }
}

class TestLayout {
  #problems
  #hasTests = false
  #lastHook = null

  constructor(statements) {
    this.#problems = statements.flatMap((statement) => this.#problemsIn(statement))
  }

  get problems() {
    return this.#hasTests ? this.#problems : []
  }

  #problemsIn(statement) {
    const call = registrationIn(statement)
    if (call) {
      const path = new CalleePath(call.callee)
      if (path.isTest) this.#hasTests = true
      return path.hookName ? this.#hookProblemsFor(call.callee, path.hookName) : []
    } else {
      return []
    }
  }

  #hookProblemsFor(node, name) {
    const previous = this.#lastHook
    if (previous === null || HOOK_ORDER.get(name) >= HOOK_ORDER.get(previous)) this.#lastHook = name
    return this.#hasTests
      ? [ { node, messageId: "hooksFirst", data: { name } } ]
      : orderProblemsFor(node, { name, previous })
  }
}

function registrationIn(statement) {
  const expression = statement.type === "ExpressionStatement" ? statement.expression : null
  const call = expression?.type === "AwaitExpression" ? expression.argument : expression
  return call?.type === "CallExpression" ? call : null
}

class CalleePath {
  #node
  #cachedNames

  constructor(node) {
    this.#node = calleeOfRegistration(node)
  }

  get blockName() {
    const [ opening, next ] = this.#names
    if (BLOCK_NAMES.has(opening)) return opening

    return opening === RUNNER && BLOCK_NAMES.has(next) ? next : null
  }

  get isTest() {
    return this.#names[0] === RUNNER && this.#names.slice(1).every((name) => TEST_MODIFIERS.has(name))
  }

  get hookName() {
    const [ opening, next ] = this.#names
    if (HOOK_ORDER.has(opening)) return opening

    return opening === RUNNER && HOOK_ORDER.has(next) ? next : null
  }

  get #names() {
    return this.#cachedNames ??= this.#hasStaticIdentifierRoot ? Array.from(this.#reversedNames()).reverse() : []
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

function calleeOfRegistration(node) {
  const factory = node.type === "CallExpression" ? node.callee : node.tag
  return factory?.type === "MemberExpression" && staticAccessKeyOf(factory)?.name === "each" ? factory : node
}

function orderProblemsFor(node, { name, previous }) {
  return previous !== null && HOOK_ORDER.get(name) < HOOK_ORDER.get(previous)
    ? [ { node, messageId: "hookOrder", data: { name, previous } } ]
    : []
}
