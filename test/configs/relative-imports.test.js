import assert from "node:assert/strict"
import path from "node:path"
import { test } from "node:test"
import url from "node:url"
import { ESLint } from "eslint"

const FIXTURE = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "../fixtures/relative-imports")

// The firing path needs a real jsconfig resolver, which RuleTester cannot provide.
test("no-relative-imports rewrites a relative import to its bare jsconfig equivalent", async () => {
  const [ result ] = await new ESLint({ cwd: FIXTURE, fix: true })
    .lintFiles([ path.join(FIXTURE, "app/consumer.js") ])

  assert.match(result.output ?? "", /from "lib\/value"/u, "should rewrite ../lib/value to bare lib/value")
})
