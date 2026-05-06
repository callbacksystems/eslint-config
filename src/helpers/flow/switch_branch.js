import { isSingleLine, statementInsideLabels } from "#helpers/syntax/ast"
import { canFallThroughSequence } from "#helpers/flow/function_completion"
import { commentsIn, isOnOwnLine } from "#helpers/source/source"

const DECLARATION_TYPES = new Set([ "ClassDeclaration", "FunctionDeclaration", "VariableDeclaration" ])

export class SwitchBranch {
  #consequent
  #sourceCode
  #lineEnding
  #chain
  #chainEnd

  constructor(consequent, { sourceCode, lineEnding, chain, chainEnd }) {
    this.#consequent = consequent
    this.#sourceCode = sourceCode
    this.#lineEnding = lineEnding
    this.#chain = chain
    this.#chainEnd = chainEnd
  }

  textWith(header, { withBreak }) {
    const body = `${this.#bodyText({ withBreak })}${this.#standingAfter}`
    const opening = `${header}${this.#isDeclaringBinding ? " {" : ""}${this.#openingComment}`
    return this.#isDeclaringBinding
      ? `${opening}${this.#lineEnding}${body}${this.#lineEnding}${this.#indent}  }`
      : `${opening}${this.#lineEnding}${body}`
  }

  get isConvertible() {
    return this.#hasBody && !this.#hasMultilineToken
  }

  get ownCommentCount() {
    return commentsIn(this.#sourceCode, [ this.#start.range[0], this.#end.range[1] ]).length
      + this.#braceComments.length + this.#afterComments.length
  }

  #bodyText({ withBreak }) {
    const body = `${this.#reindented}${this.#trailingAfter}`
    return withBreak && canFallThroughSequence(this.#statements)
      ? `${body}${this.#lineEnding}${this.#indent}    break`
      : body
  }

  get #reindented() {
    return reindent(this.#sourceCode.text.slice(this.#start.range[0], this.#end.range[1]), {
      from: this.#start.loc.start.column,
      to: this.#indent.length + 4,
      lineEnding: this.#lineEnding
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

  get #trailingAfter() {
    return this.#afterComments.filter((comment) => !isOnOwnLine(this.#sourceCode, comment))
      .map((comment) => ` ${this.#sourceCode.getText(comment)}`)
      .join("")
  }

  get #afterComments() {
    return this.#sourceCode.getCommentsAfter(this.#consequent)
      .filter((comment) => comment.range[1] <= this.#chainEnd)
  }

  get #standingAfter() {
    return this.#afterComments.filter((comment) => isOnOwnLine(this.#sourceCode, comment))
      .map((comment) => `${this.#lineEnding}${this.#indent}    ${this.#sourceCode.getText(comment)}`)
      .join("")
  }

  get #isDeclaringBinding() {
    return this.#statements.some(hasBranchBinding)
  }

  get #openingComment() {
    return this.#braceComments.map((comment) => ` ${this.#sourceCode.getText(comment)}`).join("")
  }

  get #braceComments() {
    return this.#isBlock
      ? this.#sourceCode.getCommentsInside(this.#consequent).filter((comment) => this.#isTrailingBrace(comment))
      : []
  }

  #isTrailingBrace(comment) {
    return comment.loc.start.line === this.#consequent.loc.start.line
      && comment.range[1] <= this.#firstStatement.range[0]
  }

  get #hasBody() {
    return this.#isBlock ? this.#statements.length > 0 : isSingleLine(this.#consequent)
  }

  // Reindenting inside a template, JSX text, or a line-continuation string can change the runtime value.
  get #hasMultilineToken() {
    return this.#sourceCode.getTokens(this.#consequent).some((token) => !isSingleLine(token))
  }
}

function reindent(text, { from, to, lineEnding }) {
  const lines = text.split(lineEnding)
  const delta = to - from
  return [ " ".repeat(to) + lines[0], ...lines.slice(1).map((line) => reindentLine(line, delta)) ]
    .join(lineEnding)
}

function reindentLine(line, delta) {
  if (line.trim() === "") return line
  if (delta >= 0) return " ".repeat(delta) + line
  return line.slice(Math.min(-delta, indentationOf(line).length))
}

function indentationOf(line) {
  return /^[ \t]*/u.exec(line)[0]
}

function statementsOf(consequent) {
  return consequent.type === "BlockStatement" ? consequent.body : [ consequent ]
}

function hasBranchBinding(statement) {
  return DECLARATION_TYPES.has(statementInsideLabels(statement).type)
}
