// A controller's public surface is its targets, values, classes and outlets: assigning to `this.foo` exposes random
// state under the controller's API. The fix is mechanical: `this.#foo` for internal state (SDK instances, observers,
// caches), or declare `static values = { foo: ... }` for state that should persist on the element and react to changes.
// Setters generated for declared values and classes (e.g. `this.openValue = true`, `this.activeClass = ...`) are
// honored as legitimate assignments.

import { onTypes } from "#helpers/syntax/ast"
import { ClassThisBindings } from "#helpers/classes/class_this_bindings"
import { resolvedMemberKeyOf } from "#helpers/classes/resolved_member_key"
import { memberWriteOperationTypes, memberWriteTargetsOf } from "#helpers/classes/member_write_targets"
import { isIdentifierName } from "#helpers/strings/naming"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { reportProblems } from "#helpers/eslint/report"
import { isStimulusController, stimulusControllerConfigOf } from "#helpers/classes/stimulus"

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
    const index = new ControllerWriteIndex(context.sourceCode)
    return onTypes(memberWriteOperationTypes(), (node) => reportProblems(context, new ControllerWrites(node, index)))
  }
}

class ControllerWriteIndex {
  #allowedNamesByController = new WeakMap()
  #bindings
  #configBindings

  constructor(sourceCode) {
    this.#bindings = new ClassThisBindings(sourceCode.ast)
    this.#configBindings = BindingResolver.for(sourceCode)
  }

  controllerOf(thisExpression) {
    const classNode = this.#bindings.instanceClassOf(thisExpression)
    return classNode && isStimulusController(classNode) ? classNode : null
  }

  allowedNamesFor(controller) {
    if (!this.#allowedNamesByController.has(controller)) {
      this.#allowedNamesByController.set(controller,
        new ControllerConfig(controller.body, this.#configBindings).allowedNames)
    }
    return this.#allowedNamesByController.get(controller)
  }

  keyOf(member) {
    return resolvedMemberKeyOf(member, this.#configBindings)
  }
}

class ControllerConfig {
  #config

  constructor(classBody, bindings) {
    this.#config = stimulusControllerConfigOf(classBody, bindings)
  }

  get allowedNames() {
    return new Set([ ...this.#valueSetterNames, ...this.#classSetterNames ])
  }

  get #valueSetterNames() {
    return this.#config.objectNamesIn("values").map((key) => `${key}Value`)
  }

  get #classSetterNames() {
    return this.#config.arrayNamesIn("classes")
      .flatMap((key) => [ `${key}Class`, `${key}Classes` ])
  }
}

class ControllerWrites {
  #operation
  #index

  constructor(operation, index) {
    this.#operation = operation
    this.#index = index
  }

  get problems() {
    return memberWriteTargetsOf(this.#operation)
      .map((node) => new InstanceWrite(node, this.#index).problem)
      .filter(Boolean)
  }
}

class InstanceWrite {
  #node
  #index
  #cachedKey
  #cachedController

  constructor(node, index) {
    this.#node = node
    this.#index = index
  }

  get problem() {
    return this.#isOffense
      ? { node: this.#node, messageId: "instanceState", data: { name: this.#key.name } }
      : null
  }

  get #isOffense() {
    return this.#isPublicInstanceMember && !this.#index.allowedNamesFor(this.#controller).has(this.#key.name)
  }

  get #isPublicInstanceMember() {
    return this.#node.object.type === "ThisExpression"
      && Boolean(this.#key)
      && this.#key.node.type !== "PrivateIdentifier"
      && isIdentifierName(this.#key.name)
      && Boolean(this.#controller)
  }

  get #key() {
    return this.#cachedKey ??= this.#index.keyOf(this.#node)
  }

  get #controller() {
    return this.#cachedController ??= this.#node.object.type === "ThisExpression"
      ? this.#index.controllerOf(this.#node.object)
      : null
  }
}
