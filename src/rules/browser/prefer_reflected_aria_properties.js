// Every `aria-*` attribute that holds a token or string reflects as a DOM property (`element.ariaPressed`, Baseline
// 2023), so state reads and writes go through plain properties instead of attribute-name strings. IDREF attributes
// (`aria-labelledby` and friends) reflect as element references (`element.ariaLabelledByElements`, Baseline 2025),
// which take the elements themselves and can reach where IDs cannot, such as across shadow roots.

import { isStringLiteral } from "#helpers/ast"
import { propertyNameOf } from "#helpers/classes"
import { operandText } from "#helpers/source"
import { reportProblem } from "#helpers/report"

const ATTRIBUTE_METHODS = new Set([ "getAttribute", "setAttribute", "removeAttribute" ])
const VALUE_NEEDS_PARENS = new Set([ "SequenceExpression" ])

const REFLECTED_PROPERTIES = new Map(Object.entries({
  "aria-atomic": "ariaAtomic",
  "aria-autocomplete": "ariaAutoComplete",
  "aria-braillelabel": "ariaBrailleLabel",
  "aria-brailleroledescription": "ariaBrailleRoleDescription",
  "aria-busy": "ariaBusy",
  "aria-checked": "ariaChecked",
  "aria-colcount": "ariaColCount",
  "aria-colindex": "ariaColIndex",
  "aria-colindextext": "ariaColIndexText",
  "aria-colspan": "ariaColSpan",
  "aria-current": "ariaCurrent",
  "aria-description": "ariaDescription",
  "aria-disabled": "ariaDisabled",
  "aria-expanded": "ariaExpanded",
  "aria-haspopup": "ariaHasPopup",
  "aria-hidden": "ariaHidden",
  "aria-invalid": "ariaInvalid",
  "aria-keyshortcuts": "ariaKeyShortcuts",
  "aria-label": "ariaLabel",
  "aria-level": "ariaLevel",
  "aria-live": "ariaLive",
  "aria-modal": "ariaModal",
  "aria-multiline": "ariaMultiLine",
  "aria-multiselectable": "ariaMultiSelectable",
  "aria-orientation": "ariaOrientation",
  "aria-placeholder": "ariaPlaceholder",
  "aria-posinset": "ariaPosInSet",
  "aria-pressed": "ariaPressed",
  "aria-readonly": "ariaReadOnly",
  "aria-relevant": "ariaRelevant",
  "aria-required": "ariaRequired",
  "aria-roledescription": "ariaRoleDescription",
  "aria-rowcount": "ariaRowCount",
  "aria-rowindex": "ariaRowIndex",
  "aria-rowindextext": "ariaRowIndexText",
  "aria-rowspan": "ariaRowSpan",
  "aria-selected": "ariaSelected",
  "aria-setsize": "ariaSetSize",
  "aria-sort": "ariaSort",
  "aria-valuemax": "ariaValueMax",
  "aria-valuemin": "ariaValueMin",
  "aria-valuenow": "ariaValueNow",
  "aria-valuetext": "ariaValueText",
  "role": "role"
}))

const ELEMENT_REFERENCE_PROPERTIES = new Map(Object.entries({
  "aria-activedescendant": "ariaActiveDescendantElement",
  "aria-controls": "ariaControlsElements",
  "aria-describedby": "ariaDescribedByElements",
  "aria-details": "ariaDetailsElements",
  "aria-errormessage": "ariaErrorMessageElements",
  "aria-flowto": "ariaFlowToElements",
  "aria-labelledby": "ariaLabelledByElements",
  "aria-owns": "ariaOwnsElements"
}))

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Prefer reflected ARIA properties over `aria-*` attribute calls" },
    schema: [],
    messages: {
      useReflectedProperty: "Use the reflected property `{{property}}` instead of `{{method}}(\"{{attribute}}\")`.",
      useElementReferences:
        "Use the reflected property `{{property}}` instead of `{{method}}(\"{{attribute}}\")`. "
        + "It takes element references, so no ID plumbing is needed."
    }
  },
  create(context) {
    return { CallExpression: (node) => reportProblem(context, new AttributeCall(node, context.sourceCode)) }
  }
}

class AttributeCall {
  #node
  #sourceCode

  constructor(node, sourceCode) {
    this.#node = node
    this.#sourceCode = sourceCode
  }

  get problem() {
    return this.#isReflectable ? this.#descriptor : null
  }

  get #isReflectable() {
    return ATTRIBUTE_METHODS.has(this.#method) && Boolean(this.#property)
  }

  get #method() {
    return this.#callee.type === "MemberExpression" ? propertyNameOf(this.#callee) : ""
  }

  get #callee() {
    return this.#node.callee
  }

  get #property() {
    return REFLECTED_PROPERTIES.get(this.#attribute) ?? ELEMENT_REFERENCE_PROPERTIES.get(this.#attribute)
  }

  get #attribute() {
    const first = this.#node.arguments[0]
    return isStringLiteral(first) ? first.value.toLowerCase() : ""
  }

  get #descriptor() {
    return {
      node: this.#node,
      messageId: this.#messageId,
      data: { property: this.#property, method: this.#method, attribute: this.#attribute },
      fix: this.#fix
    }
  }

  get #messageId() {
    return this.#isStringReflected ? "useReflectedProperty" : "useElementReferences"
  }

  get #isStringReflected() {
    return REFLECTED_PROPERTIES.has(this.#attribute)
  }

  get #fix() {
    return this.#isFixable ? (fixer) => fixer.replaceText(this.#node, this.#replacementText) : null
  }

  get #isFixable() {
    return this.#isStringReflected && !this.#isOptionalCall && this.#isSafeCallSite
  }

  get #isOptionalCall() {
    return this.#node.optional || this.#callee.optional
  }

  // A write becomes an assignment, whose value differs from the call's `undefined`, so it only replaces a statement.
  get #isSafeCallSite() {
    return this.#method === "getAttribute" || (this.#isStandaloneStatement && this.#hasAssignableValue)
  }

  get #isStandaloneStatement() {
    return this.#node.parent.type === "ExpressionStatement"
  }

  get #hasAssignableValue() {
    return this.#method === "removeAttribute" || this.#node.arguments.length === 2
  }

  get #replacementText() {
    switch (this.#method) {
      case "getAttribute": return this.#propertyAccess
      case "setAttribute": return `${this.#propertyAccess} = ${this.#valueText}`
      default: return `${this.#propertyAccess} = null`
    }
  }

  get #propertyAccess() {
    return `${this.#sourceCode.getText(this.#callee.object)}.${this.#property}`
  }

  get #valueText() {
    return operandText(this.#sourceCode, this.#node.arguments[1], VALUE_NEEDS_PARENS)
  }
}
