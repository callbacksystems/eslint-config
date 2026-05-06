// `this.foo.bind(this)` is redundant when `foo` is already an arrow class field (auto-bound). Most often appears as a
// copy-paste leftover.

import { nodesIn } from "#helpers/syntax/ast"
import { ClassThisBindings } from "#helpers/classes/class_this_bindings"
import { boundThisMemberKeyOf, staticMemberKeyOf } from "#helpers/syntax/classes"
import { memberWriteOperationTypes, memberWriteTargetsOf } from "#helpers/classes/member_write_targets"

const MEMBER_WRITE_TYPES = memberWriteOperationTypes()

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow `this.foo.bind(this)` when `foo` is an arrow class field" },
    schema: [],
    messages: {
      redundantBind: "`{{member}}.bind(this)` is redundant because the member is already an arrow class field."
    }
  },
  create(context) {
    const bindings = new ClassThisBindings(context.sourceCode.ast)
    const members = new InstanceMemberIndex(context.sourceCode.ast, bindings)
    return {
      CallExpression(node) {
        const fieldKey = boundThisMemberKeyOf(node)
        if (fieldKey) {
          const classNode = bindings.instanceClassOf(node.callee.object.object)
          if (classNode && members.hasUnwrittenArrow(classNode, fieldKey)) {
            context.report({
              node,
              messageId: "redundantBind",
              data: { member: context.sourceCode.getText(node.callee.object) }
            })
          }
        }
      }
    }
  }
}

class InstanceMemberIndex {
  #bindings
  #fieldsByClass = new WeakMap()
  #writesByClass = new WeakMap()

  constructor(root, bindings) {
    this.#bindings = bindings
    for (const node of nodesIn(root)) {
      if (MEMBER_WRITE_TYPES.has(node.type)) memberWriteTargetsOf(node).forEach((member) => this.#index(member))
    }
  }

  hasUnwrittenArrow(classNode, key) {
    return fieldsFor(classNode.body, this.#fieldsByClass).hasArrowMatching(key) && !this.hasMatching(classNode, key)
  }

  hasMatching(classNode, key) {
    return this.#writesByClass.get(classNode)?.hasMatching(key) ?? false
  }

  #index(member) {
    if (member.object.type === "ThisExpression") {
      const classNode = this.#bindings.instanceClassOf(member.object)
      if (classNode) this.#writesFor(classNode).add(member)
    }
  }

  #writesFor(classNode) {
    if (!this.#writesByClass.has(classNode)) this.#writesByClass.set(classNode, new WrittenMembers())
    return this.#writesByClass.get(classNode)
  }
}

function fieldsFor(classBody, cache) {
  if (!cache.has(classBody)) cache.set(classBody, new InstanceFields(classBody))
  return cache.get(classBody)
}

class InstanceFields {
  #privateFields = new Map()
  #publicFields = new Map()

  constructor(classBody) {
    classBody.body.filter(isInstanceField).forEach((field) => this.#index(field))
  }

  hasArrowMatching(key) {
    return this.#fieldsFor(key).get(key.name)?.value?.type === "ArrowFunctionExpression"
  }

  #index(field) {
    const key = staticMemberKeyOf(field)
    if (key) this.#fieldsFor(key).set(key.name, field)
    else if (field.computed) this.#publicFields.clear()
  }

  #fieldsFor(key) {
    return key.node.type === "PrivateIdentifier" ? this.#privateFields : this.#publicFields
  }
}

function isInstanceField(member) {
  return member.type === "PropertyDefinition" && !member.static
}

class WrittenMembers {
  #hasDynamicPublicWrite = false
  #privateNames = new Set()
  #publicNames = new Set()

  add(member) {
    const key = staticMemberKeyOf(member)
    if (key) this.#namesFor(key).add(key.name)
    else if (member.computed) this.#hasDynamicPublicWrite = true
  }

  hasMatching(key) {
    return this.#namesFor(key).has(key.name) || (isPublicKey(key) && this.#hasDynamicPublicWrite)
  }

  #namesFor(key) {
    return isPublicKey(key) ? this.#publicNames : this.#privateNames
  }
}

function isPublicKey(key) {
  return key.node.type !== "PrivateIdentifier"
}
