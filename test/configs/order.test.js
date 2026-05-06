import assert from "node:assert/strict"
import { test } from "node:test"
import { orderMembers } from "#order"
import { lintFixture } from "#support"

test("orderMembers places a declared group where its anchor puts it", async () => {
  const { messageCount } = await lintFixture({ subdir: "order", file: "anchored.js" })
  assert.equal(messageCount, 0, "the declared pair reads between `disconnectedCallback` and `adoptedCallback`")
})

test("orderMembers keeps a declared group ahead of the plain methods", async () => {
  const { ruleIds } = await lintFixture({ subdir: "order", file: "declared_group.js" })
  assert.ok(ruleIds.has("perfectionist/sort-classes"), "`started` must lead `render`")
})

test("orderMembers keeps the packaged groups", async () => {
  const { ruleIds } = await lintFixture({ subdir: "order", file: "packaged_group.js" })
  assert.ok(ruleIds.has("perfectionist/sort-classes"), "form callbacks must still lead the plain methods")
})

test("orderMembers refuses a name a packaged group already takes", () => {
  const groups = [ { name: "connected-callback", pattern: "^connected$" } ]
  assert.throws(() => orderMembers({ groups }), /already a group/)
})

test("orderMembers refuses an anchor that names no group", () => {
  const groups = [ { name: "started", pattern: "^started$" } ]
  assert.throws(() => orderMembers({ groups, after: "nope" }), /no group named/)
})

test("orderMembers refuses both `after` and `before`", () => {
  const groups = [ { name: "started", pattern: "^started$" } ]
  assert.throws(() => orderMembers({ groups, after: "adopted-callback", before: "adopted-callback" }), /not both/)
})
