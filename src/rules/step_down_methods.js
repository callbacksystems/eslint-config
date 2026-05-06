// Within a class, members of the same perfectionist group (the public methods, the private ones, ...) should read
// top-down: a member before the ones it uses (`this.foo()`, `this.#bar`), in first-use order. Seeds include the uses
// from the groups read before it (public callers, the constructor), so a private helper lands right after the member
// that first reaches it. Complements `perfectionist/sort-classes`, which orders the groups but not within a group.
//
// Accessors take part like any other member, and a getter moves together with its setter.
//
// A member matching one of the `nameGroups` patterns is left alone: those patterns mark the members another rule
// already orders, and touching them at all is how the two end up undoing each other. They still seed the order of the
// members they reach.

import { DependencyGraph } from "#helpers/flow/dependency_graph"
import { ClassThisBindings } from "#helpers/classes/class_this_bindings"
import { reportProblems } from "#helpers/eslint/report"
import { firstDivergenceBetween, reorderFix } from "#helpers/source/reorder"
import { byPosition } from "#helpers/syntax/sorting"
import { MethodGrouping } from "#helpers/classes/method_grouping"
import { MethodIdentityIndex } from "#helpers/classes/method_identity_index"
import { MethodKey } from "#helpers/classes/method_key"
import { BindingResolver } from "#helpers/scope/binding_resolver"

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Order methods within each class group top-down: a caller before its callees" },
    schema: [ {
      type: "object",
      properties: { nameGroups: { type: "array", items: { type: "string" } }, separateAccessors: { type: "boolean" } },
      additionalProperties: false
    } ],
    defaultOptions: [ { nameGroups: [], separateAccessors: false } ],
    messages: {
      invalidNameGroup: "The nameGroups pattern {{pattern}} is not a valid Unicode regular expression; method "
        + "ordering is disabled until the option is fixed.",
      outOfOrder: "Define `{{name}}` before `{{before}}` (methods read top-down: a caller before its callees)."
    }
  },
  create(context) {
    const grouping = new MethodGrouping(context.options[0])
    return grouping.isValid
      ? listenersFor(context, grouping)
      : { Program: (node) => reportProblems(context, grouping.invalidAnalysisAt(node)) }
  }
}

function listenersFor(context, grouping) {
  const bindings = BindingResolver.for(context.sourceCode)
  const references = new MethodReferences(context.sourceCode.ast, bindings)
  return {
    MemberExpression: (node) => references.add(node),
    "ClassBody:exit": (node) => reportProblems(
      context, new ClassMethods(node, context.sourceCode, { bindings, grouping, references })
    )
  }
}

class MethodReferences {
  #bindings
  #byMethod = new WeakMap()
  #keys

  constructor(root, keys) {
    this.#bindings = new ClassThisBindings(root)
    this.#keys = keys
  }

  add(member) {
    if (member.object.type === "ThisExpression") this.#addThisMember(member)
  }

  referencesIn(methodFunction) {
    return this.#byMethod.get(methodFunction) ?? []
  }

  #addThisMember(member) {
    const methodFunction = this.#bindings.methodFunctionOf(member.object)
    const key = MethodKey.from(member, this.#keys)
    if (methodFunction && key) {
      if (!this.#byMethod.has(methodFunction)) this.#byMethod.set(methodFunction, [])
      this.#byMethod.get(methodFunction).push(key)
    }
  }
}

class ClassMethods {
  #classBody
  #sourceCode
  #options

  constructor(classBody, sourceCode, options) {
    this.#classBody = classBody
    this.#sourceCode = sourceCode
    this.#options = options
  }

  get problems() {
    const members = new MethodMembers(this.#classBody, this.#options).values
    return memberGroupsIn(members).flatMap((group) => this.#problemFor(members, group))
  }

  #problemFor(members, groupMembers) {
    const { misorder } = new Group(members, groupMembers, this.#sourceCode)
    return misorder
      ? [ {
        node: misorder.idNode,
        messageId: "outOfOrder",
        data: { name: misorder.name, before: misorder.before },
        fix: misorder.fix
      } ]
      : []
  }
}

class MethodMembers {
  #bindings
  #grouping
  #identities = new MethodIdentityIndex()
  #methods
  #references

  constructor(classBody, { bindings, grouping, references }) {
    this.#bindings = bindings
    this.#grouping = grouping
    this.#methods = classBody.body.filter(isMethodMember)
    this.#references = references
  }

  get values() {
    const identities = new Set(this.#methods.map((method) => this.#identityOf(method)).filter(Boolean))
    return this.#accessorGroups
      .map((group) => new Member(group, identities, {
        bindings: this.#bindings,
        grouping: this.#grouping,
        identities: this.#identities,
        references: this.#references
      }))
  }

  #identityOf(method) {
    return this.#identities.identityFor(MethodKey.from(method, this.#bindings), { isStatic: method.static })
  }

  get #accessorGroups() {
    return this.#methods.reduce((groups, method) => this.#addAccessorTo(groups, method), new Map())
      .values().toArray()
  }

  #addAccessorTo(groups, method) {
    const key = this.#accessorKeyOf(method) ?? method
    const found = groups.get(key) ?? new AccessorGroup()
    found.add(method)
    return groups.set(key, found)
  }

  #accessorKeyOf(method) {
    return MethodGrouping.isAccessor(method)
      ? this.#identities.identityFor(MethodKey.from(method, this.#bindings), { isStatic: method.static })
      : null
  }
}

// The constructor is never reordered, but its calls seed the order of the private helpers it reaches.
function isMethodMember(member) {
  return member.type === "MethodDefinition"
}

class Member {
  #siblingIdentities
  #grouping
  #cachedRefs
  #cachedGroup
  #cachedIdentity
  #cachedNameGroup
  #key
  #identities
  #references

  constructor(accessors, siblingIdentities, { bindings, grouping, identities, references }) {
    this.nodes = accessors.nodes
    this.#siblingIdentities = siblingIdentities
    this.#grouping = grouping
    this.#identities = identities
    this.#key = MethodKey.from(this.#method, bindings)
    this.#references = references
  }

  get idNode() {
    return this.#method.key
  }

  get group() {
    return this.#cachedGroup ??= [
      this.#method.static, this.#isPrivate, this.#isConstructor, this.#nameGroup, this.#isSeparatedAccessor
    ].join(" ")
  }

  get isNameGrouped() {
    return this.#nameGroup >= 0
  }

  get identity() {
    return this.#cachedIdentity ??= this.#identities.identityFor(this.#key, { isStatic: this.#method.static })
  }

  // A runtime-computed key gets no name, which is what keeps its group from being reordered.
  get name() {
    return this.#key?.name ?? null
  }

  get references() {
    return this.#cachedRefs ??= [ ...new Set(this.#thisReferences) ]
  }

  get #method() {
    return this.nodes[0]
  }

  get #isPrivate() {
    return this.#method.key.type === "PrivateIdentifier"
  }

  get #isConstructor() {
    return this.#method.kind === "constructor"
  }

  get #nameGroup() {
    return this.#cachedNameGroup ??= this.#grouping.nameGroupOf(this.#key?.groupName)
  }

  get #isSeparatedAccessor() {
    return this.#grouping.isSeparatedAccessor(this.#method)
  }

  get #thisReferences() {
    return this.nodes.flatMap((node) =>
      this.#references.referencesIn(node.value)
        .map((reference) => this.#identities.identityFor(reference, { isStatic: this.#method.static }))
        .filter((identity) => this.#siblingIdentities.has(identity))
    )
  }
}

class AccessorGroup {
  #getters = []
  #others = []

  add(method) {
    if (method.kind === "get") this.#getters.push(method)
    else this.#others.push(method)
  }

  get nodes() {
    return this.#getters.concat(this.#others)
  }
}

function memberGroupsIn(members) {
  return Map.groupBy(members, (member) => member.group).values().toArray()
}

// A group whose members are not yet contiguous is skipped, since perfectionist groups them first and only then is a
// splice safe.
class Group {
  #members
  #groupMembers
  #sourceCode

  constructor(members, groupMembers, sourceCode) {
    this.#members = members
    this.#groupMembers = groupMembers
    this.#sourceCode = sourceCode
  }

  get misorder() {
    return this.#isReorderable ? this.#order.misorder : null
  }

  get #isReorderable() {
    return this.#groupMembers.length >= 2
      && !this.#isNameGrouped
      && hasDistinctIdentities(this.#groupIdentities)
      && isContiguous(this.#members, this.#groupMembers)
  }

  get #isNameGrouped() {
    return this.#groupMembers[0].isNameGrouped
  }

  get #groupIdentities() {
    return this.#groupMembers.map((member) => member.identity)
  }

  get #order() {
    return new GroupOrder(this.#groupMembers, this.#externalReferences, this.#sourceCode)
  }

  // Only the members above seed the order, since a private helper reading a public getter is a callee looking back up,
  // not a caller.
  get #externalReferences() {
    return this.#membersAbove.flatMap((member) => member.references)
  }

  get #membersAbove() {
    return this.#members.slice(0, this.#members.indexOf(this.#groupMembers[0]))
  }
}

// Two members sharing an identity would collapse into one entry of the order and drop the other.
function hasDistinctIdentities(identities) {
  return identities.every(Boolean) && new Set(identities).size === identities.length
}

function isContiguous(members, groupMembers) {
  const first = members.indexOf(groupMembers[0])
  return groupMembers.every((member, position) => members[first + position] === member)
}

class GroupOrder {
  #members
  #byIdentity
  #externalRefs
  #sourceCode
  #cachedGraph

  constructor(members, externalReferences, sourceCode) {
    this.#members = members
    this.#byIdentity = new Map(members.map((member) => [ member.identity, member ]))
    this.#externalRefs = externalReferences
    this.#sourceCode = sourceCode
  }

  get misorder() {
    const canonical = this.#canonicalOrder
    const divergence = firstDivergenceBetween(this.#actualOrder, canonical)
    return divergence ? this.#misorderAt(divergence, canonical) : null
  }

  get #canonicalOrder() {
    return this.#graph.namesFrom(this.#seeds)
  }

  get #graph() {
    return this.#cachedGraph ??= new DependencyGraph(this.#members.map((member) => ({
      name: member.identity,
      references: member.references
    })))
  }

  get #seeds() {
    return [ ...this.#externalRefs, ...this.#roots, ...this.#actualOrder ]
  }

  get #roots() {
    return this.#graph.roots
  }

  get #actualOrder() {
    return this.#members.map((member) => member.identity)
  }

  #misorderAt(divergence, canonical) {
    const expected = this.#byIdentity.get(divergence.expected)
    return { idNode: expected.idNode, name: expected.name,
      before: this.#byIdentity.get(divergence.actual).name, fix: this.#reorderFix(canonical) }
  }

  #reorderFix(canonical) {
    return reorderFix(this.#sourceCode, {
      from: this.#members.flatMap((member) => member.nodes).sort(byPosition),
      to: canonical.flatMap((identity) => this.#byIdentity.get(identity).nodes)
    })
  }
}
