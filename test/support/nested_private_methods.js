export function nestedPrivateMethods(count) {
  return Array.from({ length: count }, (_, index) => count - index - 1)
    .reduce((inner, index) => `class C${index} { #run${index}() { ${inner} use(value) } }`, "")
}
