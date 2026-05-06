import assert from "node:assert/strict"
import { test } from "node:test"
import { PossibleOutcomes } from "#helpers/flow/possible_outcomes"

const NORMAL = 1
const RETURN = 2
const THROW = 4

test("possible outcomes distinguish empty, clean, and effectful paths", () => {
  const empty = new PossibleOutcomes(0)
  const clean = new PossibleOutcomes(NORMAL)
  const effect = new PossibleOutcomes(0, { effectfulTypes: RETURN })

  assert.ok(empty.isEmpty)
  assert.ok(!clean.isEmpty)
  assert.ok(!effect.isEmpty)
  assert.ok(clean.hasAny(NORMAL))
  assert.ok(effect.hasAny(RETURN))
  assert.ok(!empty.hasAny(THROW))
})

test("possible outcomes recognize each clean labeled path", () => {
  const cleanBreak = new PossibleOutcomes(0, { breakLabels: labels("exit") })
  const cleanContinue = new PossibleOutcomes(0, { continueLabels: labels("repeat") })

  assert.ok(cleanBreak.hasCleanOutcome)
  assert.ok(cleanContinue.hasCleanOutcome)
  assert.ok(cleanBreak.hasLabeledControl)
  assert.ok(!new PossibleOutcomes(0).hasLabeledControl)
})

test("possible outcomes recognize each effectful labeled path", () => {
  const effectBreak = new PossibleOutcomes(0, { effectfulBreakLabels: labels("exit") })
  const effectContinue = new PossibleOutcomes(0, { effectfulContinueLabels: labels("repeat") })

  assert.ok(effectBreak.hasEffectfulOutcome)
  assert.ok(effectContinue.hasEffectfulOutcome)
  assert.ok(effectBreak.hasLabeledControl)
})

test("possible outcomes combine and filter path kinds", () => {
  const clean = new PossibleOutcomes(NORMAL | RETURN, { breakLabels: labels("exit"), continueLabels: labels("repeat") })
  const effect = new PossibleOutcomes(THROW, {
    effectfulTypes: RETURN, effectfulBreakLabels: labels("stop"), effectfulContinueLabels: labels("again")
  })
  const combined = clean.union(effect)

  assert.equal(combined.cleanTypes, NORMAL | RETURN | THROW)
  assert.equal(combined.effectfulTypes, RETURN)
  assert.deepEqual(combined.breakLabels, labels("exit"))
  assert.deepEqual(combined.effectfulBreakLabels, labels("stop"))
  assert.equal(combined.onlyTypes(RETURN).cleanTypes, RETURN)
  assert.equal(combined.onlyTypes(RETURN).effectfulTypes, RETURN)
})

test("possible outcomes add, remove, and promote path kinds", () => {
  const paths = new PossibleOutcomes(NORMAL | RETURN, { effectfulTypes: RETURN })

  assert.equal(paths.withTypes(THROW).cleanTypes, NORMAL | RETURN | THROW)
  assert.equal(paths.withoutTypes(RETURN).cleanTypes, NORMAL)
  assert.equal(paths.withoutTypes(RETURN).effectfulTypes, 0)
  assert.equal(paths.effectful.effectfulTypes, NORMAL | RETURN)
  assert.equal(paths.possiblyEffectful.cleanTypes, NORMAL | RETURN)
  assert.equal(paths.possiblyEffectful.effectfulTypes, NORMAL | RETURN)
})

test("labels consume their own clean and effectful breaks", () => {
  const paths = labeledPaths()
  const exited = paths.afterLabel("exit", { consumesContinue: false, continueCanComplete: false })

  assert.ok(exited.hasCleanAny(NORMAL))
  assert.ok(exited.hasEffectfulAny(NORMAL))
  assert.deepEqual(exited.breakLabels, labels())
  assert.deepEqual(exited.continueLabels, labels("repeat"))
  assert.deepEqual(paths.afterLabel("other", {
    consumesContinue: false, continueCanComplete: false
  }).breakLabels, labels("exit"))
})

test("labels consume continues only when their loop can complete", () => {
  const paths = labeledPaths()
  const repeated = paths.afterLabel("repeat", { consumesContinue: true, continueCanComplete: true })
  const forever = paths.afterLabel("repeat", { consumesContinue: true, continueCanComplete: false })

  assert.ok(repeated.hasCleanAny(NORMAL))
  assert.ok(repeated.hasEffectfulAny(NORMAL))
  assert.deepEqual(repeated.continueLabels, labels())
  assert.ok(!forever.hasAny(NORMAL))
  assert.deepEqual(forever.continueLabels, labels())
})

test("sequences carry effects through their reachable normal paths", () => {
  const cleanNormal = new PossibleOutcomes(NORMAL)
  const effectfulNormal = new PossibleOutcomes(0, { effectfulTypes: NORMAL })
  const returned = new PossibleOutcomes(RETURN)

  assert.ok(cleanNormal.followedBy(returned).hasCleanAny(RETURN))
  assert.ok(!cleanNormal.followedBy(returned).hasEffectfulAny(RETURN))
  assert.ok(effectfulNormal.followedBy(returned).hasEffectfulAny(RETURN))
  assert.ok(!effectfulNormal.followedBy(returned).hasCleanAny(RETURN))
  assert.ok(!returned.followedBy(cleanNormal).hasAny(NORMAL))
})

test("sequences retain both kinds of normal path", () => {
  const bothNormal = new PossibleOutcomes(NORMAL, { effectfulTypes: NORMAL })
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
  const effectfulThrow = new PossibleOutcomes(0, { effectfulTypes: THROW })

  assert.ok(cleanThrow.caughtBy(handler).hasCleanAny(NORMAL))
  assert.ok(effectfulThrow.caughtBy(handler).hasEffectfulAny(NORMAL))
  assert.ok(new PossibleOutcomes(RETURN).caughtBy(handler).hasCleanAny(RETURN))
})

test("finally preserves entering effects and overrides each reachable path", () => {
  const returned = new PossibleOutcomes(RETURN)
  const effectfulReturn = new PossibleOutcomes(0, { effectfulTypes: RETURN })
  const effectfulFinalizer = new PossibleOutcomes(0, { effectfulTypes: NORMAL })

  assert.ok(returned.finalizedBy(new PossibleOutcomes(NORMAL)).hasCleanAny(RETURN))
  assert.ok(returned.finalizedBy(effectfulFinalizer).hasEffectfulAny(RETURN))
  assert.ok(returned.finalizedBy(new PossibleOutcomes(THROW)).hasCleanAny(THROW))
  assert.ok(effectfulReturn.finalizedBy(new PossibleOutcomes(THROW)).hasEffectfulAny(THROW))
})

function labels(...values) {
  return new Set(values)
}

function labeledPaths() {
  return new PossibleOutcomes(RETURN, {
    breakLabels: labels("exit"),
    continueLabels: labels("repeat"),
    effectfulTypes: THROW,
    effectfulBreakLabels: labels("exit"),
    effectfulContinueLabels: labels("repeat")
  })
}
