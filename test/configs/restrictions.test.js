import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { lintFixture } from "#test/support"

const messagesIn = ({ subdir, file }) => lintFixture({ subdir, file })

describe("restrictImports", () => {
  it("fires no-restricted-imports on a basic restricted import", async () => {
    const { ruleIds } = await messagesIn({ subdir: "restrictions", file: "violations.js" })
    assert.ok(ruleIds.has("no-restricted-imports"))
  })

  it("respects `allowedIn` for path exemption", async () => {
    const { messageCount } = await messagesIn({ subdir: "restrictions", file: "allowed/exempted.js" })
    assert.equal(messageCount, 0, "exempted path should produce zero violations")
  })

  it("`importNames` restricts only the named imports listed", async () => {
    const { ruleIds, messageCount } = await messagesIn({ subdir: "restrictions", file: "components/Button.js" })
    assert.ok(ruleIds.has("no-restricted-imports"), "createContext should fire")
    // Button.js imports `createContext` and `useState`. Only `createContext` is restricted; useState must pass.
    // It also imports `internal` (restrictedTo) and uses prompt/setTimeout. Total expected: 4 messages.
    assert.equal(messageCount, 4, "useState (not in importNames) must not fire")
  })

  it("`restrictedTo` narrows the rule to specific paths", async () => {
    const { messageCount } = await messagesIn({ subdir: "restrictions", file: "services/api.js" })
    // The services/api.js imports `internal`, but it's outside the restrictedTo scope (`components/**`).
    // No global restrictions tripped either. Should be zero.
    assert.equal(messageCount, 0, "out-of-scope path must not fire restrictedTo rules")
  })

  it("`allowedIn` works inside a `restrictedTo` scope (cross-scope override)", async () => {
    const { ruleIds } = await messagesIn({ subdir: "restrictions", file: "components/auth/Login.js" })
    // `internal` is restricted in components/** but exempted in components/auth/**.
    // `createContext` (global importNames) must STILL fire in components/auth/**.
    assert.ok(ruleIds.has("no-restricted-imports"), "createContext (global) must still fire in cross-scope path")
    const { messageCount } = await messagesIn({ subdir: "restrictions", file: "components/auth/Login.js" })
    assert.equal(messageCount, 1, "only createContext should fire; `internal` is exempt here")
  })
})

describe("restrictGlobals", () => {
  it("fires no-restricted-globals on a basic restricted global", async () => {
    const { ruleIds } = await messagesIn({ subdir: "restrictions", file: "violations.js" })
    assert.ok(ruleIds.has("no-restricted-globals"))
  })

  it("respects `allowedIn` for path exemption", async () => {
    const { messageCount } = await messagesIn({ subdir: "restrictions", file: "dialogs/dialog.js" })
    assert.equal(messageCount, 0, "`confirm` must be exempt under dialogs/**")
  })

  it("`restrictedTo` only fires inside the scope", async () => {
    const { ruleIds } = await messagesIn({ subdir: "restrictions", file: "components/Button.js" })
    assert.ok(ruleIds.has("no-restricted-globals"), "`prompt` must fire inside components/**")
  })

  it("`restrictedTo` does not fire outside the scope", async () => {
    const { messageCount } = await messagesIn({ subdir: "restrictions", file: "services/api.js" })
    assert.equal(messageCount, 0, "`prompt` must not fire outside components/**")
  })
})

describe("restrictSyntax", () => {
  it("fires no-restricted-syntax on a basic selector match", async () => {
    const { ruleIds } = await messagesIn({ subdir: "restrictions", file: "violations.js" })
    assert.ok(ruleIds.has("no-restricted-syntax"))
  })

  it("respects `allowedIn` for path exemption", async () => {
    const { messageCount } = await messagesIn({ subdir: "restrictions", file: "lib/i18n/format.js" })
    assert.equal(messageCount, 0, "`toLocaleString` must be exempt under lib/i18n/**")
  })

  it("`restrictedTo` only fires inside the scope", async () => {
    const { ruleIds } = await messagesIn({ subdir: "restrictions", file: "components/Button.js" })
    assert.ok(ruleIds.has("no-restricted-syntax"), "setTimeout must fire inside components/**")
  })

  it("`restrictedTo` does not fire outside the scope", async () => {
    const { messageCount } = await messagesIn({ subdir: "restrictions", file: "services/api.js" })
    assert.equal(messageCount, 0, "setTimeout must not fire outside components/**")
  })
})
