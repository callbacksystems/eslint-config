import assert from "node:assert/strict"
import { test } from "node:test"
import { lintFixture } from "#support"

test("restrictImports fires no-restricted-imports on a basic restricted import", async () => {
  const { ruleIds } = await lintFixture({ subdir: "restrictions", file: "violations.js" })
  assert.ok(ruleIds.has("no-restricted-imports"))
})

test("restrictImports respects `allowedIn` for path exemption", async () => {
  const { messageCount } = await lintFixture({ subdir: "restrictions", file: "allowed/exempted.js" })
  assert.equal(messageCount, 0, "exempted path should produce zero violations")
})

test("restrictImports `importNames` restricts only the named imports listed", async () => {
  const { ruleIds, messageCount } = await lintFixture({ subdir: "restrictions", file: "components/Button.js" })
  assert.ok(ruleIds.has("no-restricted-imports"), "createContext should fire")
  // The four are `createContext`, `internal`, `prompt` and `setTimeout`. `useState` is the one that must not fire.
  assert.equal(messageCount, 4, "useState (not in importNames) must not fire")
})

test("restrictImports `restrictedTo` narrows the rule to specific paths", async () => {
  const { messageCount } = await lintFixture({ subdir: "restrictions", file: "services/api.js" })
  assert.equal(messageCount, 0, "out-of-scope path must not fire restrictedTo rules")
})

test("restrictImports `allowedIn` works inside a `restrictedTo` scope", async () => {
  const { ruleIds } = await lintFixture({ subdir: "restrictions", file: "components/auth/Login.js" })
  assert.ok(ruleIds.has("no-restricted-imports"), "createContext (global) must still fire in cross-scope path")
  const { messageCount } = await lintFixture({ subdir: "restrictions", file: "components/auth/Login.js" })
  assert.equal(messageCount, 1, "only createContext should fire; `internal` is exempt here")
})

test("overlapping `restrictedTo` scopes keep every restriction that reaches the file", async () => {
  const { messageCount } = await lintFixture({ subdir: "restrictions", file: "components/auth/Overlap.js" })
  assert.equal(messageCount, 2, "a file in both scopes must carry both restrictions")
})

test("overlapping `restrictedTo` scopes apply only the wider one outside the overlap", async () => {
  const { messageCount } = await lintFixture({ subdir: "restrictions", file: "components/Plain.js" })
  assert.equal(messageCount, 1, "the narrower scope must not leak outside itself")
})

test("restrictGlobals fires no-restricted-globals on a basic restricted global", async () => {
  const { ruleIds } = await lintFixture({ subdir: "restrictions", file: "violations.js" })
  assert.ok(ruleIds.has("no-restricted-globals"))
})

test("restrictGlobals respects `allowedIn` for path exemption", async () => {
  const { messageCount } = await lintFixture({ subdir: "restrictions", file: "dialogs/dialog.js" })
  assert.equal(messageCount, 0, "`confirm` must be exempt under dialogs/**")
})

test("restrictGlobals `restrictedTo` only fires inside the scope", async () => {
  const { ruleIds } = await lintFixture({ subdir: "restrictions", file: "components/Button.js" })
  assert.ok(ruleIds.has("no-restricted-globals"), "`prompt` must fire inside components/**")
})

test("restrictGlobals `restrictedTo` does not fire outside the scope", async () => {
  const { messageCount } = await lintFixture({ subdir: "restrictions", file: "services/api.js" })
  assert.equal(messageCount, 0, "`prompt` must not fire outside components/**")
})

test("restrictSyntax fires no-restricted-syntax on a basic selector match", async () => {
  const { ruleIds } = await lintFixture({ subdir: "restrictions", file: "violations.js" })
  assert.ok(ruleIds.has("no-restricted-syntax"))
})

test("restrictSyntax respects `allowedIn` for path exemption", async () => {
  const { messageCount } = await lintFixture({ subdir: "restrictions", file: "lib/i18n/format.js" })
  assert.equal(messageCount, 0, "`toLocaleString` must be exempt under lib/i18n/**")
})

test("restrictSyntax `restrictedTo` only fires inside the scope", async () => {
  const { ruleIds } = await lintFixture({ subdir: "restrictions", file: "components/Button.js" })
  assert.ok(ruleIds.has("no-restricted-syntax"), "setTimeout must fire inside components/**")
})

test("restrictSyntax `restrictedTo` does not fire outside the scope", async () => {
  const { messageCount } = await lintFixture({ subdir: "restrictions", file: "services/api.js" })
  assert.equal(messageCount, 0, "setTimeout must not fire outside components/**")
})

test("restrictExports reports what a folder may not present", async () => {
  const { ruleIds } = await lintFixture({ subdir: "restrictions", file: "models/roles.js" })
  assert.ok(ruleIds.has("callbacksystems/restrictions/exports"), "a constant in a models folder must fire")
})

test("restrictExports leaves the kind the folder is for alone", async () => {
  const { messageCount } = await lintFixture({ subdir: "restrictions", file: "models/account.js" })
  assert.equal(messageCount, 0, "a class in a models folder is what the folder is for")
})
