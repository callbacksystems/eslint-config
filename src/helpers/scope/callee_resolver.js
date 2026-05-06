// Lets a naming rule judge a member by what its helpers do. An imported callee's body is unknowable without type
// information, so resolution stays within the file.

import { BindingResolver } from "#helpers/scope/binding_resolver"
import { ClassInitializationContext } from "#helpers/classes/class_initialization_context"
import { ClassMemberResolver } from "#helpers/classes/class_member_resolver"
import { isClassMember, isClassNode, isThisMember, superclassOf } from "#helpers/syntax/classes"
import { resolvedMemberKeyOf } from "#helpers/classes/resolved_member_key"
import { LocalCalleeResolver } from "#helpers/scope/local_callee_resolver"
import { ModuleView } from "#helpers/flow/module_view"
import { isFunction } from "#helpers/syntax/functions"
import { NearestAncestor } from "#helpers/syntax/nearest_ancestor"
import { nodesIn } from "#helpers/syntax/ast"

const THIS_BINDINGS_BY_SOURCE = new WeakMap()
const SUBCLASSES_BY_SOURCE = new WeakMap()
const MODULE_VIEWS_BY_SOURCE = new WeakMap()
const ABSENT_MEMBER = { functionNode: null, isAbsent: true, isUnknown: false }
const UNKNOWN_MEMBER = { functionNode: null, isAbsent: false, isUnknown: true }

export class CalleeResolver {
  #bindings
  #cachedSuperclassResolver
  #classMembers
  #localCallees
  #moduleView
  #sourceCode
  #subclasses
  #thisBindings

  constructor(sourceCode) {
    this.#sourceCode = sourceCode
    this.#bindings = BindingResolver.for(sourceCode)
    this.#classMembers = new ClassMemberResolver(this.#bindings)
    this.#thisBindings = thisBindingsFor(sourceCode)
  }

  functionFor(callee) {
    if (callee.type === "Identifier") return this.#bindings.functionFor(callee)
    if (isThisMember(callee)) return this.#resolutionFor(callee, "function").functionNode
    return callee.type === "MemberExpression" ? this.#localResolver.functionFor(callee) : null
  }

  getterFor(member) {
    return this.getterResolutionFor(member).functionNode
  }

  getterResolutionFor(member) {
    return isThisMember(member) ? this.#resolutionFor(member, "getter") : ABSENT_MEMBER
  }

  isClassReceiverFor(member) {
    return Boolean(this.#thisBindings.bindingFor(member))
  }

  isFreshReceiverDispatchExactFor(member) {
    const binding = this.#thisBindings.bindingFor(member)
    const property = binding ? resolvedMemberKeyOf(member, this.#bindings) : null
    return Boolean(binding) && Boolean(property)
      && (property.node.type === "PrivateIdentifier" || this.#isConfinedLeaf(binding.classNode))
  }

  setterResolutionFor(member) {
    return isThisMember(member) ? this.#resolutionFor(member, "setter") : ABSENT_MEMBER
  }

  #resolutionFor(member, kind) {
    const binding = this.#thisBindings.bindingFor(member)
    const property = binding ? propertyKeyOf(member, this.#bindings) : null
    return !binding || property === null
      ? UNKNOWN_MEMBER
      : this.#resolutionInHierarchy(binding.classNode, property, { access: member, isStatic: binding.isStatic, kind })
  }

  #resolutionInHierarchy(classNode, property, { access, isStatic, kind }) {
    return new ContextualClassResolution(access, classNode, (before) =>
      this.#classMembers.resolutionInHierarchy(classNode, property, {
        before, isStatic, kind, superclassOf: this.#superclassResolver
      })).value
  }

  get #superclassResolver() {
    return this.#cachedSuperclassResolver ??= (classNode) => this.#superclassOf(classNode)
  }

  #superclassOf(classNode) {
    const { superClass } = classNode
    if (!superClass) return null
    if (isClassNode(superClass)) return superClass
    if (superClass.type === "Identifier") return this.#bindings.classFor(superClass) ?? UNKNOWN_MEMBER
    return UNKNOWN_MEMBER
  }

  get #localResolver() {
    return this.#localCallees ??= new LocalCalleeResolver(this.#sourceCode, {
      bindings: this.#bindings,
      classMemberResolution: (classNode, property, options) =>
        this.#classMemberResolutionFor(classNode, property, options)
    })
  }

  #classMemberResolutionFor(classNode, property, { before, kind }) {
    const resolutionBefore = (position) =>
      this.#classMembers.ownResolutionFor(classNode, property, { before: position, isStatic: true, kind })
    return before
      ? resolutionBefore(before)
      : new ContextualClassResolution(property.node, classNode, resolutionBefore).value
  }

  #isConfinedLeaf(classNode) {
    return !this.#subclassIndex.has(classNode) && this.#localView.keepsInstancesOf(classNode)
  }

  get #subclassIndex() {
    return this.#subclasses ??= subclassesFor(this.#sourceCode, this.#bindings)
  }

  get #localView() {
    return this.#moduleView ??= moduleViewFor(this.#sourceCode)
  }
}

function thisBindingsFor(sourceCode) {
  if (!THIS_BINDINGS_BY_SOURCE.has(sourceCode)) THIS_BINDINGS_BY_SOURCE.set(sourceCode, new ThisBindings())
  return THIS_BINDINGS_BY_SOURCE.get(sourceCode)
}

class ThisBindings {
  #boundaries = new NearestAncestor(isThisBoundary)

  bindingFor(node) {
    const boundary = this.#boundaries.of(node)
    return boundary ? new ThisAncestor(boundary).binding : null
  }
}

function isThisBoundary(node) {
  const ancestor = new ThisAncestor(node)
  return Boolean(ancestor.binding) || ancestor.isThisRebound
}

class ThisAncestor {
  #node
  #cachedParent

  constructor(node) {
    this.#node = node
  }

  get binding() {
    if (this.#node.type === "StaticBlock") return { classNode: this.#node.parent.parent, isStatic: true }
    if (this.#isBoundMemberValue) {
      return { classNode: this.#node.parent.parent.parent, isStatic: this.#node.parent.static }
    }

    return null
  }

  get isThisRebound() {
    return isFunction(this.#node) && this.#node.type !== "ArrowFunctionExpression"
  }

  get #isBoundMemberValue() {
    return isClassMember(this.#parent) && this.#parent.value === this.#node
      && (this.#parent.type === "MethodDefinition" || this.#node.type !== "FunctionExpression")
  }

  get #parent() {
    return this.#cachedParent ??= this.#node.parent
  }
}

function propertyKeyOf(node, bindings) {
  return resolvedMemberKeyOf(node, bindings)
}

class ContextualClassResolution {
  #context
  #resolutionBefore

  constructor(access, classNode, resolutionBefore) {
    this.#context = new ClassInitializationContext(access, classNode)
    this.#resolutionBefore = resolutionBefore
  }

  get value() {
    const { element } = this.#context
    if (element) {
      const partial = this.#resolutionBefore(element)
      return this.#context.isDeferred
        && !isSameResolution(partial, this.#resolutionBefore(null))
        ? UNKNOWN_MEMBER
        : partial
    } else {
      return this.#resolutionBefore(null)
    }
  }
}

function isSameResolution(first, second) {
  return first.functionNode === second.functionNode
    && first.isAbsent === second.isAbsent && first.isUnknown === second.isUnknown
}

function subclassesFor(sourceCode, bindings) {
  if (!SUBCLASSES_BY_SOURCE.has(sourceCode)) {
    SUBCLASSES_BY_SOURCE.set(sourceCode, new LocalSubclasses(sourceCode.ast, bindings))
  }
  return SUBCLASSES_BY_SOURCE.get(sourceCode)
}

class LocalSubclasses {
  #bindings
  #values = new WeakSet()

  constructor(root, bindings) {
    this.#bindings = bindings
    for (const node of nodesIn(root)) {
      if (isClassNode(node)) this.#addParentOf(node)
    }
  }

  has(classNode) {
    return this.#values.has(classNode)
  }

  #addParentOf(classNode) {
    const parent = superclassOf(classNode, this.#bindings)
    if (parent) this.#values.add(parent)
  }
}

function moduleViewFor(sourceCode) {
  if (!MODULE_VIEWS_BY_SOURCE.has(sourceCode)) MODULE_VIEWS_BY_SOURCE.set(sourceCode, new ModuleView(sourceCode))
  return MODULE_VIEWS_BY_SOURCE.get(sourceCode)
}
