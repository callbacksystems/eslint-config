export function ruleSourcePathOf(id) {
  return `src/rules/${id.replaceAll("-", "_")}.js`
}
