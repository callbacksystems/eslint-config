// Classes extending an HTML element (HTMLElement, HTMLDivElement, ...) must end in `Element`. Convention from House
// (`EditorElement`) and Lexxy (`LexicalEditorElement`); makes the runtime role obvious from the type.

import { onTypes } from "#helpers/syntax/ast"
import { isHtmlElementSubclass } from "#helpers/classes/dom"
import { reportProblem } from "#helpers/eslint/report"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Require classes extending HTMLElement to end in `Element`" },
    schema: [],
    messages: { missingSuffix: "Class `{{name}}` extends `{{superClass}}`; must end in `Element`." }
  },
  create(context) {
    return onTypes(
      [ "ClassDeclaration", "ClassExpression" ],
      (node) => reportProblem(context, new HtmlElementClass(node))
    )
  }
}

class HtmlElementClass {
  #node

  constructor(node) {
    this.#node = node
  }

  get problem() {
    return this.#needsSuffix
      ? {
        node: this.#node.id,
        messageId: "missingSuffix",
        data: { name: this.#node.id.name, superClass: this.#node.superClass.name }
      }
      : null
  }

  get #needsSuffix() {
    return Boolean(this.#node.id) && isHtmlElementSubclass(this.#node) && !this.#node.id.name.endsWith("Element")
  }
}
