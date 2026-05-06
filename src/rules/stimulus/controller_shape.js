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

import { isStringLiteral } from "#helpers/ast"
import { keyName } from "#helpers/classes"
import { isStimulusController } from "#helpers/stimulus"
import { capitalize } from "#helpers/naming"
import {
  STIMULUS_CALLBACK_PATTERN,
  STIMULUS_CONNECT_PATTERN,
  STIMULUS_DISCONNECT_PATTERN,
  STIMULUS_INITIALIZE_PATTERN
} from "#constants/member_patterns"
import { reportProblem } from "#helpers/report"
import { reorderFix } from "#helpers/reorder"

const CALLBACK = new RegExp(STIMULUS_CALLBACK_PATTERN, "u")
const ACCESSOR_KINDS = new Set([ "get", "set" ])
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
  #cachedMembers
  #cachedCallbacks

  constructor(classBody, sourceCode) {
    this.#classBody = classBody
    this.#sourceCode = sourceCode
  }

  get problem() {
    const misorder = this.#misorder
    return misorder ? { node: misorder.node, ...misorder.message, fix: this.#fix } : null
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
    return this.#cachedMembers ??= this.#classBody.body.map((node) => new Member(node, this.#callbacks))
  }

  get #callbacks() {
    return this.#cachedCallbacks ??= new CallbackSequence(this.#classBody)
  }

  // Only the classified members trade places, each landing on a slot one of them already held, so everything else in
  // the body stays where perfectionist put it.
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

  constructor(member, callbacks) {
    this.#member = member
    this.#callbacks = callbacks
  }

  get name() {
    return keyName(this.#member.key)
  }

  get node() {
    return this.#member
  }

  get isClassified() {
    return this.group !== 0
  }

  get group() {
    return this.#isOwnPublicMethod ? this.#groupers.find((grouper) => grouper.matches)?.group ?? 5 : 0
  }

  comesBefore(other) {
    return this.group < other.group || (this.group === other.group && this.rank < other.rank)
  }

  get rank() {
    return this.group === CALLBACK_GROUP ? this.#callbacks.rankOf(this.name) : 0
  }

  get label() {
    return GROUP_LABEL[this.group]
  }

  // Perfectionist keeps every class's public methods in one group, so this rule orders within that group and nowhere
  // else.
  get #isOwnPublicMethod() {
    return this.#isMethod && !this.#member.static && !this.#isPrivate && !this.#isConstructor
  }

  get #isMethod() {
    return this.#member.type === "MethodDefinition"
  }

  get #isPrivate() {
    return this.#member.key.type === "PrivateIdentifier"
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
    return ACCESSOR_KINDS.has(this.#member.kind)
  }
}

// A callback the statics never mention lands after all of them, keeping its place.
class CallbackSequence {
  #classBody
  #cache

  constructor(classBody) {
    this.#classBody = classBody
  }

  rankOf(name) {
    const index = this.#expectedNames.indexOf(name)
    return index === -1 ? Number.MAX_SAFE_INTEGER : index
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
    return this.#namesIn(key).flatMap((name) => [ `${name}${role}Connected`, `${name}${role}Disconnected` ])
  }

  #namesIn(key) {
    return declaredNamesIn(this.#staticNamed(key)?.value)
  }

  #staticNamed(key) {
    return this.#classBody.body.find((member) =>
      member.type === "PropertyDefinition" && member.static && keyName(member.key) === key)
  }
}

function declaredNamesIn(node) {
  if (node?.type === "ArrayExpression") return node.elements.filter(isStringLiteral).map((element) => element.value)

  return node?.type === "ObjectExpression" ? objectKeyNamesIn(node) : []
}

function objectKeyNamesIn(node) {
  return node.properties.filter((property) => property.type === "Property").map((property) => keyName(property.key))
}

function byGroupAndRank(left, right) {
  return left.group - right.group || left.rank - right.rank
}
