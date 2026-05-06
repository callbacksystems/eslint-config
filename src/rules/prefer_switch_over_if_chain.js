// `if (x === A) ... else if (x === B) ... else if (x === C) ...` chains with 3+ branches comparing the same subject
// read better as a `switch` (and in TS get exhaustiveness checking on union types).
//
// The fix is withheld when converting would change behavior: a loose `==` (switch matches strictly), an unlabeled
// `break` that the switch would swallow, or an empty / multi-line non-block branch whose reindentation would be unsafe.
// A branch that declares a binding keeps its braces, since all cases otherwise share one scope, and each branch carries
// its own comments across.

import { childNodesOf, pushReversed } from "#helpers/syntax/ast"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { hasAdjacentToolDirectiveBefore, isNextStatementDirective } from "#helpers/source/comment_directives"
import { isDeclarativeGlobalDefinition } from "#helpers/scope/global_definitions"
import { commentsIn, lineEndingOf } from "#helpers/source/source"
import { reportProblem } from "#helpers/eslint/report"
import { SwitchBranch } from "#helpers/flow/switch_branch"

const LOOP_OR_SWITCH = new Set([
  "ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "DoWhileStatement", "SwitchStatement"
])

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
    const bindings = new BindingResolver(context.sourceCode)
    return {
      IfStatement(node) {
        if (isTopOfChain(node)) {
          reportProblem(context, new Chain(node, { min, bindings, sourceCode: context.sourceCode }))
        }
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
  #bindings
  #cachedBodies
  #cachedBranches
  #cachedComparisonNames
  #cachedLineEnding
  #cachedNames

  constructor(node, { min, sourceCode, bindings }) {
    this.#node = node
    this.#min = min
    this.#sourceCode = sourceCode
    this.#bindings = bindings
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
    return this.#cachedNames ??= this.#comparisonNames.every(Boolean) ? this.#comparisonNames : []
  }

  get #comparisonNames() {
    return this.#cachedComparisonNames ??= this.#branches.map((branch) => equalityComparison(branch.test))
  }

  get #branches() {
    return this.#cachedBranches ??= [ ...ifChainFrom(this.#node) ]
  }

  get #fix() {
    return this.#isConvertible
      ? (fixer) => fixer.replaceTextRange([ this.#node.range[0], this.#replacementEnd ], this.#switchText)
      : null
  }

  get #isConvertible() {
    return this.#isStrict
      && this.#hasStableDiscriminant
      && this.#hasStableCaseValues
      && this.#isReindentable
      && !this.#isSwallowingBreak
      && !this.#isDroppingComment
      && !this.#hasToolDirective
  }

  get #isStrict() {
    return this.#branches.every((branch) => branch.test.operator === "===")
  }

  // A property may be a getter. Replacing repeated reads with one switch discriminant would change its effects.
  get #hasStableDiscriminant() {
    const subject = this.#branches[0].test.left
    return subject.type === "Identifier"
      && new StableDiscriminant(subject, this.#bindings, this.#sourceCode).isPresent
      && !this.#sourceCode.getAncestors(subject).some(isWithStatement)
  }

  // A case expression runs after `switch` captures the discriminant. Keep the fix to values that cannot mutate it.
  get #hasStableCaseValues() {
    return this.#branches.every((branch) => branch.test.right.type === "Literal")
  }

  get #isReindentable() {
    return this.#bodies.every((body) => this.#branchFor(body).isConvertible)
  }

  get #bodies() {
    return this.#cachedBodies ??= this.#finalAlternate
      ? [ ...this.#consequents, this.#finalAlternate ]
      : this.#consequents
  }

  get #finalAlternate() {
    const last = this.#branches.at(-1).alternate
    return last && last.type !== "IfStatement" ? last : null
  }

  get #consequents() {
    return this.#branches.map((branch) => branch.consequent)
  }

  #branchFor(consequent) {
    return new SwitchBranch(consequent, {
      sourceCode: this.#sourceCode,
      lineEnding: this.#lineEnding,
      chain: this.#node,
      chainEnd: this.#replacementEnd
    })
  }

  get #lineEnding() {
    return this.#cachedLineEnding ??= lineEndingOf(this.#sourceCode)
  }

  get #replacementEnd() {
    return this.#sourceCode.getCommentsAfter(this.#node)
      .findLast((comment) => comment.loc.start.line === this.#node.loc.end.line)?.range[1] ?? this.#node.range[1]
  }

  get #isSwallowingBreak() {
    return this.#bodies.some((body) => new SwallowedBreak(body).isPresent)
  }

  // A comment between two branches belongs to no body, and whose it is cannot be read off the source, so the chain
  // stays.
  get #isDroppingComment() {
    return this.#commentCount > this.#commentsInsideBodies
  }

  get #commentCount() {
    return commentsIn(this.#sourceCode, [ this.#node.range[0], this.#replacementEnd ]).length
  }

  get #commentsInsideBodies() {
    return this.#bodies.reduce((total, body) => total + this.#branchFor(body).ownCommentCount, 0)
  }

  get #hasToolDirective() {
    return this.#hasNextStatementDirective
      || hasAdjacentToolDirectiveBefore(this.#sourceCode, this.#node)
  }

  get #hasNextStatementDirective() {
    return commentsIn(this.#sourceCode, [ this.#node.range[0], this.#replacementEnd ])
      .some((comment) => isNextStatementDirective(comment.value))
  }

  get #switchText() {
    return `switch (${this.#discriminant}) {${this.#lineEnding}${this.#caseBlocks}`
      + `${this.#lineEnding}${this.#indent}}`
  }

  get #discriminant() {
    return this.#sourceCode.getText(this.#branches[0].test.left)
  }

  get #caseBlocks() {
    const cases = this.#branches.map((branch) => this.#caseTextFor(branch))
    return (this.#finalAlternate ? [ ...cases, this.#defaultText ] : cases).join(this.#lineEnding)
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

function* ifChainFrom(node) {
  for (let current = node; current?.type === "IfStatement"; current = current.alternate) yield current
}

// A classic script's top-level `var` lives on the global object. If the host supplied an accessor there, repeated
// identifier reads can yield different values, while a switch reads only once. Declarative globals and locals do not.
class StableDiscriminant {
  #identifier
  #bindings
  #sourceCode
  #cachedVariable

  constructor(identifier, bindings, sourceCode) {
    this.#identifier = identifier
    this.#bindings = bindings
    this.#sourceCode = sourceCode
  }

  get isPresent() {
    return Boolean(this.#variable?.defs.length) && !this.#isObjectBackedScriptGlobal
  }

  get #variable() {
    return this.#cachedVariable ??= this.#bindings.variableFor(this.#identifier)
  }

  get #isObjectBackedScriptGlobal() {
    return this.#sourceCode.ast.sourceType === "script" && this.#variable.scope.type === "global"
      && !this.#variable.defs.every(isDeclarativeGlobalDefinition)
  }
}

function isWithStatement(node) {
  return node.type === "WithStatement"
}

class SwallowedBreak {
  #pending

  constructor(body) {
    this.#pending = [ new BreakContext(body) ]
  }

  get isPresent() {
    while (this.#pending.length > 0) {
      const context = this.#pending.pop()
      if (context.isSwallowed) return true

      pushReversed(this.#pending, context.children)
    }
    return false
  }
}

class BreakContext {
  #isProtected

  constructor(node, isProtected = false) {
    this.node = node
    this.#isProtected = isProtected || LOOP_OR_SWITCH.has(node.type)
  }

  get isSwallowed() {
    return this.node.type === "BreakStatement" && !this.node.label && !this.#isProtected
  }

  get children() {
    return childNodesOf(this.node).map((node) => new BreakContext(node, this.#isProtected))
  }
}
