// `if (x === A) ... else if (x === B) ... else if (x === C) ...` chains with
// 3+ branches comparing the same identifier read better as a `switch` (and
// in TS get exhaustiveness checking on union types).
//
// The fix is withheld when converting would change behaviour: a loose `==`
// (switch matches strictly), an unlabeled `break` that the switch would swallow,
// or an empty / multi-line non-block branch whose reindentation would be unsafe.

import { isFunctionExit, isSingleLine, walk } from "#helpers/ast"
import { reportProblem } from "#helpers/report"

const DEFAULT_MIN = 3
const LOOP_OR_SWITCH = new Set([
  "ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "DoWhileStatement", "SwitchStatement"
])

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Prefer `switch` over `if/else if` chains comparing the same identifier" },
    schema: [ { type: "object", properties: { min: { type: "integer", minimum: 2 } }, additionalProperties: false } ],
    messages: {
      preferSwitch: "Chain of {{count}} `if/else if` comparing `{{name}}`. Use `switch` for clarity and exhaustiveness."
    }
  },
  create(context) {
    const min = context.options[0]?.min ?? DEFAULT_MIN
    return {
      IfStatement(node) {
        if (isTopOfChain(node)) reportProblem(context, new Chain(node, min, context.sourceCode))
      }
    }
  }
}

function isTopOfChain(node) {
  return node.parent.type !== "IfStatement" || node.parent.alternate !== node
}

class Chain {
  #node
  #min
  #sourceCode

  constructor(node, min, sourceCode) {
    this.#node = node
    this.#min = min
    this.#sourceCode = sourceCode
  }

  get problem() {
    if (this.#isReportable) {
      return {
        node: this.#node,
        messageId: "preferSwitch",
        data: { count: this.#names.length, name: this.#names[0] },
        fix: this.#fix
      }
    } else {
      return null
    }
  }

  #caseTextFor(branch) {
    return `${this.#caseHeaderFor(branch)}\n${this.#bodyTextOf(branch.consequent, { withBreak: true })}`
  }

  #caseHeaderFor(branch) {
    return `${this.#indent}  case ${this.#sourceCode.getText(branch.test.right)}:`
  }

  #bodyTextOf(consequent, { withBreak }) {
    const statements = consequent.type === "BlockStatement" ? consequent.body : [ consequent ]
    const body = this.#reindented(statements)
    return withBreak && !isFunctionExit(statements.at(-1)) ? `${body}\n${this.#indent}    break` : body
  }

  #reindented(statements) {
    return reindent(this.#sourceCode.text.slice(statements[0].range[0], statements.at(-1).range[1]), {
      from: statements[0].loc.start.column,
      to: this.#indent.length + 4
    })
  }

  get #isReportable() {
    return this.#names.length >= this.#min && this.#names.every((name) => name === this.#names[0])
  }

  get #names() {
    const names = this.#branches.map((branch) => equalityComparison(branch.test))
    return names.every(Boolean) ? names : []
  }

  get #branches() {
    return ifChainFrom(this.#node)
  }

  get #fix() {
    return this.#isConvertible ? (fixer) => fixer.replaceText(this.#node, this.#switchText) : null
  }

  get #isConvertible() {
    return this.#isStrict && this.#isReindentable && !this.#swallowsBreak
  }

  get #isStrict() {
    return this.#branches.every((branch) => branch.test.operator === "===")
  }

  get #isReindentable() {
    return this.#bodies.every(isConvertibleBody)
  }

  get #bodies() {
    const consequents = this.#branches.map((branch) => branch.consequent)
    return this.#finalAlternate ? [ ...consequents, this.#finalAlternate ] : consequents
  }

  get #finalAlternate() {
    const last = this.#branches.at(-1).alternate
    return last && last.type !== "IfStatement" ? last : null
  }

  get #swallowsBreak() {
    return this.#bodies.some((body) => swallowsBreak(body))
  }

  get #switchText() {
    return `switch (${this.#discriminant}) {\n${this.#caseBlocks}\n${this.#indent}}`
  }

  get #discriminant() {
    return this.#sourceCode.getText(this.#branches[0].test.left)
  }

  get #caseBlocks() {
    const cases = this.#branches.map((branch) => this.#caseTextFor(branch))
    return (this.#finalAlternate ? [ ...cases, this.#defaultText ] : cases).join("\n")
  }

  get #defaultText() {
    return `${this.#indent}  default:\n${this.#bodyTextOf(this.#finalAlternate, { withBreak: false })}`
  }

  get #indent() {
    return " ".repeat(this.#node.loc.start.column)
  }
}

function reindent(text, { from, to }) {
  const lines = text.split("\n")
  const delta = to - from
  return [ " ".repeat(to) + lines[0], ...lines.slice(1).map((line) => reindentLine(line, delta)) ].join("\n")
}

function reindentLine(line, delta) {
  if (line.trim() === "") return line
  if (delta >= 0) return " ".repeat(delta) + line
  return line.slice(-delta)
}

function equalityComparison(test) {
  if (test.type !== "BinaryExpression") return null
  if (test.operator !== "===" && test.operator !== "==") return null

  return test.left.type === "Identifier" ? test.left.name : null
}

function ifChainFrom(node) {
  return node?.type === "IfStatement" ? [ node, ...ifChainFrom(node.alternate) ] : []
}

function isConvertibleBody(body) {
  return body.type === "BlockStatement" ? body.body.length > 0 : isSingleLine(body)
}

function swallowsBreak(body) {
  return Array.from(walk(body)).some((node) => isUnlabeledBreak(node) && !isInsideLoopOrSwitch(node, body))
}

function isUnlabeledBreak(node) {
  return node.type === "BreakStatement" && !node.label
}

function isInsideLoopOrSwitch(node, boundary) {
  for (let current = node.parent; current && current !== boundary; current = current.parent) {
    if (LOOP_OR_SWITCH.has(current.type)) return true
  }
  return false
}
