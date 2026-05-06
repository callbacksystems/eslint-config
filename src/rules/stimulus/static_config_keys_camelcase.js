// Stimulus target/class/value names are camelCase. Outlets instead name controllers, whose identifiers use single
// hyphens between words and double hyphens between namespaces.

import {
  isStimulusController, isStimulusControllerIdentifier, stimulusControllerConfigOf
} from "#helpers/classes/stimulus"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { reportProblems } from "#helpers/eslint/report"

const CAMEL_CASE = /^[a-z][a-zA-Z0-9]*$/u

export default {
  meta: {
    type: "problem",
    docs: { description: "Enforce Stimulus naming conventions in static configuration" },
    schema: [],
    messages: {
      invalidOutlet: "Stimulus `outlets` entry `{{name}}` must be a kebab-case controller identifier.",
      notCamelCase: "Stimulus `{{owner}}` key `{{name}}` must be camelCase."
    }
  },
  create(context) {
    const bindings = new BindingResolver(context.sourceCode)
    return {
      ClassBody(node) {
        if (isStimulusController(node.parent)) reportProblems(context, new StaticConfigNames(node, bindings))
      }
    }
  }
}

class StaticConfigNames {
  #classBody
  #bindings

  constructor(classBody, bindings) {
    this.#classBody = classBody
    this.#bindings = bindings
  }

  get problems() {
    return stimulusControllerConfigOf(this.#classBody, this.#bindings).entries.flatMap((entry) =>
      entry.declarations
        .map((declaration) => new StaticConfigName(entry.name, declaration).problem)
        .filter(Boolean))
  }
}

class StaticConfigName {
  #owner
  #declaration

  constructor(owner, declaration) {
    this.#owner = owner
    this.#declaration = declaration
  }

  get problem() {
    return this.#isValid
      ? null
      : {
        node: this.#declaration.node,
        messageId: this.#messageId,
        data: { name: this.#declaration.name, owner: this.#owner }
      }
  }

  get #isValid() {
    return this.#owner === "outlets"
      ? isStimulusControllerIdentifier(this.#declaration.name)
      : CAMEL_CASE.test(this.#declaration.name)
  }

  get #messageId() {
    return this.#owner === "outlets" ? "invalidOutlet" : "notCamelCase"
  }
}
