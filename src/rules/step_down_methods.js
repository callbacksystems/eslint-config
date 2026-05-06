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

import { nodesIn } from "#helpers/ast"
import { memberName } from "#helpers/classes"
import { reportProblems } from "#helpers/report"
import { firstDivergenceBetween, reorderFix } from "#helpers/reorder"

const ACCESSOR_KINDS = new Set([ "get", "set" ])

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
      outOfOrder: "Define `{{name}}` before `{{before}}` (methods read top-down: a caller before its callees)."
    }
  },
  create(context) {
    const grouping = new Grouping(context.options[0])
    return { ClassBody: (node) => reportProblems(context, new ClassMethods(node, context.sourceCode, grouping)) }
  }
}

class Grouping {
  #patterns
  #separateAccessors

  constructor({ nameGroups, separateAccessors }) {
    this.#patterns = nameGroups.map((pattern) => new RegExp(pattern, "u"))
    this.#separateAccessors = separateAccessors
  }

  nameGroupOf(name) {
    return name ? this.#patterns.findIndex((pattern) => pattern.test(name)) : -1
  }

  // Where accessors are a section of their own (Stimulus getters below the actions), pairing them with the methods
  // fights the rule drawing that section.
  isSeparatedAccessor(method) {
    return this.#separateAccessors && ACCESSOR_KINDS.has(method.kind)
  }
}

class ClassMethods {
  #classBody
  #sourceCode
  #grouping

  constructor(classBody, sourceCode, grouping) {
    this.#classBody = classBody
    this.#sourceCode = sourceCode
    this.#grouping = grouping
  }

  get problems() {
    const members = membersOf(this.#classBody, this.#grouping)
    return groupNamesIn(members).flatMap((group) => this.#problemFor(members, group))
  }

  #problemFor(members, group) {
    const { misorder } = new Group(members, group, this.#sourceCode)
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

function membersOf(classBody, grouping) {
  const methods = classBody.body.filter(isMethodMember)
  const names = new Set(methods.filter((method) => !method.computed).map(memberName))
  return accessorGroupsIn(methods).map((group) => new Member(group, names, grouping))
}

// The constructor is never reordered, but its calls seed the order of the private helpers it reaches.
function isMethodMember(member) {
  return member.type === "MethodDefinition"
}

function accessorGroupsIn(methods) {
  return methods.reduce(intoAccessorGroups, new Map()).values().toArray()
}

function intoAccessorGroups(groups, method) {
  const key = accessorKeyOf(method) ?? method
  const found = groups.get(key) ?? []
  return groups.set(key, method.kind === "get" ? [ method, ...found ] : [ ...found, method ])
}

function accessorKeyOf(method) {
  return isPairableAccessor(method) ? `${method.static} ${memberName(method)}` : null
}

function isPairableAccessor(method) {
  return ACCESSOR_KINDS.has(method.kind) && !method.computed
}

class Member {
  #siblingNames
  #grouping
  #cachedRefs

  constructor(nodes, siblingNames, grouping) {
    this.nodes = nodes
    this.#siblingNames = siblingNames
    this.#grouping = grouping
  }

  // A computed key gets no name, which is what keeps its group from being reordered.
  get name() {
    return this.#method.computed ? null : memberName(this.#method)
  }

  get idNode() {
    return this.#method.key
  }

  get group() {
    return [ this.#method.static, this.#isPrivate, this.#isConstructor, this.#nameGroup, this.#isSeparatedAccessor ]
      .join(" ")
  }

  get isNameGrouped() {
    return this.#nameGroup >= 0
  }

  get references() {
    return this.#cachedRefs ??= dedupeByOrder(this.#thisReferences)
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
    return this.#grouping.nameGroupOf(this.name)
  }

  get #isSeparatedAccessor() {
    return this.#grouping.isSeparatedAccessor(this.#method)
  }

  get #thisReferences() {
    return this.nodes.flatMap((node) =>
      nodesIn(node.value)
        .map((found) => ({ name: thisMemberNameOf(found), at: found.range[0] }))
        .filter((reference) => reference.name && this.#siblingNames.has(reference.name))
        .toArray())
  }
}

function dedupeByOrder(found) {
  return [ ...new Set([ ...found ].sort((left, right) => left.at - right.at).map((reference) => reference.name)) ]
}

function thisMemberNameOf(node) {
  if (node.type !== "MemberExpression" || node.object.type !== "ThisExpression") return null
  if (node.property.type === "PrivateIdentifier") return `#${node.property.name}`

  return node.property.type === "Identifier" && !node.computed ? node.property.name : null
}

function groupNamesIn(members) {
  return [ ...new Set(members.map((member) => member.group)) ]
}

// A group whose members are not yet contiguous is skipped, since perfectionist groups them first and only then is a
// splice safe.
class Group {
  #members
  #group
  #sourceCode

  constructor(members, group, sourceCode) {
    this.#members = members
    this.#group = group
    this.#sourceCode = sourceCode
  }

  get misorder() {
    return this.#isReorderable ? this.#order.misorder : null
  }

  get #isReorderable() {
    return this.#groupMembers.length >= 2
      && !this.#isNameGrouped
      && hasDistinctNames(this.#groupNames)
      && isContiguous(this.#members, this.#groupMembers)
  }

  get #groupMembers() {
    return this.#members.filter((member) => member.group === this.#group)
  }

  get #isNameGrouped() {
    return this.#groupMembers[0].isNameGrouped
  }

  get #groupNames() {
    return this.#groupMembers.map((member) => member.name)
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

// Two members sharing a name would collapse into one entry of the order and drop the other.
function hasDistinctNames(names) {
  return names.every(Boolean) && new Set(names).size === names.length
}

function isContiguous(members, groupMembers) {
  const first = members.indexOf(groupMembers[0])
  return groupMembers.every((member, position) => members[first + position] === member)
}

class GroupOrder {
  #members
  #byName
  #externalRefs
  #sourceCode

  constructor(members, externalReferences, sourceCode) {
    this.#members = members
    this.#byName = new Map(members.map((member) => [ member.name, member ]))
    this.#externalRefs = externalReferences
    this.#sourceCode = sourceCode
  }

  get misorder() {
    const canonical = this.#canonicalOrder
    const divergence = firstDivergenceBetween(this.#actualOrder, canonical)
    return divergence && {
      idNode: this.#byName.get(divergence.expected).idNode,
      name: divergence.expected,
      before: divergence.actual,
      fix: this.#reorderFix(canonical)
    }
  }

  get #canonicalOrder() {
    const state = { visited: new Set(), collected: [] }
    this.#seeds.forEach((name) => this.#visit(name, state))
    return state.collected
  }

  get #seeds() {
    return [ ...this.#externalRefs, ...this.#roots, ...this.#actualOrder ]
  }

  get #roots() {
    return this.#members.filter((member) => this.#indegreeOf(member.name) === 0).map((member) => member.name)
  }

  #indegreeOf(name) {
    return this.#members.filter((member) => member.references.includes(name)).length
  }

  get #actualOrder() {
    return this.#members.map((member) => member.name)
  }

  #visit(name, state) {
    if (state.visited.has(name) || !this.#byName.has(name)) return

    state.visited.add(name)
    state.collected.push(name)
    this.#byName.get(name).references.forEach((reference) => this.#visit(reference, state))
  }

  #reorderFix(canonical) {
    return reorderFix(this.#sourceCode, {
      from: this.#members.flatMap((member) => member.nodes).sort(byPosition),
      to: canonical.flatMap((name) => this.#byName.get(name).nodes)
    })
  }
}

function byPosition(left, right) {
  return left.range[0] - right.range[0]
}
