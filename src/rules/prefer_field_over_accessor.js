// A getter that only hands out the private field of its own name, alone or with the setter that only stores into it, is
// a public field written the long way. The class mutates the field itself, and the accessor keeps nothing out that a
// field would let in. The rule reports the design directly, but does not autofix it: replacing a prototype accessor
// with an own field changes reflection, inheritance and property descriptors even when the relay itself is trivial.

import { isAccessor, isThisMember, staticMemberKeyOf } from "#helpers/syntax/classes"
import { soleStatementOf } from "#helpers/syntax/functions"
import { reportProblems } from "#helpers/eslint/report"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Prefer a public field over accessors that only relay the private field of the same name" },
    schema: [],
    messages: { preferField: "`{{name}}` only relays `#{{name}}`. Make the field public and drop the accessor." }
  },
  create(context) {
    return { ClassBody: (node) => reportProblems(context, new ClassFields(node)) }
  }
}

class ClassFields {
  #body
  #cachedMembers

  constructor(body) {
    this.#body = body
  }

  get problems() {
    return this.#relays
      .filter((relay) => relay.isTrivial)
      .map((relay) => relay.problem)
  }

  membersNamed(name) {
    return this.#members.named(name)
  }

  get #relays() {
    return this.#body.body
      .filter((member) => member.type === "PropertyDefinition"
        && !member.static && member.key.type === "PrivateIdentifier")
      .map((field) => new Relay(field, this))
  }

  get #members() {
    return this.#cachedMembers ??= new PublicMemberIndex(this.#body.body)
  }
}

class Relay {
  #cachedMembers
  #cachedGetter
  #field
  #owner

  constructor(field, owner) {
    this.#field = field
    this.#owner = owner
  }

  get problem() {
    return { node: this.#getter.key, messageId: "preferField", data: { name: this.#name } }
  }

  get isTrivial() {
    return Boolean(this.#getter) && this.#members.every((member) => new Accessor(member).relays(this.#name))
  }

  get #getter() {
    return this.#cachedGetter ??= this.#members.find((member) => member.kind === "get")
  }

  get #members() {
    return this.#cachedMembers ??= this.#owner.membersNamed(this.#name)
  }

  get #name() {
    return this.#field.key.name
  }
}

class Accessor {
  #node

  constructor(node) {
    this.#node = node
  }

  relays(name) {
    return isAccessor(this.#node) && (this.#node.kind === "get" ? this.#returns(name) : this.#stores(name))
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

class PublicMemberIndex {
  #byName = new Map()

  constructor(members) {
    members.forEach((member) => this.#add(member))
  }

  named(name) {
    return this.#byName.get(name) ?? []
  }

  #add(member) {
    const { name } = new PublicInstanceMember(member)
    if (name === null) return

    if (!this.#byName.has(name)) this.#byName.set(name, [])
    this.#byName.get(name).push(member)
  }
}

class PublicInstanceMember {
  #member

  constructor(member) {
    this.#member = member
  }

  get name() {
    const key = this.#isEligible ? staticMemberKeyOf(this.#member) : null
    return key?.node.type === "PrivateIdentifier" ? null : key?.name ?? null
  }

  get #isEligible() {
    return [ "MethodDefinition", "PropertyDefinition" ].includes(this.#member.type) && !this.#member.static
  }
}
