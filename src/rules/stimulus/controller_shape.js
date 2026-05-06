// A controller's public methods run in the order Stimulus calls them:
//   1. initialize
//   2. connect
//   3. disconnect
//   4. callbacks (*TargetConnected, *ValueChanged, *OutletConnected, ...)
//   5. actions (verbs without prefix)
//   6. accessors (getters and setters, kept together)
//
// Everything else in the body (statics, fields, the constructor, private members) keeps the place perfectionist gives
// it, since that ordering already runs over every class and two that disagree undo each other's fixes.

import { isAccessor } from "#helpers/syntax/classes"
import { resolvedMemberKeyOf } from "#helpers/classes/resolved_member_key"
import { isStimulusController, stimulusControllerConfigOf, stimulusPropertyStemOf } from "#helpers/classes/stimulus"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { capitalize } from "#helpers/strings/naming"
import {
  STIMULUS_CALLBACK_PATTERN,
  STIMULUS_CONNECT_PATTERN,
  STIMULUS_DISCONNECT_PATTERN,
  STIMULUS_INITIALIZE_PATTERN
} from "#constants/member_patterns"
import { reportProblem } from "#helpers/eslint/report"
import { reorderFix } from "#helpers/source/reorder"

const CALLBACK = new RegExp(STIMULUS_CALLBACK_PATTERN, "u")
const CALLBACK_GROUP = 4
const LIFECYCLE_GROUPS = [
  { pattern: new RegExp(STIMULUS_INITIALIZE_PATTERN, "u"), group: 1 },
  { pattern: new RegExp(STIMULUS_CONNECT_PATTERN, "u"), group: 2 },
  { pattern: new RegExp(STIMULUS_DISCONNECT_PATTERN, "u"), group: 3 }
]
const GROUP_LABEL = {
  1: "`initialize`",
  2: "`connect`",
  3: "`disconnect`",
  4: "Stimulus callback",
  5: "action",
  6: "accessor"
}

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Enforce Stimulus controller member order" },
    schema: [],
    messages: {
      outOfOrder: "Stimulus member out of order: {{thisLabel}} should come before {{prevLabel}}.",
      callbackOutOfOrder: "Callbacks follow their static declarations: `{{name}}` should come before `{{before}}`."
    }
  },
  create(context) {
    const bindings = BindingResolver.for(context.sourceCode)
    return {
      ClassBody(node) {
        if (isStimulusController(node.parent)) {
          reportProblem(context, new ControllerBody(node, bindings))
        }
      }
    }
  }
}

class ControllerBody {
  #classBody
  #sourceCode
  #bindings
  #cachedMembers
  #cachedCallbacks

  constructor(classBody, bindings) {
    this.#classBody = classBody
    this.#sourceCode = bindings.sourceCode
    this.#bindings = bindings
  }

  get problem() {
    const firstMisorder = this.#misorder
    return firstMisorder ? { node: firstMisorder.node, ...firstMisorder.message, fix: this.#fix } : null
  }

  get #misorder() {
    const classified = this.#classified
    const index = classified.findIndex((member, at) => at > 0 && member.comesBefore(classified[at - 1]))
    return index === -1 ? null : new Misorder(classified[index], classified[index - 1])
  }

  get #classified() {
    return this.#members.filter((member) => member.isClassified)
  }

  get #members() {
    return this.#cachedMembers ??= this.#classBody.body
      .map((node) => new Member(node, { bindings: this.#bindings, callbacks: this.#callbacks }))
  }

  get #callbacks() {
    return this.#cachedCallbacks ??= new CallbackSequence(this.#classBody, this.#bindings)
  }

  // Only the classified members trade places, so everything else in the body stays where perfectionist put it.
  get #fix() {
    return reorderFix(this.#sourceCode, { from: this.#nodes, to: this.#canonicalOrder })
  }

  get #nodes() {
    return this.#classified.map((member) => member.node)
  }

  // A stable sort, so members the scheme places together keep the order their author gave them.
  get #canonicalOrder() {
    return [ ...this.#classified ].sort(byGroupAndRank).map((member) => member.node)
  }
}

class Misorder {
  #member
  #previous

  constructor(member, previous) {
    this.#member = member
    this.#previous = previous
  }

  get node() {
    return this.#member.node
  }

  get message() {
    return this.#isWithinGroup ? this.#callbackMessage : this.#groupMessage
  }

  get #isWithinGroup() {
    return this.#member.group === this.#previous.group
  }

  get #callbackMessage() {
    return { messageId: "callbackOutOfOrder", data: { name: this.#member.name, before: this.#previous.name } }
  }

  get #groupMessage() {
    return { messageId: "outOfOrder", data: { thisLabel: this.#member.label, prevLabel: this.#previous.label } }
  }
}

// Groups are tried in priority order, so a private getter lands in the private-method group before the getter one.
class Member {
  #member
  #callbacks
  #bindings
  #cachedKey
  #cachedGroup
  #cachedRank

  constructor(member, { bindings, callbacks }) {
    this.#member = member
    this.#callbacks = callbacks
    this.#bindings = bindings
  }

  get node() {
    return this.#member
  }

  get isClassified() {
    return this.group !== 0
  }

  get group() {
    return this.#cachedGroup ??= this.#isOwnPublicMethod
      ? this.#groupers.find((grouper) => grouper.matches)?.group ?? 5
      : 0
  }

  comesBefore(other) {
    return this.group < other.group || (this.group === other.group && this.rank < other.rank)
  }

  get rank() {
    return this.#cachedRank ??= this.group === CALLBACK_GROUP ? this.#callbacks.rankOf(this.name) : 0
  }

  get name() {
    return this.#key?.name ?? null
  }

  get label() {
    return GROUP_LABEL[this.group]
  }

  // Perfectionist keeps a class's public methods in one group, so this rule only orders within it.
  get #isOwnPublicMethod() {
    return this.#isMethod && !this.#member.static && Boolean(this.#key) && !this.#isPrivate && !this.#isConstructor
  }

  get #isMethod() {
    return this.#member.type === "MethodDefinition"
  }

  get #key() {
    return this.#cachedKey ??= resolvedMemberKeyOf(this.#member, this.#bindings)
  }

  get #isPrivate() {
    return this.#key?.node.type === "PrivateIdentifier"
  }

  get #isConstructor() {
    return this.#member.kind === "constructor"
  }

  get #groupers() {
    return [
      ...this.#lifecycleGroupers,
      { matches: this.#isCallback, group: 4 },
      { matches: this.#isAccessor, group: 6 }
    ]
  }

  get #lifecycleGroupers() {
    return LIFECYCLE_GROUPS.map(({ pattern, group }) => ({ matches: this.#isMethodNamed(pattern), group }))
  }

  #isMethodNamed(pattern) {
    return this.#isMethod && Boolean(this.name) && pattern.test(this.name)
  }

  get #isCallback() {
    return this.#isMethodNamed(CALLBACK)
  }

  // A setter belongs with its getter, since a value reads as one thing however many members spell it.
  get #isAccessor() {
    return isAccessor(this.#member)
  }
}

class CallbackSequence {
  #config
  #cache
  #cachedRanks

  constructor(classBody, bindings) {
    this.#config = stimulusControllerConfigOf(classBody, bindings)
  }

  // A callback the statics never mention lands after all of them, keeping its place.
  rankOf(name) {
    return this.#ranks.get(name) ?? Number.MAX_SAFE_INTEGER
  }

  get #ranks() {
    return this.#cachedRanks ??= new Map(this.#expectedNames.map((name, rank) => [ name, rank ]))
  }

  get #expectedNames() {
    return this.#cache ??= [
      ...this.#pairedNamesIn("targets"),
      ...this.#namesIn("values").map((name) => `${name}ValueChanged`),
      ...this.#pairedNamesIn("outlets")
    ]
  }

  // `targets` names its callbacks `itemTargetConnected`, so the role is the static's own name in singular.
  #pairedNamesIn(key) {
    const role = capitalize(key.slice(0, -1))
    return this.#propertyNamesIn(key)
      .flatMap((name) => [ `${name}${role}Connected`, `${name}${role}Disconnected` ])
  }

  #propertyNamesIn(key) {
    const names = this.#namesIn(key)
    return key === "outlets" ? names.map(stimulusPropertyStemOf) : names
  }

  #namesIn(key) {
    return this.#config.namesIn(key)
  }
}

function byGroupAndRank(left, right) {
  return left.group - right.group || left.rank - right.rank
}
