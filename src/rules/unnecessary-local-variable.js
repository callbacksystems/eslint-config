// `const directory = forbiddenDirectory()` read only once is a needless alias: call it directly, or extract a
// well-named method. A value read more than once, read inside a nested function (where it may be an accumulator or
// guard against re-evaluation), or read only to restore state in a `finally`/`catch` is left alone. The inline fix runs
// only when the single read is in the very next statement, so moving the call cannot cross an intervening side effect.

import { readReferences } from "#helpers/ast"
import { sharesFunction } from "#helpers/functions"
import { reportProblem } from "#helpers/report"

const ALIAS_TYPES = new Set([ "CallExpression", "MemberExpression" ])

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Disallow a local variable that aliases a call used only once" },
    schema: [],
    messages: { unnecessaryLocal: "`{{name}}` aliases a call used once. Call it directly or extract a method." }
  },
  create(context) {
    return { VariableDeclarator: (node) => reportProblem(context, new Alias(node, context.sourceCode)) }
  }
}

class Alias {
  #node
  #sourceCode

  constructor(node, sourceCode) {
    this.#node = node
    this.#sourceCode = sourceCode
  }

  get problem() {
    return this.#isNeedless
      ? { node: this.#node, messageId: "unnecessaryLocal", data: { name: this.#node.id.name }, fix: this.#fix }
      : null
  }

  #containsRead(statement) {
    return this.#read.range[0] >= statement.range[0] && this.#read.range[1] <= statement.range[1]
  }

  get #isNeedless() {
    return this.#aliasesCall && this.#isReadOnceInScope && !this.#restoresState
  }

  get #aliasesCall() {
    const { id, init } = this.#node
    return id.type === "Identifier" && Boolean(init) && ALIAS_TYPES.has(init.type)
  }

  get #isReadOnceInScope() {
    return this.#reads.length === 1 && sharesFunction(this.#node, this.#read)
  }

  get #reads() {
    return readReferences(this.#sourceCode, this.#node)
  }

  get #read() {
    return this.#reads[0].identifier
  }

  get #restoresState() {
    return this.#sourceCode.getAncestors(this.#read).some(isRecoveryRegion)
  }

  // Inlining is safe only when the single read sits in the statement immediately after a single-declarator declaration:
  // nothing runs between the call and its use, so the call's evaluation order cannot change.
  get #fix() {
    if (this.#isInlineable) {
      const initText = this.#sourceCode.getText(this.#node.init)
      return (fixer) => [
        fixer.removeRange([ this.#declaration.range[0], this.#removalEnd ]),
        fixer.replaceText(this.#read, initText)
      ]
    } else {
      return null
    }
  }

  get #isInlineable() {
    return this.#isSingleDeclaration && Boolean(this.#nextStatement) && this.#containsRead(this.#nextStatement)
  }

  get #isSingleDeclaration() {
    return this.#declaration.type === "VariableDeclaration" && this.#declaration.declarations.length === 1
  }

  get #declaration() {
    return this.#node.parent
  }

  get #nextStatement() {
    return this.#siblings?.[this.#siblings.indexOf(this.#declaration) + 1] ?? null
  }

  get #siblings() {
    const block = this.#declaration.parent
    return Array.isArray(block?.body) ? block.body : null
  }

  // Stop short of a comment standing between the declaration and its use: the alias is what goes away, the explanation
  // stays.
  get #removalEnd() {
    return this.#sourceCode.getCommentsBefore(this.#nextStatement)[0]?.range[0] ?? this.#nextStatement.range[0]
  }
}

function isRecoveryRegion(node) {
  return node.type === "CatchClause" || (node.parent?.type === "TryStatement" && node.parent.finalizer === node)
}
