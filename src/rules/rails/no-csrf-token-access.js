// Reading the CSRF token from the `<meta>` tag, or setting it on an `X-CSRF-Token` request header, reimplements what
// Rails already wires into native forms. Use a form (`button_to`, `form_with`), or `@rails/request.js` when a manual
// fetch is unavoidable; it injects the token for you.

import { isStringLiteral } from "#helpers/ast"
import { reportProblem } from "#helpers/report"

const META_TAG_SELECTOR = /meta\[[^\]]*csrf-token/iu
const CSRF_HEADER = /^x-(csrf|xsrf)-token$/iu

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow reading the CSRF token from the meta tag or an X-CSRF-Token header" },
    schema: [],
    messages: {
      metaTag: "Don't read the CSRF token from the `<meta>` tag; use a native form or `@rails/request.js`.",
      header: "Don't set the CSRF token on an `{{name}}` header; use a native form or `@rails/request.js`."
    }
  },
  create(context) {
    return { Literal: (node) => reportProblem(context, new CsrfTokenAccess(node)) }
  }
}

class CsrfTokenAccess {
  #node

  constructor(node) {
    this.#node = node
  }

  get problem() {
    return this.#metaTagProblem ?? this.#headerProblem
  }

  get #metaTagProblem() {
    return META_TAG_SELECTOR.test(this.#value) ? { node: this.#node, messageId: "metaTag" } : null
  }

  get #value() {
    return isStringLiteral(this.#node) ? this.#node.value : ""
  }

  get #headerProblem() {
    return CSRF_HEADER.test(this.#value)
      ? { node: this.#node, messageId: "header", data: { name: this.#value } }
      : null
  }
}
