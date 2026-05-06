import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { ESLint } from "eslint"
import { restrictGlobals, restrictImports, restrictSyntax } from "#restrictions"
import { lintFixture } from "#support"

test("restrictImports fires no-restricted-imports on a basic restricted import", async () => {
  const { ruleIds } = await lintFixture({ subdir: "restrictions", file: "violations.js" })
  assert.ok(ruleIds.has("callbacksystems-boundaries/imports"))
})

test("restrictImports respects `allowedIn` for path exemption", async () => {
  const { messageCount } = await lintFixture({ subdir: "restrictions", file: "allowed/exempted.js" })
  assert.equal(messageCount, 0, "exempted path should produce zero violations")
})

test("restrictImports `importNames` restricts only the named imports listed", async () => {
  const { ruleIds, messageCount } = await lintFixture({ subdir: "restrictions", file: "components/Button.js" })
  assert.ok(ruleIds.has("callbacksystems-boundaries/imports"), "createContext should fire")
  // The four are `createContext`, `internal`, `prompt` and `setTimeout`. `useState` is the one that must not fire.
  assert.equal(messageCount, 4, "useState (not in importNames) must not fire")
})

test("restrictImports `restrictedTo` narrows the rule to specific paths", async () => {
  const { messageCount } = await lintFixture({ subdir: "restrictions", file: "services/api.js" })
  assert.equal(messageCount, 0, "out-of-scope path must not fire restrictedTo rules")
})

test("restrictImports `allowedIn` works inside a `restrictedTo` scope", async () => {
  const { ruleIds } = await lintFixture({ subdir: "restrictions", file: "components/auth/Login.js" })
  assert.ok(ruleIds.has("callbacksystems-boundaries/imports"), "the global restriction must still fire")
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
  assert.ok(ruleIds.has("callbacksystems-boundaries/globals"))
})

test("restrictGlobals respects `allowedIn` for path exemption", async () => {
  const { messageCount } = await lintFixture({ subdir: "restrictions", file: "dialogs/dialog.js" })
  assert.equal(messageCount, 0, "`confirm` must be exempt under dialogs/**")
})

test("restrictGlobals `restrictedTo` only fires inside the scope", async () => {
  const { ruleIds } = await lintFixture({ subdir: "restrictions", file: "components/Button.js" })
  assert.ok(ruleIds.has("callbacksystems-boundaries/globals"), "`prompt` must fire inside components/**")
})

test("restrictGlobals `restrictedTo` does not fire outside the scope", async () => {
  const { messageCount } = await lintFixture({ subdir: "restrictions", file: "services/api.js" })
  assert.equal(messageCount, 0, "`prompt` must not fire outside components/**")
})

test("restrictGlobals keeps scoped items in one linear-size block", () => {
  const globals = [ { name: "prompt", message: "Components only.", restrictedTo: [ "components/**" ] } ]
  const blocks = restrictGlobals({ files: [ "**/*.js" ], globals })
  assert.deepEqual(filesOf(blocks), [ [ "**/*.js" ] ])
  assert.equal(blocks.length, 1)
})

test("restrictGlobals carries exemptions in the rule instead of emitting overrides", () => {
  const globals = [ { name: "confirm", message: "Use `confirmDialog`.", allowedIn: [ "dialogs/**" ] } ]
  const [ block ] = restrictGlobals({ files: [ "**/*.js" ], globals })
  const [ , options ] = block.rules["callbacksystems-boundaries/globals"]
  assert.deepEqual(options.items, globals)
})

test("restrictGlobals needs no precedence ordering between overlapping exemptions", () => {
  const globals = [
    { name: "confirm", message: "Use `confirmDialog`.", allowedIn: [ "dialogs/legacy.js", "dialogs/**" ] }
  ]
  assert.equal(restrictGlobals({ files: [ "**/*.js" ], globals }).length, 1)
})

test("overlapping broad and narrow exemptions both remain lifted", async () => {
  const messages = await restrictedMessagesFor([
    { name: "alert", message: "Broad.", allowedIn: [ "src/**" ] },
    { name: "confirm", message: "Narrow.", allowedIn: [ "src/**/test/**" ] }
  ])

  assert.equal(messages.length, 0)
})

test("many disjoint restricted scopes stay constant in config size", () => {
  assert.equal(restrictGlobals({
    files: [ "**/*.js" ],
    globals: Array.from({ length: 30 }, (_, index) => ({
      name: `global${index}`, message: "Scoped.", restrictedTo: [ `scope${index}/**` ]
    }))
  }).length, 1)
})

test("empty restrictions produce no config blocks", () => {
  assert.deepEqual(restrictImports({ paths: [] }), [])
  assert.deepEqual(restrictGlobals({ globals: [] }), [])
  assert.deepEqual(restrictSyntax({ selectors: [] }), [])
})

test("restriction schemas reject malformed items instead of failing during traversal", async () => {
  await assert.rejects(
    () => messagesFor(restrictGlobals({ globals: [ { message: "Missing a name." } ] }), "alert()"),
    /required property 'name'/u
  )
})

test("restriction schemas preserve the core import validation", async () => {
  await assert.rejects(
    () => messagesFor(restrictImports({ paths: [ { name: "library", message: "" } ] }), "import \"library\""),
    /shorter than 1/u
  )
})

test("restrictSyntax fires no-restricted-syntax on a basic selector match", async () => {
  const { ruleIds } = await lintFixture({ subdir: "restrictions", file: "violations.js" })
  assert.ok(ruleIds.has("callbacksystems-boundaries/syntax"))
})

test("restrictSyntax respects `allowedIn` for path exemption", async () => {
  const { messageCount } = await lintFixture({ subdir: "restrictions", file: "lib/i18n/format.js" })
  assert.equal(messageCount, 0, "`toLocaleString` must be exempt under lib/i18n/**")
})

test("restrictSyntax `restrictedTo` only fires inside the scope", async () => {
  const { ruleIds } = await lintFixture({ subdir: "restrictions", file: "components/Button.js" })
  assert.ok(ruleIds.has("callbacksystems-boundaries/syntax"), "setTimeout must fire inside components/**")
})

test("restrictSyntax `restrictedTo` does not fire outside the scope", async () => {
  const { messageCount } = await lintFixture({ subdir: "restrictions", file: "services/api.js" })
  assert.equal(messageCount, 0, "setTimeout must not fire outside components/**")
})

test("restrictSyntax supplies an explanation when none is configured", async () => {
  const [ message ] = await messagesFor(
    restrictSyntax({ selectors: [ { selector: "DebuggerStatement" } ] }), "debugger"
  )

  assert.equal(message.message, "This project boundary forbids this syntax.")
})

test("empty global and syntax messages retain their default explanations", async () => {
  const [ globalMessage ] = await messagesFor(restrictGlobals({ globals: [ { name: "alert", message: "" } ] }),
    "alert()")
  const [ syntaxMessage ] = await messagesFor(restrictSyntax({ selectors: [ {
    selector: "DebuggerStatement", message: ""
  } ] }), "debugger")

  assert.match(globalMessage.message, /This project boundary forbids it\./u)
  assert.equal(syntaxMessage.message, "This project boundary forbids this syntax.")
})

test("restrictImports covers default imports, named re-exports, and namespace re-exports", async () => {
  const messages = await messagesFor(restrictImports({
    paths: [ { name: "library", importNames: [ "default", "named", "not-an-identifier" ] } ]
  }), `
    import local from "library"
    import { "not-an-identifier" as namedString } from "library"
    export { named as publicName } from "library"
    export { "not-an-identifier" as publicString } from "library"
    export * from "library"
    export const untouched = local
  `)

  assert.deepEqual(messages.map(({ messageId }) => messageId), [
    "restrictedImportName", "restrictedImportName", "restrictedImportName", "restrictedImportName",
    "restrictedImportName"
  ])
})

test("restrictImports treats an empty importNames list as no restriction for every import shape", async () => {
  const messages = await messagesFor(restrictImports({ paths: [ { name: "library", importNames: [] } ] }), `
    import value from "library"
    import * as namespace from "library"
    export { named } from "library"
    export * from "library"
    export const untouched = [ value, namespace ]
  `)

  assert.deepEqual(messages, [])
})

test("restriction matching remains correct after the bounded matcher cache evicts old globs", async () => {
  const paths = Array.from({ length: 70 }, (_, index) => ({ name: "library", restrictedTo: [ `scope${index}/**` ] }))
  paths.push({ name: "library", restrictedTo: [ "target/**" ] })

  const messages = await messagesFor(restrictImports({ paths }), "import value from \"library\"", "target/check.js")
  const afterEviction = await messagesFor(
    restrictImports({ paths: [ paths[0] ] }), "import value from \"library\"", "scope0/check.js"
  )

  assert.equal(messages.length, 1)
  assert.equal(afterEviction.length, 1)
})

test("restrictImports supplies an explanation when none is configured", async () => {
  const [ message ] = await messagesFor(restrictImports({ paths: [ { name: "library" } ] }), "import \"library\"")

  assert.match(message.message, /This project boundary forbids it\./u)
})

test("restrictImports normalizes surrounding whitespace like the core rule", async () => {
  const [ message ] = await messagesFor(restrictImports({ paths: [ { name: "library" } ] }), "import \" library \"")

  assert.equal(message.messageId, "restrictedImport")
})

test("restrictions match dot-prefixed paths and supply a default explanation", async () => {
  const [ message ] = await messagesFor(
    restrictGlobals({ globals: [ { name: "alert", restrictedTo: [ ".hidden/**" ] } ] }),
    "alert()",
    ".hidden/check.js"
  )

  assert.match(message.message, /This project boundary forbids it\./u)
})

test("restrictExports reports what a folder may not present", async () => {
  const { ruleIds } = await lintFixture({ subdir: "restrictions", file: "models/roles.js" })
  assert.ok(ruleIds.has("callbacksystems/restrictions/exports"), "a constant in a models folder must fire")
})

test("restrictExports leaves the kind the folder is for alone", async () => {
  const { messageCount } = await lintFixture({ subdir: "restrictions", file: "models/account.js" })
  assert.equal(messageCount, 0, "a class in a models folder is what the folder is for")
})

function filesOf(blocks) {
  return blocks.map((block) => block.files)
}

async function restrictedMessagesFor(globals) {
  return messagesFor(restrictGlobals({ files: [ "**/*.js" ], globals }), "alert(); confirm()", "src/unit/test/check.js")
}

async function messagesFor(config, code, relativeFile = "check.js") {
  const root = await mkdtemp(path.join(tmpdir(), "restrictions-"))
  const [ result ] = await new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: config
  }).lintText(code, { filePath: path.join(root, relativeFile) })
  return result.messages
}
