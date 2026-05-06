import assert from "node:assert/strict"
import { test } from "node:test"
import { PossibleOutcomes } from "#helpers/flow/possible_outcomes"

const NORMAL = 1
const RETURN = 2
const THROW = 4
const BREAK = 8
const CONTINUE = 16

test("possible outcomes distinguish empty, clean, and effectful paths", () => {
  const empty = new PossibleOutcomes(0)
  const clean = new PossibleOutcomes(NORMAL)
  const effect = new PossibleOutcomes(RETURN).effectful

  assert.ok(empty.isEmpty)
  assert.ok(!clean.isEmpty)
  assert.ok(!effect.isEmpty)
  assert.ok(clean.hasAny(NORMAL))
  assert.ok(effect.hasAny(RETURN))
  assert.ok(!empty.hasAny(THROW))
})

test("possible outcomes recognize each clean labeled path", () => {
  const cleanBreak = PossibleOutcomes.forLabel("exit", BREAK)
  const cleanContinue = PossibleOutcomes.forLabel("repeat", CONTINUE)

  assert.ok(cleanBreak.hasCleanOutcome)
  assert.ok(cleanContinue.hasCleanOutcome)
  assert.ok(cleanContinue.hasLabeledControl)
  assert.ok(cleanBreak.hasLabeledControl)
  assert.ok(!new PossibleOutcomes(0).hasLabeledControl)
})

test("possible outcomes recognize each effectful labeled path", () => {
  const effectBreak = PossibleOutcomes.forLabel("exit", BREAK).effectful
  const effectContinue = PossibleOutcomes.forLabel("repeat", CONTINUE).effectful

  assert.ok(effectBreak.hasEffectfulOutcome)
  assert.ok(effectContinue.hasEffectfulOutcome)
  assert.ok(effectContinue.hasLabeledControl)
  assert.ok(effectBreak.hasLabeledControl)
})

test("possible outcomes combine and filter path kinds", () => {
  const clean = new PossibleOutcomes(NORMAL | RETURN).union(PossibleOutcomes.forLabel("exit", BREAK))
  const effect = new PossibleOutcomes(THROW).union(new PossibleOutcomes(RETURN).effectful)
    .union(PossibleOutcomes.forLabel("stop", BREAK).effectful)
  const combined = clean.union(effect)

  assertTypes(clean, { clean: NORMAL | RETURN })
  assertTypes(effect, { clean: THROW, effectful: RETURN })
  assertTypes(combined, { clean: NORMAL | RETURN | THROW, effectful: RETURN })
  assertTypes(combined.onlyTypes(RETURN), { clean: RETURN, effectful: RETURN })
  assertTypes(combined.onlyTypes(0).afterLabel("exit", {
    consumesContinue: false, continueCanComplete: false
  }), { clean: NORMAL })
  assertTypes(combined.onlyTypes(0).afterLabel("stop", {
    consumesContinue: false, continueCanComplete: false
  }), { effectful: NORMAL })
})

test("possible outcomes add, remove, and promote path kinds", () => {
  const paths = new PossibleOutcomes(NORMAL | RETURN).union(new PossibleOutcomes(RETURN).effectful)

  assertTypes(paths.withTypes(THROW), { clean: NORMAL | RETURN | THROW, effectful: RETURN })
  assertTypes(paths.withoutTypes(RETURN), { clean: NORMAL })
  assertTypes(paths.effectful, { effectful: NORMAL | RETURN })
  assertTypes(paths.possiblyEffectful, { clean: NORMAL | RETURN, effectful: NORMAL | RETURN })
})

test("labels consume their own clean and effectful breaks", () => {
  const paths = labeledPaths()
  const exited = paths.afterLabel("exit", { consumesContinue: false, continueCanComplete: false })

  assert.ok(exited.hasCleanAny(NORMAL))
  assert.ok(exited.hasEffectfulAny(NORMAL))
  assert.ok(exited.hasLabeledControl)
  assert.ok(!exited.afterLabel("repeat", { consumesContinue: true, continueCanComplete: false }).hasLabeledControl)
  assert.ok(!exited.onlyTypes(0).afterLabel("exit", {
    consumesContinue: false, continueCanComplete: false
  }).hasAny(NORMAL))
  assert.ok(!paths.afterLabel("other", { consumesContinue: false, continueCanComplete: false }).hasAny(NORMAL))
})

test("labels consume continues only when their loop can complete", () => {
  const paths = labeledPaths()
  const repeated = paths.afterLabel("repeat", { consumesContinue: true, continueCanComplete: true })
  const forever = paths.afterLabel("repeat", { consumesContinue: true, continueCanComplete: false })

  assert.ok(repeated.hasCleanAny(NORMAL))
  assert.ok(repeated.hasEffectfulAny(NORMAL))
  assert.ok(!repeated.afterLabel("exit", { consumesContinue: false, continueCanComplete: false }).hasLabeledControl)
  assert.ok(!forever.hasAny(NORMAL))
  assert.ok(!forever.afterLabel("exit", { consumesContinue: false, continueCanComplete: false }).hasLabeledControl)
})

test("sequences carry effects through their reachable normal paths", () => {
  const cleanNormal = new PossibleOutcomes(NORMAL)
  const effectfulNormal = new PossibleOutcomes(NORMAL).effectful
  const returned = new PossibleOutcomes(RETURN)

  assert.ok(cleanNormal.followedBy(returned).hasCleanAny(RETURN))
  assert.ok(!cleanNormal.followedBy(returned).hasEffectfulAny(RETURN))
  assert.ok(effectfulNormal.followedBy(returned).hasEffectfulAny(RETURN))
  assert.ok(!effectfulNormal.followedBy(returned).hasCleanAny(RETURN))
  assert.ok(!returned.followedBy(cleanNormal).hasAny(NORMAL))
})

test("sequences retain both kinds of normal path", () => {
  const bothNormal = new PossibleOutcomes(NORMAL).possiblyEffectful
  const returned = new PossibleOutcomes(RETURN)

  assert.ok(bothNormal.followedBy(returned).hasCleanAny(RETURN))
  assert.ok(bothNormal.followedBy(returned).hasEffectfulAny(RETURN))
  assert.ok(bothNormal.normalFrom(NORMAL).hasCleanAny(NORMAL))
  assert.ok(bothNormal.normalFrom(NORMAL).hasEffectfulAny(NORMAL))
  assert.ok(returned.normalFrom(NORMAL).isEmpty)
})

test("catch preserves the effect status of the throwing path", () => {
  const handler = new PossibleOutcomes(NORMAL)
  const cleanThrow = new PossibleOutcomes(THROW)
  const effectfulThrow = new PossibleOutcomes(THROW).effectful

  assert.ok(cleanThrow.caughtBy(handler).hasCleanAny(NORMAL))
  assert.ok(effectfulThrow.caughtBy(handler).hasEffectfulAny(NORMAL))
  assert.ok(!effectfulThrow.caughtBy(handler).hasCleanAny(NORMAL))
  assert.ok(new PossibleOutcomes(RETURN).caughtBy(handler).hasCleanAny(RETURN))
})

test("finally preserves entering effects and overrides each reachable path", () => {
  const returned = new PossibleOutcomes(RETURN)
  const effectfulReturn = new PossibleOutcomes(RETURN).effectful
  const effectfulFinalizer = new PossibleOutcomes(NORMAL).effectful

  assert.ok(returned.finalizedBy(new PossibleOutcomes(NORMAL)).hasCleanAny(RETURN))
  assert.ok(returned.finalizedBy(effectfulFinalizer).hasEffectfulAny(RETURN))
  assert.ok(!returned.finalizedBy(effectfulFinalizer).hasCleanAny(RETURN))
  assert.ok(returned.finalizedBy(new PossibleOutcomes(THROW)).hasCleanAny(THROW))
  assert.ok(effectfulReturn.finalizedBy(new PossibleOutcomes(THROW)).hasEffectfulAny(THROW))
  assert.ok(!effectfulReturn.finalizedBy(new PossibleOutcomes(THROW)).hasCleanAny(THROW))
})

test("a label keeps independent break and continue paths with both effect states", () => {
  const paths = PossibleOutcomes.forLabel("same", BREAK | CONTINUE).possiblyEffectful
  const afterBreak = paths.afterLabel("same", { consumesContinue: false, continueCanComplete: false })
  assertTypes(afterBreak, { clean: NORMAL, effectful: NORMAL })
  assert.ok(afterBreak.hasLabeledControl)
  assert.ok(afterBreak.onlyTypes(0).afterLabel("same", { consumesContinue: true, continueCanComplete: false }).isEmpty)
  assertTypes(paths.onlyTypes(0).afterLabel("same", {
    consumesContinue: true, continueCanComplete: true
  }), { clean: NORMAL, effectful: NORMAL })
})

test("derived outcomes preserve their input labels and the shared empty state", () => {
  const empty = new PossibleOutcomes(0)
  const labeled = empty.union(PossibleOutcomes.forLabel("exit", BREAK))
  assert.ok(labeled.afterLabel("exit", { consumesContinue: false, continueCanComplete: false }).hasAny(NORMAL))
  assert.ok(labeled.hasLabeledControl)
  assert.ok(empty.isEmpty)
  assert.ok(new PossibleOutcomes(0).isEmpty)
})

function assertTypes(outcomes, { clean = 0, effectful = 0 }) {
  [ NORMAL, RETURN, THROW, BREAK, CONTINUE ].forEach((type) => {
    assert.equal(outcomes.hasCleanAny(type), Boolean(clean & type))
    assert.equal(outcomes.hasEffectfulAny(type), Boolean(effectful & type))
  })
}

function labeledPaths() {
  return new PossibleOutcomes(RETURN).union(new PossibleOutcomes(THROW).effectful)
    .union(PossibleOutcomes.forLabel("exit", BREAK).possiblyEffectful)
    .union(PossibleOutcomes.forLabel("repeat", CONTINUE).possiblyEffectful)
}
