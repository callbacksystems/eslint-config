// `if (x === A) ... else if (x === B) ... else if (x === C) ...` chains with 3+ branches comparing the same subject
// read better as a `switch` (and in TS get exhaustiveness checking on union types).
//
// The fix is withheld when converting would change behavior: a loose `==` (switch matches strictly), an unlabeled
// `break` that the switch would swallow, or an empty / multi-line non-block branch whose reindentation would be unsafe.
// A branch that declares a binding keeps its braces, since all cases otherwise share one scope, and each branch carries
// its own comments across.

import { isSingleLine, nodesIn } from "#helpers/ast"
import { isFunctionExit } from "#helpers/functions"
import { commentsIn, isOnOwnLine } from "#helpers/source"
import { reportProblem } from "#helpers/report"

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
    defaultOptions: [ { min: 3 } ],
    messages: {
      preferSwitch: "Chain of {{count}} `if/else if` comparing `{{name}}`. Use `switch` for clarity and exhaustiveness."
    }
  },
  create(context) {
    const { min } = context.options[0]
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

  // A comment between two branches belongs to no body, and whose it is cannot be read off the source, so the chain
  // stays.
  get #dropsComment() {
    return this.#commentCount > this.#commentsInsideBodies
  }

  get #commentCount() {
    return commentsIn(this.#sourceCode, this.#node.range).length
  }

  get #commentsInsideBodies() {
    return this.#bodies.reduce((total, body) => total + this.#branchFor(body).ownCommentCount, 0)
  }

  #branchFor(consequent) {
    return new Branch(consequent, this.#sourceCode)
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

  #caseTextFor(branch) {
    return this.#branchFor(branch.consequent).textWith(this.#caseHeaderFor(branch), { withBreak: true })
  }

  #caseHeaderFor(branch) {
    return `${this.#indent}  case ${this.#sourceCode.getText(branch.test.right)}:`
  }

  get #indent() {
    return " ".repeat(this.#node.loc.start.column)
  }

  get #defaultText() {
    return this.#branchFor(this.#finalAlternate).textWith(`${this.#indent}  default:`, { withBreak: false })
  }
}

function equalityComparison(test) {
  if (test.type !== "BinaryExpression") return null
  if (test.operator !== "===" && test.operator !== "==") return null

  return new Subject(test.left).name
}

// A `switch` reads its subject once instead of once per branch, so a deeper path or a computed key, where a getter with
// work behind it hides, is left alone.
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
  return nodesIn(body).some((node) => isUnlabeledBreak(node) && !isInsideLoopOrSwitch(node, body))
}

function isUnlabeledBreak(node) {
  return node.type === "BreakStatement" && !node.label
}

function isInsideLoopOrSwitch(node, boundary) {
  for (let current = node; current !== boundary; current = current.parent) {
    if (LOOP_OR_SWITCH.has(current.type)) return true
  }
  return false
}

class Branch {
  #consequent
  #sourceCode

  constructor(consequent, sourceCode) {
    this.#consequent = consequent
    this.#sourceCode = sourceCode
  }

  textWith(header, { withBreak }) {
    const body = `${this.#bodyText({ withBreak })}${this.#standingAfter}`
    const opening = `${header}${this.#declaresBinding ? " {" : ""}${this.#openingComment}`
    return this.#declaresBinding ? `${opening}\n${body}\n${this.#indent}  }` : `${opening}\n${body}`
  }

  get ownCommentCount() {
    return commentsIn(this.#sourceCode, [ this.#start.range[0], this.#end.range[1] ]).length
      + this.#braceComments.length + this.#afterComments.length
  }

  #bodyText({ withBreak }) {
    const body = `${this.#reindented}${this.#trailingAfter}`
    return withBreak && !isFunctionExit(this.#lastStatement) ? `${body}\n${this.#indent}    break` : body
  }

  get #reindented() {
    return reindent(this.#sourceCode.text.slice(this.#start.range[0], this.#end.range[1]), {
      from: this.#start.loc.start.column,
      to: this.#indent.length + 4
    })
  }

  // A single-statement branch has no interior, so a comment beside it belongs to the code around the `if`.
  get #start() {
    return (this.#isBlock ? this.#leadingComments[0] : null) ?? this.#firstStatement
  }

  get #isBlock() {
    return this.#consequent.type === "BlockStatement"
  }

  get #leadingComments() {
    return this.#sourceCode.getCommentsBefore(this.#firstStatement)
      .filter((comment) => isOnOwnLine(this.#sourceCode, comment))
  }

  get #firstStatement() {
    return this.#statements[0]
  }

  get #statements() {
    return statementsOf(this.#consequent)
  }

  get #end() {
    return (this.#isBlock ? this.#sourceCode.getCommentsAfter(this.#lastStatement).at(-1) : null) ?? this.#lastStatement
  }

  get #lastStatement() {
    return this.#statements.at(-1)
  }

  get #indent() {
    return " ".repeat(this.#chain.loc.start.column)
  }

  get #chain() {
    return chainAbove(this.#consequent.parent)
  }

  get #trailingAfter() {
    return this.#afterComments.filter((comment) => !isOnOwnLine(this.#sourceCode, comment))
      .map((comment) => ` ${this.#sourceCode.getText(comment)}`)
      .join("")
  }

  get #afterComments() {
    return this.#sourceCode.getCommentsAfter(this.#consequent).filter((comment) => comment.range[1] <= this.#chainEnd)
  }

  get #chainEnd() {
    return this.#chain.range[1]
  }

  get #standingAfter() {
    return this.#afterComments.filter((comment) => isOnOwnLine(this.#sourceCode, comment))
      .map((comment) => `\n${this.#indent}    ${this.#sourceCode.getText(comment)}`)
      .join("")
  }

  get #declaresBinding() {
    return this.#statements.some((statement) => DECLARATION_TYPES.has(statement.type))
  }

  get #openingComment() {
    return this.#braceComments.map((comment) => ` ${this.#sourceCode.getText(comment)}`).join("")
  }

  get #braceComments() {
    return this.#isBlock
      ? this.#sourceCode.getCommentsInside(this.#consequent).filter((comment) => this.#trailsBrace(comment))
      : []
  }

  #trailsBrace(comment) {
    return comment.loc.start.line === this.#consequent.loc.start.line
      && comment.range[1] <= this.#firstStatement.range[0]
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

function statementsOf(consequent) {
  return consequent.type === "BlockStatement" ? consequent.body : [ consequent ]
}

function chainAbove(node) {
  return isTopOfChain(node) ? node : chainAbove(node.parent)
}
