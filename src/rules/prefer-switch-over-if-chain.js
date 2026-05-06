// `if (x === A) ... else if (x === B) ... else if (x === C) ...` chains with 3+ branches comparing the same subject
// read better as a `switch` (and in TS get exhaustiveness checking on union types).
//
// The fix is withheld when converting would change behaviour: a loose `==` (switch matches strictly), an unlabeled
// `break` that the switch would swallow, or an empty / multi-line non-block branch whose reindentation would be unsafe.
// A branch that declares a binding keeps its braces, since all cases otherwise share one scope, and each branch carries
// its own comments across.

import { isSingleLine, walk } from "#helpers/ast"
import { isFunctionExit } from "#helpers/functions"
import { commentsIn } from "#helpers/source"
import { reportProblem } from "#helpers/report"

const DEFAULT_MIN = 3
const LOOP_OR_SWITCH = new Set([
  "ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "DoWhileStatement", "SwitchStatement"
])
const DECLARATION_TYPES = new Set([ "ClassDeclaration", "FunctionDeclaration", "VariableDeclaration" ])

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Prefer `switch` over `if/else if` chains comparing the same subject" },
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
    return this.#branchFor(branch.consequent).textWith(this.#caseHeaderFor(branch), { withBreak: true })
  }

  #branchFor(consequent) {
    return new Branch(consequent, this.#sourceCode, this.#indent)
  }

  #caseHeaderFor(branch) {
    return `${this.#indent}  case ${this.#sourceCode.getText(branch.test.right)}:`
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
    return this.#isStrict && this.#isReindentable && !this.#swallowsBreak && !this.#dropsComment
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

  // The switch is rebuilt from the branch bodies, so a comment outside all of them, one sitting between two branches,
  // would be dropped. Whose it is cannot be read off the source, so the chain stays as its author wrote it.
  get #dropsComment() {
    return this.#commentCount > this.#commentsInsideBodies
  }

  get #commentCount() {
    return commentsIn(this.#sourceCode, this.#node.range).length
  }

  get #commentsInsideBodies() {
    return this.#bodies.reduce((total, body) => total + commentsIn(this.#sourceCode, body.range).length, 0)
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
    return this.#branchFor(this.#finalAlternate).textWith(`${this.#indent}  default:`, { withBreak: false })
  }

  get #indent() {
    return " ".repeat(this.#node.loc.start.column)
  }
}

class Branch {
  #consequent
  #sourceCode
  #indent

  constructor(consequent, sourceCode, indent) {
    this.#consequent = consequent
    this.#sourceCode = sourceCode
    this.#indent = indent
  }

  textWith(header, { withBreak }) {
    const body = this.#bodyText({ withBreak })
    return this.#declaresBinding ? `${header} {\n${body}\n${this.#indent}  }` : `${header}\n${body}`
  }

  #bodyText({ withBreak }) {
    const body = this.#reindented
    return withBreak && !isFunctionExit(this.#lastStatement) ? `${body}\n${this.#indent}    break` : body
  }

  get #declaresBinding() {
    return this.#statements.some((statement) => DECLARATION_TYPES.has(statement.type))
  }

  get #statements() {
    return statementsOf(this.#consequent)
  }

  get #reindented() {
    return reindent(this.#sourceCode.text.slice(this.#start.range[0], this.#end.range[1]), {
      from: this.#start.loc.start.column,
      to: this.#indent.length + 4
    })
  }

  // Inside a block the branch's own comments sit between the braces and travel with it. A single-statement branch has
  // no interior, so a neighbouring comment belongs to the code around the `if` and stays there.
  get #start() {
    return (this.#isBlock ? this.#sourceCode.getCommentsBefore(this.#firstStatement)[0] : null) ?? this.#firstStatement
  }

  get #isBlock() {
    return this.#consequent.type === "BlockStatement"
  }

  get #firstStatement() {
    return this.#statements[0]
  }

  get #end() {
    return (this.#isBlock ? this.#sourceCode.getCommentsAfter(this.#lastStatement).at(-1) : null) ?? this.#lastStatement
  }

  get #lastStatement() {
    return this.#statements.at(-1)
  }
}

function statementsOf(consequent) {
  return consequent.type === "BlockStatement" ? consequent.body : [ consequent ]
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

  return new Subject(test.left).name
}

// A `switch` reads its subject once instead of once per branch, so only a plain name, `this.foo` or `obj.foo` qualify.
// A deeper path or a computed key is where a getter with work behind it hides, and reading it fewer times would show.
class Subject {
  #node

  constructor(node) {
    this.#node = node
  }

  get name() {
    if (this.#node.type === "Identifier") return this.#node.name

    return this.#isPlainMember ? `${this.#objectName}.${this.#node.property.name}` : null
  }

  get #isPlainMember() {
    return this.#node.type === "MemberExpression"
      && !this.#node.computed
      && this.#node.property.type === "Identifier"
      && (this.#node.object.type === "ThisExpression" || this.#node.object.type === "Identifier")
  }

  get #objectName() {
    return this.#node.object.type === "ThisExpression" ? "this" : this.#node.object.name
  }
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
