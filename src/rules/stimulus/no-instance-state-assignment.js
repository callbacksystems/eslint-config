// A controller's public surface is its targets, values, classes and outlets: assigning to `this.foo` exposes random
// state under the controller's API. The fix is mechanical: `this.#foo` for internal state (SDK instances, observers,
// caches), or declare `static values = { foo: ... }` for state that should persist on the element and react to changes.
// Setters generated for declared values and classes (e.g. `this.openValue = true`, `this.activeClass = ...`) are
// honored as legitimate assignments.

import { isStringLiteral, walk } from "#helpers/ast"
import { isStimulusController } from "#helpers/stimulus"
import { reportProblems } from "#helpers/report"

export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow public `this.foo = ...` in Stimulus controllers; use `#private` or declare a value"
    },
    schema: [],
    messages: {
      instanceState: "Use `this.#{{name}}` for internal state, or declare `static values = { {{name}}: ... }`."
    }
  },
  create(context) {
    return {
      ClassBody(node) {
        if (isStimulusController(node.parent)) reportProblems(context, new ControllerAssignments(node))
      }
    }
  }
}

class ControllerAssignments {
  #classBody

  constructor(classBody) {
    this.#classBody = classBody
  }

  get problems() {
    const allowed = this.#allowedNames
    return this.#publicThisAssignments
      .filter((assignment) => !allowed.has(assignment.left.property.name))
      .map((assignment) => ({
        node: assignment.left,
        messageId: "instanceState",
        data: { name: assignment.left.property.name }
      }))
  }

  #staticConfigOf(name) {
    return this.#classBody.body.find((each) => isStaticConfigOf(each, name))?.value ?? null
  }

  get #allowedNames() {
    return new Set([ ...this.#valueSetterNames, ...this.#classSetterNames ])
  }

  get #valueSetterNames() {
    return objectKeysFrom(this.#staticConfigOf("values")).map((key) => `${key}Value`)
  }

  get #classSetterNames() {
    return arrayLiteralsFrom(this.#staticConfigOf("classes")).flatMap((key) => [ `${key}Class`, `${key}Classes` ])
  }

  get #publicThisAssignments() {
    return Array.from(walk(this.#classBody)).filter(isPublicThisAssignment)
  }
}

function isStaticConfigOf(member, name) {
  return member.type === "PropertyDefinition"
    && member.static
    && member.key.type === "Identifier"
    && member.key.name === name
}

function objectKeysFrom(node) {
  return node?.type === "ObjectExpression"
    ? node.properties.filter(isIdentifierKeyedProperty).map((property) => property.key.name)
    : []
}

function isIdentifierKeyedProperty(property) {
  return property.type === "Property" && !property.computed && property.key.type === "Identifier"
}

function arrayLiteralsFrom(node) {
  return node?.type === "ArrayExpression"
    ? node.elements.filter(isStringLiteral).map((element) => element.value)
    : []
}

function isPublicThisAssignment(node) {
  return node.type === "AssignmentExpression"
    && node.left.type === "MemberExpression"
    && !node.left.computed
    && node.left.object.type === "ThisExpression"
    && node.left.property.type === "Identifier"
}
