const EM_DASH = "\u2014"

const checkText = (context, node, text) => {
  if (text.includes(EM_DASH)) {
    context.report({ node, messageId: "noEmDash" })
  }
}

const checkComments = (context, sourceCode) => {
  for (const comment of sourceCode.getAllComments()) {
    checkText(context, comment, comment.value)
  }
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow em-dash in comments and strings"
    },
    schema: [],
    messages: {
      noEmDash: "Replace em-dash with `,`, `;`, `:`, `.`, parentheses, or rephrase."
    }
  },
  create(context) {
    const { sourceCode } = context

    return {
      Program: () => checkComments(context, sourceCode),
      Literal: (node) => {
        if (typeof node.value === "string") checkText(context, node, node.raw)
      },
      TemplateElement: (node) => checkText(context, node, node.value.raw)
    }
  }
}
