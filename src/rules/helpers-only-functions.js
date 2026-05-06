// Helper modules (files inside `helpers/` at any depth, or whose basename ends
// in `helpers.<ext>`) must export only named functions. AI agents tend to
// dump classes and module-scope mutable state into helpers; the convention
// keeps the file as a flat surface of small pure functions.

const HELPERS_PATH = /\/helpers\//u
const HELPERS_FILE = /(^|[/\\_-])helpers\.[a-z]+$/u

const isHelperFile = (filename) =>
  HELPERS_PATH.test(filename) || HELPERS_FILE.test(filename)

const isFunctionInit = (init) =>
  init?.type === "FunctionExpression" || init?.type === "ArrowFunctionExpression"

const isMutableModuleVariable = (node) =>
  node.type === "VariableDeclaration" && (node.kind === "let" || node.kind === "var")

const isAtModuleTop = (node) =>
  node.parent.type === "Program" || node.parent.type === "ExportNamedDeclaration"

const reportNonFunctionExports = (context, declarators) => {
  declarators
    .filter((declarator) => !isFunctionInit(declarator.init))
    .forEach((declarator) => {
      context.report({ node: declarator, messageId: "nonFunctionExport" })
    })
}

const reportTopLevel = (context, node, messageId) => {
  if (isAtModuleTop(node)) context.report({ node, messageId })
}

export default {
  meta: {
    type: "problem",
    docs: { description: "Enforce helper modules export only named functions" },
    schema: [],
    messages: {
      noDefault: "Helper modules must use named exports only.",
      noClass: "Helper modules must not declare classes; export plain functions.",
      noMutableState: "Helper modules must not declare module-scope `{{kind}}`.",
      nonFunctionExport: "Helper modules must export only functions (`function` or arrow as `const`)."
    }
  },
  create(context) {
    if (!isHelperFile(context.filename)) return {}

    return {
      ExportDefaultDeclaration(node) {
        context.report({ node, messageId: "noDefault" })
      },
      ClassDeclaration(node) {
        reportTopLevel(context, node, "noClass")
      },
      "Program > VariableDeclaration"(node) {
        if (isMutableModuleVariable(node)) {
          context.report({ node, messageId: "noMutableState", data: { kind: node.kind } })
        }
      },
      "ExportNamedDeclaration > VariableDeclaration"(node) {
        reportNonFunctionExports(context, node.declarations)
      }
    }
  }
}
