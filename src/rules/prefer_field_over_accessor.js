// A getter that only hands out the private field of its own name, alone or with the setter that only stores into it, is
// a public field written the long way. The class mutates the field itself, and the accessor keeps nothing out that a
// field would let in. The fix drops the accessors and makes the field public, renaming every `#name` in the class.

import { nodesIn } from "#helpers/ast"
import { isThisMember } from "#helpers/classes"
import { soleStatementOf } from "#helpers/functions"
import { Block } from "#helpers/block"
import { reportProblems } from "#helpers/report"
import { commentsIn, removalKeepingComments } from "#helpers/source"

const ACCESSOR_KINDS = new Set([ "get", "set" ])

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Prefer a public field over accessors that only relay the private field of the same name" },
    schema: [],
    messages: { preferField: "`{{name}}` only relays `#{{name}}`. Make the field public and drop the accessor." }
  },
  create(context) {
    return { ClassBody: (node) => reportProblems(context, new ClassFields(node, context.sourceCode)) }
  }
}

class ClassFields {
  constructor(body, sourceCode) {
    this.body = body
    this.sourceCode = sourceCode
  }

  get problems() {
    return this.#privateFields
      .map((field) => new Relay(field, this))
      .filter((relay) => relay.isTrivial)
      .map((relay) => relay.problem)
  }

  accessorsNamed(name) {
    return this.body.body.filter((member) =>
      member.type === "MethodDefinition" && ACCESSOR_KINDS.has(member.kind) && !member.static && !member.computed
      && member.key.type === "Identifier" && member.key.name === name)
  }

  get #privateFields() {
    return this.body.body.filter((member) =>
      member.type === "PropertyDefinition" && !member.static && member.key.type === "PrivateIdentifier")
  }
}

class Relay {
  #field
  #owner

  constructor(field, owner) {
    this.#field = field
    this.#owner = owner
  }

  get problem() {
    return { node: this.#getter.key, messageId: "preferField", data: { name: this.#name }, fix: this.#fix }
  }

  get isTrivial() {
    return Boolean(this.#getter) && this.#accessors.every((accessor) => new Accessor(accessor).relays(this.#name))
  }

  get #getter() {
    return this.#accessors.find((accessor) => accessor.kind === "get")
  }

  get #accessors() {
    return this.#owner.accessorsNamed(this.#name)
  }

  get #name() {
    return this.#field.key.name
  }

  get #fix() {
    return this.#isRenamable ? (fixer) => this.#renamed(fixer) : null
  }

  // `#name in object` is a brand check with no public spelling, and a nested class declaring `#name` shadows it.
  get #isRenamable() {
    return this.#privateIdentifiers.every(isReference) && !this.#isShadowed
  }

  get #privateIdentifiers() {
    return nodesIn(this.#owner.body)
      .filter((node) => node.type === "PrivateIdentifier" && node.name === this.#name)
      .toArray()
  }

  get #isShadowed() {
    return nodesIn(this.#owner.body)
      .some((node) => isNestedClassBody(node, this.#owner.body) && declares(node, this.#name))
  }

  #renamed(fixer) {
    return [
      ...new Removal(this.#owner.sourceCode, this.#removed, this.#home).fixes(fixer),
      ...this.#renamedIdentifiers.map((identifier) => fixer.replaceText(identifier, this.#name))
    ]
  }

  // A field without a value declares only the private name, so it goes with the accessors.
  get #removed() {
    return this.#field.value ? this.#accessors : [ this.#field, ...this.#accessors ]
  }

  // The comments on an accessor describe the field, so they move above its declaration, or above the assignment that
  // stands in for one once the declaration is gone.
  get #home() {
    return this.#field.value ? this.#field : this.#firstAssignment
  }

  get #firstAssignment() {
    return nodesIn(this.#owner.body).find((node) => this.#isKeptAssignment(node))
  }

  #isKeptAssignment(node) {
    return node.type === "ExpressionStatement" && assigns(node.expression, this.#name) && !this.#isRemoved(node)
  }

  #isRemoved(node) {
    return this.#removed.some((member) => contains(member, node))
  }

  get #renamedIdentifiers() {
    return this.#privateIdentifiers.filter((identifier) => !this.#isRemoved(identifier))
  }
}

class Accessor {
  #node

  constructor(node) {
    this.#node = node
  }

  relays(name) {
    return this.#node.kind === "get" ? this.#returns(name) : this.#stores(name)
  }

  #returns(name) {
    return this.#statement?.type === "ReturnStatement" && isPrivateField(this.#statement.argument, name)
  }

  get #statement() {
    return soleStatementOf(this.#node.value.body)
  }

  #stores(name) {
    const { expression } = this.#statement?.type === "ExpressionStatement" ? this.#statement : {}
    return expression?.type === "AssignmentExpression" && expression.operator === "="
      && isPrivateField(expression.left, name) && this.#isParameter(expression.right)
  }

  #isParameter(node) {
    const [ parameter ] = this.#node.value.params
    return parameter?.type === "Identifier" && node.type === "Identifier" && node.name === parameter.name
  }
}

function isPrivateField(node, name) {
  return isThisMember(node) && node.property.type === "PrivateIdentifier" && node.property.name === name
}

function isReference(identifier) {
  return identifier.parent.type !== "BinaryExpression"
}

function isNestedClassBody(node, body) {
  return node !== body && node.type === "ClassBody"
}

function declares(classBody, name) {
  return classBody.body.some((member) => member.key?.type === "PrivateIdentifier" && member.key.name === name)
}

// The members to remove as whole lines, comments included, each span taking the blank line after it (or the one before
// it when it closes the body). Their comments land above the home, or stay in place when there is none.
class Removal {
  #sourceCode
  #members
  #home

  constructor(sourceCode, members, home) {
    this.#sourceCode = sourceCode
    this.#members = members
    this.#home = home
  }

  fixes(fixer) {
    return this.#home ? this.#rehomed(fixer) : this.#inPlace(fixer)
  }

  #rehomed(fixer) {
    const removals = this.#spans.map((span) => fixer.removeRange(span))
    return this.#comments.length > 0 ? [ ...removals, this.#insertedComments(fixer) ] : removals
  }

  get #spans() {
    return this.#members.map((member) => this.#linesOf(member)).sort(byStart)
      .reduce((spans, span) => this.#joined(spans, span), [])
      .map((span) => this.#withBlankLine(span))
  }

  #linesOf(member) {
    const block = new Block(this.#sourceCode, member)
    return [ block.start, this.#text.indexOf("\n", block.end) + 1 ]
  }

  get #text() {
    return this.#sourceCode.text
  }

  #joined(spans, span) {
    const last = spans.at(-1)
    return last && this.#isBlank([ last[1], span[0] ])
      ? [ ...spans.slice(0, -1), [ last[0], span[1] ] ]
      : [ ...spans, span ]
  }

  #isBlank([ start, end ]) {
    return this.#text.slice(start, end).trim() === ""
  }

  #withBlankLine([ start, end ]) {
    const after = this.#blankLineAfter(end)
    return after ? [ start, after ] : [ this.#blankLineBefore(start) ?? start, end ]
  }

  #blankLineAfter(end) {
    const match = /^[ \t]*\n/u.exec(this.#text.slice(end))
    return match ? end + match[0].length : null
  }

  #blankLineBefore(start) {
    const match = /\n[ \t]*\n$/u.exec(this.#text.slice(0, start))
    return match ? start - match[0].length + 1 : null
  }

  get #comments() {
    return this.#spans.flatMap((span) => commentsIn(this.#sourceCode, span))
  }

  #insertedComments(fixer) {
    return fixer.insertTextBeforeRange(this.#homeLine, this.#commentLines)
  }

  get #homeLine() {
    const start = this.#home.range[0] - this.#home.loc.start.column
    return [ start, start ]
  }

  get #commentLines() {
    const indent = " ".repeat(this.#home.loc.start.column)
    return this.#comments.map((comment) => `${indent}${this.#sourceCode.getText(comment)}\n`).join("")
  }

  #inPlace(fixer) {
    return this.#spans.map((span) => fixer.replaceTextRange(span, removalKeepingComments(this.#sourceCode, span)))
  }
}

function byStart(left, right) {
  return left[0] - right[0]
}

function assigns(expression, name) {
  return expression.type === "AssignmentExpression" && isPrivateField(expression.left, name)
}

function contains(member, node) {
  return node.range[0] >= member.range[0] && node.range[1] <= member.range[1]
}
