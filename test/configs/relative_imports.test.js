import assert from "node:assert/strict"
import path from "node:path"
import { test } from "node:test"
import url from "node:url"
import { ESLint } from "eslint"

const FIXTURE = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "../fixtures/relative_imports")

// The firing path needs a real jsconfig resolver, which RuleTester cannot provide.
test("no-relative-imports rewrites a relative import to its bare jsconfig equivalent", async () => {
  const output = await fixedOutputOf("app/consumer.js")

  assert.match(output, /from "lib\/value"/u, "should rewrite ../lib/value to bare lib/value")
})

// A processor extracts each Astro `<script>` into a virtual file, which RuleTester does not run either.
test("no-relative-imports reaches a client-side script inside an Astro component", async () => {
  const output = await fixedOutputOf("pages/consumer.astro")

  assert.match(output, /from "lib\/value"/u, "should rewrite ../lib/value to bare lib/value")
})

async function fixedOutputOf(file) {
  const [ result ] = await new ESLint({ cwd: FIXTURE, fix: true }).lintFiles([ path.join(FIXTURE, file) ])
  return result.output ?? ""
}
