import { DestructuredBindingPath } from "#helpers/scope/destructured_binding_path"
import { FunctionActivity } from "#helpers/flow/function_activity"
import { FunctionExecutionContexts } from "#helpers/flow/function_execution_contexts"
import { GlobalValueIdentity } from "#helpers/scope/global_value_identity"
import { MutationPositions } from "#helpers/flow/mutation_positions"
import { ResolutionCache } from "#helpers/scope/resolution_cache"
import { StandardPropertyWrites } from "#helpers/objects/standard_property_writes"
import { isClassNode } from "#helpers/syntax/classes"
import { memberWriteOperationOf } from "#helpers/classes/member_write_targets"
import { resolvedMemberKeyOf, resolvedRuntimeMemberKeyOf } from "#helpers/classes/resolved_member_key"

const INDEXES_BY_SOURCE = new WeakMap()

export class ClassMemberMutationIndex {
  #activity
  #bindings
  #byClass = new WeakMap()
  #globals
  #isIndexed = false
  #mutationClasses
  #sourceCode

  static for(sourceCode, bindings) {
    if (!INDEXES_BY_SOURCE.has(sourceCode)) {
      INDEXES_BY_SOURCE.set(sourceCode, new ClassMemberMutationIndex(sourceCode, bindings))
    }
    return INDEXES_BY_SOURCE.get(sourceCode)
  }

  constructor(sourceCode, bindings) {
    this.#activity = new FunctionActivity(sourceCode, bindings)
    this.#bindings = bindings
    this.#globals = new GlobalValueIdentity(bindings)
    this.#mutationClasses = new RelevantMutationClasses(this.#byClass, bindings)
    this.#sourceCode = sourceCode
  }

  hasBefore(member, { classNode, isStatic }) {
    const property = this.#propertyOf(member)
    if (property?.node?.type === "PrivateIdentifier") return false

    this.#index()
    const key = new ClassMutationKey(property, isStatic)
    for (const candidate of this.#mutationClassesInHierarchyFrom(classNode, key)) {
      if (this.#byClass.get(candidate)?.hasBefore(member, key, this.#sourceCode.getScope(member))) return true
    }
    return false
  }

  #propertyOf(member) {
    return resolvedRuntimeMemberKeyOf(member, { bindings: this.#bindings, globals: this.#globals })
  }

  #index() {
    if (this.#isIndexed) return

    this.#isIndexed = true
    new FunctionExecutionContexts(this.#sourceCode.ast).forEach(({ node }) => this.#add(node))
  }

  #add(node) {
    if (node.type === "MemberExpression") this.#addDirectWrite(node)
    else if (node.type === "CallExpression") this.#addStandardWrites(node)
  }

  #addDirectWrite(member) {
    const operation = memberWriteOperationOf(member)
    if (operation) this.#addMutation(operation, member.object, this.#propertyOf(member))
  }

  #addMutation(operation, receiver, property) {
    if (this.#activity.canExecuteNode(operation)) {
      const target = new ClassMemberTarget(receiver, this.#bindings).value
      if (target) {
        this.#mutationsFor(target.classNode).add(operation, property, {
          isStatic: target.isStatic, scope: this.#sourceCode.getScope(operation)
        })
      }
    }
  }

  #mutationsFor(classNode) {
    if (!this.#byClass.has(classNode)) {
      this.#byClass.set(classNode, new ClassMutations(this.#rootScopeOf(classNode)))
    }
    return this.#byClass.get(classNode)
  }

  #rootScopeOf(classNode) {
    const identifier = classBindingIdentifierOf(classNode)
    return identifier ? this.#bindings.variableFor(identifier).scope.variableScope : null
  }

  #addStandardWrites(call) {
    new StandardPropertyWrites(call, this.#bindings).values.forEach(({ name, target }) =>
      this.#addMutation(call, target, propertyNamed(name)))
  }

  *#mutationClassesInHierarchyFrom(classNode, key) {
    const seen = new WeakSet()
    let current = this.#mutationClasses.valueFrom(classNode, key)
    while (current && !seen.has(current)) {
      seen.add(current)
      yield current
      current = this.#mutationClasses.valueFrom(superclassOf(current, this.#bindings), key)
    }
  }
}

class RelevantMutationClasses {
  #bindings
  #byClass
  #instance = new Map()
  #static = new Map()

  constructor(byClass, bindings) {
    this.#bindings = bindings
    this.#byClass = byClass
  }

  valueFrom(classNode, key) {
    return this.#cacheFor(key).valueFrom(classNode)
  }

  #cacheFor(key) {
    const caches = this.#cachesFor(key)
    if (!caches.has(key.identity)) {
      caches.set(key.identity, new ResolutionCache(new MutationClassSteps(this.#byClass, this.#bindings, key), null))
    }
    return caches.get(key.identity)
  }

  #cachesFor(key) {
    return key.isStatic ? this.#static : this.#instance
  }
}

class MutationClassSteps {
  #bindings
  #classes
  #key

  constructor(classes, bindings, key) {
    this.#bindings = bindings
    this.#classes = classes
    this.#key = key
  }

  stepFrom(classNode) {
    if (this.#classes.get(classNode)?.hasFor(this.#key)) return ResolutionCache.final(classNode)

    const superclass = superclassOf(classNode, this.#bindings)
    return superclass ? ResolutionCache.following(superclass) : ResolutionCache.final(null)
  }
}

function superclassOf(classNode, bindings) {
  const { superClass } = classNode
  if (isClassNode(superClass)) return superClass
  return superClass?.type === "Identifier" ? bindings.classFor(superClass) : null
}

class ClassMutationKey {
  constructor(property, isStatic) {
    this.identity = mutationIdentityOf(property)
    this.isStatic = isStatic
  }
}

function mutationIdentityOf(property) {
  const identity = property?.pathMember ?? property?.name ?? null
  return identity === "__proto__" ? null : identity
}

class ClassMemberTarget {
  #bindings
  #node
  #seen = new WeakSet()

  constructor(node, bindings) {
    this.#bindings = bindings
    this.#node = node
  }

  get value() {
    let current = this.#node
    while (current && !this.#seen.has(current)) {
      this.#seen.add(current)
      const direct = this.#directTargetFor(current)
      if (direct) return direct

      current = this.#nextValueFrom(current)
    }
    return null
  }

  #directTargetFor(node) {
    if (isClassNode(node)) return { classNode: node, isStatic: true }
    if (node.type === "MemberExpression") return this.#prototypeTargetFor(node)
    return node.type === "Identifier" ? this.#destructuredTargetFor(node) : null
  }

  #prototypeTargetFor(member) {
    if (resolvedMemberKeyOf(member, this.#bindings)?.name !== "prototype") return null

    const owner = new ClassMemberTarget(member.object, this.#bindings).value
    return owner?.isStatic ? { classNode: owner.classNode, isStatic: false } : null
  }

  #destructuredTargetFor(identifier) {
    const path = new DestructuredBindingPath(identifier, this.#bindings).value
    if (path?.members.length !== 1 || path.members[0] !== "prototype") return null

    const owner = new ClassMemberTarget(path.root, this.#bindings).value
    return owner?.isStatic ? { classNode: owner.classNode, isStatic: false } : null
  }

  #nextValueFrom(node) {
    if (node.type === "ChainExpression") return node.expression
    return node.type === "Identifier" ? this.#bindings.stableValueFor(node) : null
  }
}

class ClassMutations {
  #instance
  #static

  constructor(rootScope) {
    this.#instance = new MemberMutations(rootScope)
    this.#static = new MemberMutations(rootScope)
  }

  add(operation, property, { isStatic, scope }) {
    this.#for(isStatic).add(operation, property, scope)
  }

  hasBefore(member, key, scope) {
    return this.#for(key.isStatic).hasBefore(member, key.identity, scope)
  }

  hasFor(key) {
    return this.#for(key.isStatic).hasFor(key.identity)
  }

  #for(isStatic) {
    return isStatic ? this.#static : this.#instance
  }
}

class MemberMutations {
  #byProperty = new Map()
  #hasIndeterminate = false
  #indeterminate
  #rootScope

  constructor(rootScope) {
    this.#rootScope = rootScope
    this.#indeterminate = new MutationPositions(rootScope)
  }

  add(operation, property, scope) {
    const identity = mutationIdentityOf(property)
    if (identity === null) {
      this.#hasIndeterminate = true
      this.#indeterminate.add(operation, scope)
    } else {
      this.#positionsFor(identity).add(operation, scope)
    }
  }

  hasBefore(member, identity, scope) {
    return this.#indeterminate.hasBefore(member, scope)
      || (identity !== null && this.#byProperty.get(identity)?.hasBefore(member, scope) === true)
  }

  hasFor(identity) {
    return this.#hasIndeterminate || (identity !== null && this.#byProperty.has(identity))
  }

  #positionsFor(identity) {
    if (!this.#byProperty.has(identity)) this.#byProperty.set(identity, new MutationPositions(this.#rootScope))
    return this.#byProperty.get(identity)
  }
}

function classBindingIdentifierOf(classNode) {
  const holder = classNode.parent
  return isDirectClassValue(holder, classNode) ? holder.id : classNode.id
}

function isDirectClassValue(holder, classNode) {
  return holder?.type === "VariableDeclarator" && holder.init === classNode
    && holder.id.type === "Identifier"
}

function propertyNamed(name) {
  return name === null ? null : { name, kind: "public", node: null }
}
