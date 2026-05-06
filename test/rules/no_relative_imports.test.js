import path from "node:path"
import url from "node:url"
import rule from "#rules/no_relative_imports"
import { tester } from "#support"

const FIXTURE = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "../fixtures/relative_imports")

// RuleTester has no project resolver, so the firing path lives in test/configs/relative_imports.test.js.
tester.run("no-relative-imports", rule, {
  valid: [
    "import x from 'lodash'",
    "import x from './sibling'",
    "import x from '../parent/file'",
    // With no path mapping in reach, the search climbs to the root and leaves the import alone.
    { code: "import { value } from '../lib/value'", filename: path.join(FIXTURE, "app/consumer.js") }
  ],
  invalid: []
})
