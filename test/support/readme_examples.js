// Linted with the config the package ships, so an example can never drift from the rules it illustrates. Being
// fragments, the checks that need the whole project stand down.

import { readFile } from "node:fs/promises"
import path from "node:path"
import url from "node:url"
import { ESLint } from "eslint"
import base from "#base"
import node from "#node"

const README = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..", "..", "README.md")
const JS_BLOCK = /```js\n(?<code>[\s\S]*?)```/gu
const FRAGMENT_RULES = { "import-x/no-unresolved": "off", "no-undef": "off", "no-unused-vars": "off" }

export async function readmeExamples() {
  const text = await readFile(README, "utf8")
  return text.matchAll(JS_BLOCK).map((match) => match.groups.code).toArray()
}

export async function problemsIn(example) {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [ ...base, ...node, { rules: FRAGMENT_RULES } ]
  })
  const [ result ] = await eslint.lintText(example, { filePath: "readme_example.js" })
  return result.messages.map((message) => `${message.line}:${message.column} ${message.message} (${message.ruleId})`)
}
