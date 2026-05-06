export function dedent(strings, ...values) {
  const lines = String.raw({ raw: strings.raw }, ...values).split("\n")
  if (lines[0] === "") lines.shift()
  if (lines.at(-1)?.trim() === "") lines.pop()

  const indent = minLeadingSpaces(lines)
  return lines.map((line) => line.slice(indent)).join("\n")
}

function minLeadingSpaces(lines) {
  const indents = lines.filter((line) => line.trim()).map((line) => line.match(/^ */u)[0].length)
  return indents.length > 0 ? Math.min(...indents) : 0
}
