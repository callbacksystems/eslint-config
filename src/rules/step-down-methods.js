// Within a class, members of the same perfectionist group (public methods,
// private methods, getters, ...) should read top-down: a member before the ones
// it uses (`this.foo()`, `this.#bar`), in first-use order. Seeds include the
// uses from outside the group (public callers, the constructor), so a private
// helper lands right after the member that first reaches it. Complements
// `perfectionist/sort-classes`, which orders the groups but not within a group.

import { memberName, walk } from "#helpers/ast"
import { reportProblems } from "#helpers/report"
import { reorderFix } from "#helpers/reorder"

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Order methods within each class group top-down: a caller before its callees" },
    schema: [],
    messages: {
      outOfOrder: "Define `{{name}}` before `{{before}}` (methods read top-down: a caller before its callees)."
    }
  },
  create(context) {
    return { ClassBody: (node) => reportProblems(context, new ClassMethods(node, context.sourceCode)) }
  }
}

class ClassMethods {
  #classBody
  #sourceCode

  constructor(classBody, sourceCode) {
    this.#classBody = classBody
    this.#sourceCode = sourceCode
  }

  get problems() {
    const members = membersOf(this.#classBody)
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

function membersOf(classBody) {
  const methods = classBody.body.filter(isMethodMember)
  const names = new Set(methods.map(memberName))
  return methods.map((method) => ({
    name: memberName(method),
    idNode: method.key,
    node: method,
    group: groupKeyOf(method),
    refs: thisReferencesIn(method, names)
  }))
}

// The constructor is collected too: it is never reordered (its own group of
// one), but its calls seed the order of the private helpers it reaches.
function isMethodMember(member) {
  return member.type === "MethodDefinition"
}

function groupKeyOf(method) {
  return [ method.static, method.key.type === "PrivateIdentifier", method.kind ].join(" ")
}

function thisReferencesIn(method, names) {
  return dedupeByOrder(
    Array.from(walk(method.value))
      .map((node) => ({ name: thisMemberNameOf(node), at: node.range[0] }))
      .filter((reference) => reference.name && names.has(reference.name))
  )
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

// Skips groups whose members are not yet contiguous: perfectionist groups the
// members first, and only then is reordering one group a safe contiguous splice.
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
    return this.#groupMembers.length >= 2 && isContiguous(this.#members, this.#groupMembers)
  }

  get #groupMembers() {
    return this.#members.filter((member) => member.group === this.#group)
  }

  get #order() {
    return new GroupOrder(this.#groupMembers, this.#externalReferences, this.#sourceCode)
  }

  get #externalReferences() {
    return this.#members.filter((member) => member.group !== this.#group).flatMap((member) => member.refs)
  }
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

  #reorderFix(canonical) {
    return reorderFix(this.#sourceCode, {
      from: this.#members.map((member) => member.node),
      to: canonical.map((name) => this.#byName.get(name).node)
    })
  }

  #visit(name, state) {
    if (state.visited.has(name) || !this.#byName.has(name)) return

    state.visited.add(name)
    state.collected.push(name)
    this.#byName.get(name).refs.forEach((reference) => this.#visit(reference, state))
  }

  #indegreeOf(name) {
    return this.#members.filter((member) => member.refs.includes(name)).length
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

  get #actualOrder() {
    return this.#members.map((member) => member.name)
  }
}

function firstDivergenceBetween(actual, canonical) {
  const index = actual.findIndex((name, position) => name !== canonical[position])
  return index === -1 ? null : { expected: canonical[index], actual: actual[index] }
}
