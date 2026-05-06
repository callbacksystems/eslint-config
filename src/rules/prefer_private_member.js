// A public member that only its own class reads is private in fact and public in name, so `#` should say what the class
// already does. The check is sound only where every reader is in view: a class the module keeps (not exported, no
// superclass to override, instances never handed to code this file does not show) whose members nobody outside the
// class mentions. The fix renames the member and every `this.name` of it inside the class.

import { nodesIn } from "#helpers/ast"
import { isThisMember, memberName } from "#helpers/classes"
import { isFunction } from "#helpers/functions"
import { ModuleView } from "#helpers/module_view"
import { reportProblems } from "#helpers/report"

const MEMBER_TYPES = new Set([ "MethodDefinition", "PropertyDefinition" ])
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
  #view
  #classes = []
  #readsByName = new Map()

  constructor(sourceCode) {
    this.#view = new ModuleView(sourceCode)
  }

  get problems() {
    return this.#classes.flatMap((node) => new ModuleClass(node, this, this.#view).problems)
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

  constructor(node, module, view) {
    this.#node = node
    this.#module = module
    this.#view = view
  }

  get problems() {
    return this.#isSealed ? this.#unreadGroups.map((group) => group.problem) : []
  }

  get name() {
    return this.#node.id.name
  }

  isReadOutside(name) {
    return this.#module.readsOf(name).some((read) => !this.#owns(read))
  }

  ownReadsOf(name) {
    return this.#module.readsOf(name).filter((read) => this.#owns(read))
  }

  hasPrivateMember(name) {
    return this.#members.some((member) => memberName(member) === `#${name}`)
  }

  get #isSealed() {
    return !this.#node.superClass && !this.#view.exports(this.name) && !this.#readsThisDynamically
      && this.#view.keepsInstancesOf(this.#node)
  }

  // `this[key]` reaches any member by a name computed at runtime, which no rename can follow.
  get #readsThisDynamically() {
    return nodesIn(this.#node.body).some((node) => isThisMember(node) && node.computed)
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
    return this.#node.body.body.filter((member) => MEMBER_TYPES.has(member.type))
  }

  #owns(read) {
    return isThisMember(read) && this.#contains(read) && new ThisBinding(read, this.#node).isInstance
  }

  #contains(node) {
    return node.range[0] >= this.#node.range[0] && node.range[1] <= this.#node.range[1]
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
    return this.#owner.isReadOutside(this.#name)
  }

  get #fix() {
    return this.#owner.hasPrivateMember(this.#name) ? null : (fixer) => this.#renamed(fixer)
  }

  #renamed(fixer) {
    return [ ...this.#definitions.map((definition) => definition.key), ...this.#ownProperties ]
      .map((node) => fixer.replaceText(node, `#${this.#name}`))
  }

  get #ownProperties() {
    return this.#owner.ownReadsOf(this.#name).map((read) => read.property)
  }
}

function isPublicInstanceMember(member) {
  return !member.static && !member.computed && member.key.type === "Identifier"
    && !PROTOCOL_MEMBERS.has(member.key.name)
}

class ThisBinding {
  #node
  #classNode

  constructor(node, classNode) {
    this.#node = node
    this.#classNode = classNode
  }

  get isInstance() {
    return this.#member ? !this.#member.static : false
  }

  // A static block is not a member, and its `this` is the class.
  get #member() {
    let current = this.#node
    while (!rebindsThis(current) && current.parent !== this.#classNode.body) current = current.parent
    return MEMBER_TYPES.has(current.type) ? current : null
  }
}

function rebindsThis(node) {
  return isFunction(node) && node.type !== "ArrowFunctionExpression" && !MEMBER_TYPES.has(node.parent.type)
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
    return this.#node.computed ? stringValueOf(this.#node.property) : identifierNameOf(this.#node.property)
  }

  get #pickedName() {
    return this.#node.parent.type === "ObjectPattern" && !this.#node.computed ? identifierNameOf(this.#node.key) : null
  }
}

function stringValueOf(node) {
  return typeof node.value === "string" ? node.value : null
}

function identifierNameOf(node) {
  return node.type === "Identifier" ? node.name : null
}
