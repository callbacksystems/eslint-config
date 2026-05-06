// A public member that only its own class reads is private in fact and public in name, so `#` should say what the class
// already does. The check is sound only where every reader is in view: a class the module keeps (not exported, no
// superclass to override, instances never handed to code this file does not show) whose members nobody outside the
// class mentions. The fix renames the member and every `this.name` of it inside the class.

import { isClassMember, isThisMember, memberName, staticAccessKeyOf, staticMemberKeyOf } from "#helpers/syntax/classes"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { ModuleView } from "#helpers/flow/module_view"
import { isIdentifierName } from "#helpers/strings/naming"
import { reportProblems } from "#helpers/eslint/report"
import { PrivateMemberIntrospection } from "#helpers/classes/private_member_introspection"

// The runtime calls protocol methods structurally, so their names never appear near an instance.
const PROTOCOL_MEMBERS = new Set([
  "constructor", "toString", "toJSON", "valueOf", "toLocaleString",
  "then", "catch", "finally", "next", "return", "throw"
])

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Disallow public class members that only their own class reads" },
    schema: [],
    messages: {
      preferPrivate: "`{{name}}` on `{{className}}` is only used inside the class. Make it private (`#{{name}}`)."
    }
  },
  create(context) {
    const module = new Module(context.sourceCode)
    return {
      ClassDeclaration: (node) => module.addClass(node),
      MemberExpression: (node) => module.addRead(node),
      Property: (node) => module.addRead(node),
      "Program:exit": () => reportProblems(context, module)
    }
  }
}

class Module {
  #bindings
  #view
  #classes = []
  #readsByName = new Map()

  constructor(sourceCode) {
    this.#bindings = BindingResolver.for(sourceCode)
    this.#view = new ModuleView(sourceCode)
  }

  get problems() {
    return this.#classes.flatMap((node) => new ModuleClass(node, this, {
      view: this.#view, bindings: this.#bindings
    }).problems)
  }

  addClass(node) {
    this.#classes.push(node)
  }

  addRead(node) {
    const { name } = new Read(node)
    if (name) this.#readsOf(name).push(node)
  }

  readsOf(name) {
    return this.#readsByName.get(name) ?? []
  }

  #readsOf(name) {
    if (!this.#readsByName.has(name)) this.#readsByName.set(name, [])

    return this.#readsByName.get(name)
  }
}

class ModuleClass {
  #node
  #module
  #view
  #cachedMembers
  #cachedPrivateNames
  #cachedThisIntrospection
  #bindings

  constructor(node, module, { view, bindings }) {
    this.#node = node
    this.#module = module
    this.#view = view
    this.#bindings = bindings
  }

  get problems() {
    return this.#isSealed ? this.#unreadGroups.map((group) => group.problem) : []
  }

  get name() {
    return this.#node.id?.name ?? null
  }

  isReadOutside(name, { hasOwnDefinition = false } = {}) {
    return this.#thisIntrospection.reads(name, { hasOwnDefinition })
      || this.#module.readsOf(name).some((read) => !this.#owns(read))
  }

  ownReadsOf(name) {
    return this.#module.readsOf(name).filter((read) => this.#owns(read))
  }

  hasPrivateMember(name) {
    return this.#privateNames.has(name)
  }

  get #isSealed() {
    return Boolean(this.name) && !this.#node.superClass && !this.#view.isExportedDeclaration(this.#node)
      && this.#view.keepsInstancesOf(this.#node)
  }

  get #unreadGroups() {
    return this.#memberGroups.filter((group) => !group.isReadOutside)
  }

  get #memberGroups() {
    return Map.groupBy(this.#publicMembers, memberName).entries()
      .map(([ name, definitions ]) => new MemberGroup(name, definitions, this))
      .toArray()
  }

  get #publicMembers() {
    return this.#members.filter(isPublicInstanceMember)
  }

  get #members() {
    return this.#cachedMembers ??= this.#node.body.body.filter(isClassMember)
  }

  get #thisIntrospection() {
    return this.#cachedThisIntrospection ??= new PrivateMemberIntrospection(
      this.#view.thisExpressionsOf(this.#node), { view: this.#view, classNode: this.#node, bindings: this.#bindings }
    )
  }

  #owns(read) {
    return isThisMember(read) && this.#view.isInstanceThisOf(read.object, this.#node)
  }

  get #privateNames() {
    return this.#cachedPrivateNames ??= new Set(this.#members
      .map(memberName)
      .filter((name) => name?.startsWith("#"))
      .map((name) => name.slice(1)))
  }
}

class MemberGroup {
  #name
  #definitions
  #owner

  constructor(name, definitions, owner) {
    this.#name = name
    this.#definitions = definitions
    this.#owner = owner
  }

  get problem() {
    return {
      node: this.#definitions[0].key,
      messageId: "preferPrivate",
      data: { name: this.#name, className: this.#owner.name },
      fix: this.#fix
    }
  }

  get isReadOutside() {
    return !this.#hasPrivatizableDefinitions || this.#owner.isReadOutside(this.#name, {
      hasOwnDefinition: this.#hasOwnDefinition
    })
  }

  get #fix() {
    return this.#owner.hasPrivateMember(this.#name) || this.#hasComputedSyntax
      ? null
      : (fixer) => this.#renamed(fixer)
  }

  get #hasComputedSyntax() {
    return this.#definitions.some((definition) => definition.computed) || this.#ownReads.some((read) => read.computed)
  }

  get #ownReads() {
    return this.#owner.ownReadsOf(this.#name)
  }

  #renamed(fixer) {
    return [ ...this.#definitions.map((definition) => definition.key), ...this.#ownProperties ]
      .map((node) => fixer.replaceText(node, `#${this.#name}`))
  }

  get #ownProperties() {
    return this.#ownReads.map((read) => read.property)
  }

  get #hasPrivatizableDefinitions() {
    return this.#definitions.length === 1 || this.#isAccessorPair
  }

  get #isAccessorPair() {
    const kinds = new Set(this.#definitions.map((definition) => definition.kind))
    return [ this.#definitions.length === 2, kinds.size === 2, kinds.has("get"), kinds.has("set") ].every(Boolean)
  }

  get #hasOwnDefinition() {
    return this.#definitions.some((definition) => definition.type === "PropertyDefinition")
  }
}

function isPublicInstanceMember(member) {
  const key = staticMemberKeyOf(member)
  return [
    !member.static,
    key,
    key?.node.type !== "PrivateIdentifier",
    isIdentifierName(key?.name),
    !PROTOCOL_MEMBERS.has(key?.name)
  ].every(Boolean)
}

class Read {
  #node

  constructor(node) {
    this.#node = node
  }

  get name() {
    return this.#node.type === "MemberExpression" ? this.#accessedName : this.#pickedName
  }

  get #accessedName() {
    return staticAccessKeyOf(this.#node)?.name ?? null
  }

  get #pickedName() {
    return this.#node.parent.type === "ObjectPattern" ? staticMemberKeyOf(this.#node)?.name ?? null : null
  }
}
