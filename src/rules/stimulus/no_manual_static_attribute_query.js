// Stimulus wires targets, values, classes, and outlets through `data-*` attributes it owns. Querying or mutating those
// attributes by hand bypasses the API and everything it provides (change callbacks, defaults, type coercion), so wiring
// lives in HTML and code goes through `this.fooTarget`, `this.fooValue`, `this.fooClass`, or `this.fooOutlet`; from
// another controller, reach in via an outlet. Matches the exact Stimulus attribute grammar, so single-word custom
// attributes such as `data-sort-value` pass.

import { isStringLiteral, stringValuesOf } from "#helpers/ast"
import { propertyNameOf } from "#helpers/classes"
import { reportProblem } from "#helpers/report"

const QUERY_METHODS = new Set([
  "querySelector", "querySelectorAll", "closest", "matches",
  "getAttribute", "setAttribute", "hasAttribute", "removeAttribute"
])
const ATTRIBUTE_CANDIDATES = /data-[a-z0-9-]+/gu
const TARGET_ATTRIBUTE = /^data-[a-z0-9]+(?:-[a-z0-9]+)*-target$/u
const SCOPED_ATTRIBUTE = /^data-[a-z0-9]+(?:-[a-z0-9]+)+-(value|class|outlet)$/u
const DATASET_TARGET_KEY = /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*Target$/u
const DATASET_SCOPED_KEY = /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)+(Value|Class|Outlet)$/u

const APIS = {
  target: { api: "targets", accessor: "this.fooTarget" },
  value: { api: "values", accessor: "this.fooValue" },
  class: { api: "classes", accessor: "this.fooClass" },
  outlet: { api: "outlets", accessor: "this.fooOutlet" }
}

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow querying Stimulus wiring attributes by hand" },
    schema: [],
    messages: {
      manualStaticQuery:
        "`{{attribute}}` is Stimulus wiring. Go through the {{api}} API (`{{accessor}}`) instead of the raw attribute."
    }
  },
  create(context) {
    return {
      CallExpression: (node) => reportProblem(context, new AttributeQuery(node)),
      MemberExpression: (node) => reportProblem(context, new DatasetAccess(node))
    }
  }
}

class AttributeQuery {
  #node

  constructor(node) {
    this.#node = node
  }

  get problem() {
    return this.#attribute ? wiringProblem(this.#node, this.#attribute) : null
  }

  get #attribute() {
    return QUERY_METHODS.has(this.#method) ? wiringAttributeIn(stringValuesOf(this.#node.arguments[0])) : null
  }

  get #method() {
    return this.#node.callee.type === "MemberExpression" ? propertyNameOf(this.#node.callee) : ""
  }
}

function wiringProblem(node, attribute) {
  return { node, messageId: "manualStaticQuery", data: { attribute, ...APIS[kindOf(attribute)] } }
}

function kindOf(attribute) {
  return attribute.startsWith("data-") ? attributeKindOf(attribute) : datasetKindOf(attribute)
}

function attributeKindOf(attribute) {
  return TARGET_ATTRIBUTE.test(attribute) ? "target" : SCOPED_ATTRIBUTE.exec(attribute)[1]
}

function datasetKindOf(key) {
  if (DATASET_TARGET_KEY.test(key)) return "target"

  const scoped = DATASET_SCOPED_KEY.exec(key)
  return scoped ? scoped[1].toLowerCase() : null
}

function wiringAttributeIn(strings) {
  return strings.flatMap((text) => text.match(ATTRIBUTE_CANDIDATES) ?? []).find(isWiringAttribute) ?? null
}

function isWiringAttribute(candidate) {
  return TARGET_ATTRIBUTE.test(candidate) || SCOPED_ATTRIBUTE.test(candidate)
}

class DatasetAccess {
  #node

  constructor(node) {
    this.#node = node
  }

  get problem() {
    return this.#isWiringKey ? wiringProblem(this.#node, this.#key) : null
  }

  get #isWiringKey() {
    return this.#isDatasetAccess && Boolean(datasetKindOf(this.#key))
  }

  get #isDatasetAccess() {
    return this.#node.object.type === "MemberExpression" && propertyNameOf(this.#node.object) === "dataset"
  }

  get #key() {
    return this.#node.computed ? this.#computedKey : propertyNameOf(this.#node)
  }

  get #computedKey() {
    return isStringLiteral(this.#node.property) ? this.#node.property.value : ""
  }
}
