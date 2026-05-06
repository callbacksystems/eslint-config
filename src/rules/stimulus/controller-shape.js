// Stimulus controllers follow a strict member order:
//   1. static targets/classes/values/outlets
//   2. private fields (#x)
//   3. lifecycle (initialize, connect, disconnect, connectedCallback, ...)
//   4. callbacks (*TargetConnected, *ValueChanged, *OutletConnected, ...)
//   5. public actions (verbs without prefix)
//   6. getters
//   7. private # methods

import { keyName } from "#helpers/classes"
import { isStimulusController, STIMULUS_CONFIG_KEYS } from "#helpers/stimulus"
import { reportProblem } from "#helpers/report"
import { reorderFix } from "#helpers/reorder"

const LIFECYCLE_NAMES = new Set([
  "initialize", "connect", "disconnect",
  "connectedCallback", "disconnectedCallback", "attributeChangedCallback"
])
const CALLBACK_SUFFIXES = [
  "TargetConnected",
  "TargetDisconnected",
  "ValueChanged",
  "OutletConnected",
  "OutletDisconnected"
]
const GROUP_LABEL = {
  1: "static config",
  2: "private field",
  3: "lifecycle method",
  4: "Stimulus callback",
  5: "public action",
  6: "getter",
  7: "private method"
}

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Enforce Stimulus controller member order" },
    schema: [],
    messages: { outOfOrder: "Stimulus member out of order: {{thisLabel}} should come before {{prevLabel}}." }
  },
  create(context) {
    return {
      ClassBody(node) {
        if (isStimulusController(node.parent)) reportProblem(context, new ControllerBody(node, context.sourceCode))
      }
    }
  }
}

// The fix is withheld when a member falls outside the scheme, whose place the spec leaves open.
class ControllerBody {
  #classBody
  #sourceCode
  #cachedEntries

  constructor(classBody, sourceCode) {
    this.#classBody = classBody
    this.#sourceCode = sourceCode
  }

  get problem() {
    const outOfOrder = this.#outOfOrder
    if (outOfOrder) {
      return {
        node: outOfOrder.member,
        messageId: "outOfOrder",
        data: { thisLabel: GROUP_LABEL[outOfOrder.group], prevLabel: GROUP_LABEL[outOfOrder.previousGroup] },
        fix: this.#fix
      }
    } else {
      return null
    }
  }

  get #outOfOrder() {
    const classified = this.#entries.filter((entry) => entry.group !== 0)
    const index = classified.findIndex((entry, at) => at > 0 && entry.group < classified[at - 1].group)
    if (index === -1) return null

    const { member, group } = classified[index]
    return { member, group, previousGroup: classified[index - 1].group }
  }

  get #entries() {
    return this.#cachedEntries ??= this.#classBody.body.map((member) => ({ member, group: new Member(member).group }))
  }

  get #fix() {
    return this.#hasUnclassified
      ? null
      : reorderFix(this.#sourceCode, { from: this.#members, to: this.#canonicalOrder })
  }

  get #hasUnclassified() {
    return this.#entries.some((entry) => entry.group === 0)
  }

  get #members() {
    return this.#entries.map((entry) => entry.member)
  }

  get #canonicalOrder() {
    return this.#entries
      .map((entry, position) => ({ ...entry, position }))
      .sort((left, right) => left.group - right.group || left.position - right.position)
      .map((entry) => entry.member)
  }
}

// Groups are tried in priority order, so a private getter lands in the private-method group before the getter one.
class Member {
  #member

  constructor(member) {
    this.#member = member
  }

  get group() {
    return this.#groupers.find((grouper) => grouper.matches)?.group ?? this.#fallbackGroup
  }

  get #groupers() {
    return [
      { matches: this.#isStaticConfig, group: 1 },
      { matches: this.#isPrivateField, group: 2 },
      { matches: this.#isLifecycle, group: 3 },
      { matches: this.#isCallback, group: 4 },
      { matches: this.#isPrivateMethod, group: 7 },
      { matches: this.#isGetter, group: 6 }
    ]
  }

  get #isStaticConfig() {
    return this.#isProperty && this.#member.static && STIMULUS_CONFIG_KEYS.has(this.#name)
  }

  get #isProperty() {
    return this.#member.type === "PropertyDefinition"
  }

  get #name() {
    return keyName(this.#member.key)
  }

  get #isPrivateField() {
    return this.#isProperty && this.#member.key.type === "PrivateIdentifier"
  }

  get #isLifecycle() {
    return this.#isMethod && LIFECYCLE_NAMES.has(this.#name)
  }

  get #isMethod() {
    return this.#member.type === "MethodDefinition"
  }

  get #isCallback() {
    return this.#isMethod && Boolean(this.#name) && this.#hasCallbackSuffix
  }

  get #hasCallbackSuffix() {
    return CALLBACK_SUFFIXES.some((suffix) => this.#name.endsWith(suffix) && this.#name !== suffix)
  }

  get #isPrivateMethod() {
    return this.#isMethod && this.#member.key.type === "PrivateIdentifier"
  }

  get #isGetter() {
    return this.#isMethod && this.#member.kind === "get"
  }

  get #fallbackGroup() {
    return this.#isMethod ? 5 : 0
  }
}
