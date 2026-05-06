import { BindingResolver } from "#helpers/scope/binding_resolver"
import { ClassThisBindings } from "#helpers/classes/class_this_bindings"
import { isClassMember, isClassNode, isThisMember } from "#helpers/syntax/classes"
import { isFunction } from "#helpers/syntax/functions"
import { resolvedRuntimeMemberKeyOf } from "#helpers/classes/resolved_member_key"
import { GlobalValueIdentity } from "#helpers/scope/global_value_identity"

export class RecordHomes {
  #bindings
  #members = new MemberHomes()
  #callResults = new WeakMap()
  #contexts
  #globals

  constructor(sourceCode, nodes) {
    this.#bindings = new BindingResolver(sourceCode)
    this.#contexts = new EnclosingContexts(nodes, sourceCode.ast)
    this.#globals = new GlobalValueIdentity(this.#bindings)
  }

  homeFor(record) {
    return new RecordHolder(record, this).home
  }

  valueFor(node, aliases = null) {
    return new ReachedValue(node, this, aliases).home
  }

  aliasesIn(nodes) {
    return new CallAliases(nodes, this)
  }

  stableBindingFor(identifier) {
    const binding = this.bindingFor(identifier)
    return binding && this.#bindings.isUnmodified(identifier) ? binding : null
  }

  bindingFor(identifier) {
    return identifier?.type === "Identifier" ? this.#bindings.variableFor(identifier) : null
  }

  callResultFor(call) {
    const callable = this.#callableFor(call.callee)
    return callable ? this.resultFor(callable) : null
  }

  resultFor(callable) {
    if (!this.#callResults.has(callable)) this.#callResults.set(callable, {})
    return this.#callResults.get(callable)
  }

  memberFor(node) {
    return this.#members.homeFor(node, this.#contexts, { bindings: this.#bindings, globals: this.#globals })
  }

  enclosingFunctionFor(node) {
    return this.#contexts.functionFor(node)
  }

  resultOf(functionNode) {
    return new FunctionResult(functionNode, this).home
  }

  #callableFor(callee) {
    return callee.type === "Identifier" ? this.stableBindingFor(callee) : this.#ownMemberFor(callee)
  }

  #ownMemberFor(callee) {
    return callee.type === "MemberExpression" && isThisMember(callee) ? this.memberFor(callee) : null
  }
}

class MemberHomes {
  #byClass = new WeakMap()

  homeFor(node, contexts, { bindings, globals }) {
    return new MemberHome(node, { bindings, contexts, globals, members: this }).home
  }

  identityFor(classNode, key, { isStatic }) {
    if (!this.#byClass.has(classNode)) this.#byClass.set(classNode, new ClassMemberHomes())
    return this.#byClass.get(classNode).identityFor(key, { isStatic })
  }
}

class MemberHome {
  #bindings
  #node
  #members
  #contexts
  #globals

  constructor(node, { bindings, contexts, globals, members }) {
    this.#bindings = bindings
    this.#node = node
    this.#members = members
    this.#contexts = contexts
    this.#globals = globals
  }

  get home() {
    const key = this.#key
    const classNode = this.#classNode
    return key && classNode
      ? this.#members.identityFor(classNode, key, { isStatic: this.#isStatic })
      : null
  }

  get #key() {
    return resolvedRuntimeMemberKeyOf(this.#node, { bindings: this.#bindings, globals: this.#globals })
  }

  get #classNode() {
    return this.#contexts.classForMember(this.#node)
  }

  get #isStatic() {
    return this.#isDefinition ? this.#node.static : this.#enclosingMember?.static ?? false
  }

  get #isDefinition() {
    return isClassMember(this.#node)
  }

  get #enclosingMember() {
    const member = this.#contexts.classMemberFor(this.#node)
    return isClassMember(member) ? member : null
  }
}

class ClassMemberHomes {
  #instance = new VisibilityMemberHomes()
  #static = new VisibilityMemberHomes()

  identityFor(key, { isStatic }) {
    return this.#homesFor(isStatic).identityFor(key)
  }

  #homesFor(isStatic) {
    return isStatic ? this.#static : this.#instance
  }
}

class VisibilityMemberHomes {
  #private = new MemberHomeIdentities()
  #public = new MemberHomeIdentities()

  identityFor(key) {
    return this.#identitiesFor(key).identityFor(key.pathMember ?? key.name)
  }

  #identitiesFor(key) {
    return key.node.type === "PrivateIdentifier" ? this.#private : this.#public
  }
}

class MemberHomeIdentities {
  #byProperty = new Map()

  identityFor(property) {
    if (!this.#byProperty.has(property)) this.#byProperty.set(property, {})
    return this.#byProperty.get(property)
  }
}

class EnclosingContexts {
  #byNode = new WeakMap()
  #thisBindings

  constructor(nodes, root) {
    this.#thisBindings = new ClassThisBindings(root)
    nodes.forEach((node) => this.#index(node))
  }

  functionFor(node) {
    return this.#byNode.get(node)?.functionNode ?? null
  }

  classForMember(node) {
    return node.type === "MemberExpression" ? this.#thisBindings.classOf(node.object) : this.classFor(node)
  }

  classFor(node) {
    return this.#byNode.get(node)?.classNode ?? null
  }

  classMemberFor(node) {
    return this.#byNode.get(node)?.classMember ?? null
  }

  #index(node) {
    this.#byNode.set(node, new EnclosingContext(node, this.#byNode.get(node.parent)))
  }
}

class EnclosingContext {
  constructor(node, parent = {}) {
    const holder = node.parent
    this.functionNode = isFunction(holder) ? holder : parent.functionNode ?? null
    this.classNode = holder && isClassNode(holder) ? holder : parent.classNode ?? null
    this.classMember = new ClassMemberContext(node, parent).value
  }
}

class ClassMemberContext {
  #node
  #parent

  constructor(node, parent) {
    this.#node = node
    this.#parent = parent
  }

  get value() {
    if (this.#node.parent?.type === "ClassBody") return this.#node
    return this.#node.parent && isClassNode(this.#node.parent) ? null : this.#parent.classMember ?? null
  }
}

class RecordHolder {
  #record
  #homes

  constructor(record, homes) {
    this.#record = record
    this.#homes = homes
  }

  get home() {
    const holder = this.#record.parent
    return this.#directHomeFor(holder) ?? this.#returnedHomeFor(holder)
  }

  #directHomeFor(holder) {
    if (holder.type === "VariableDeclarator") return this.#homes.stableBindingFor(holder.id)
    if (holder.type === "AssignmentExpression") return this.#memberAssignmentHomeFor(holder)
    return holder.type === "PropertyDefinition" ? this.#homes.memberFor(holder) : null
  }

  #memberAssignmentHomeFor(holder) {
    return holder.left.type === "MemberExpression" && isThisMember(holder.left)
      ? this.#homes.memberFor(holder.left)
      : null
  }

  #returnedHomeFor(holder) {
    if (holder.type === "ReturnStatement" && holder.argument === this.#record) {
      return this.#homes.resultOf(this.#homes.enclosingFunctionFor(this.#record))
    }
    return holder.type === "ArrowFunctionExpression" && holder.body === this.#record
      ? this.#homes.resultOf(holder)
      : null
  }
}

class ReachedValue {
  #node
  #homes
  #aliases

  constructor(node, homes, aliases) {
    this.#node = node
    this.#homes = homes
    this.#aliases = aliases
  }

  get home() {
    return [ this.#identifierHome, this.#memberHome, this.#callHome ].find(Boolean) ?? null
  }

  get #identifierHome() {
    return this.#node?.type === "Identifier" ? this.#resolvedIdentifierHome : null
  }

  get #resolvedIdentifierHome() {
    const binding = this.#homes.bindingFor(this.#node)
    return this.#aliases?.sourceFor(binding) ?? binding
  }

  get #memberHome() {
    return this.#node?.type === "MemberExpression" && isThisMember(this.#node)
      ? this.#homes.memberFor(this.#node)
      : null
  }

  get #callHome() {
    return this.#node?.type === "CallExpression" ? this.#homes.callResultFor(this.#node) : null
  }
}

class CallAliases {
  #byBinding = new Map()

  constructor(nodes, homes) {
    nodes.filter(isCallAlias).forEach((node) => {
      const binding = homes.stableBindingFor(node.id)
      const source = homes.callResultFor(node.init)
      if (binding && source) this.#byBinding.set(binding, source)
    })
  }

  sourceFor(binding) {
    return this.#byBinding.get(binding) ?? null
  }
}

function isCallAlias(node) {
  return node.type === "VariableDeclarator" && node.id.type === "Identifier" && node.init?.type === "CallExpression"
}

class FunctionResult {
  #functionNode
  #homes

  constructor(functionNode, homes) {
    this.#functionNode = functionNode
    this.#homes = homes
  }

  get home() {
    if (this.#isSynchronousValue) {
      return this.#functionNode.type === "FunctionDeclaration" ? this.#declarationResult : this.#expressionResult
    }
    return null
  }

  get #isSynchronousValue() {
    return Boolean(this.#functionNode) && !this.#functionNode.async && !this.#functionNode.generator
  }

  get #declarationResult() {
    return this.#resultFor(this.#homes.bindingFor(this.#functionNode.id))
  }

  #resultFor(callable) {
    return callable ? this.#homes.resultFor(callable) : null
  }

  get #expressionResult() {
    const holder = this.#functionNode.parent
    if (holder.type === "VariableDeclarator") return this.#resultFor(this.#homes.stableBindingFor(holder.id))
    if (holder.type === "AssignmentExpression") return this.#assignmentResultFor(holder)
    if (holder.type === "MethodDefinition") return this.#methodResultFor(holder)
    return holder.type === "PropertyDefinition" ? this.#resultFor(this.#homes.memberFor(holder)) : null
  }

  #assignmentResultFor(holder) {
    return holder.left.type === "MemberExpression" && isThisMember(holder.left)
      ? this.#resultFor(this.#homes.memberFor(holder.left))
      : null
  }

  #methodResultFor(method) {
    const member = this.#homes.memberFor(method)
    return method.kind === "get" ? member : this.#resultFor(member)
  }
}
