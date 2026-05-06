import assert from "node:assert/strict"
import { test } from "node:test"
import { RangedEvents } from "#helpers/syntax/ranged_events"

test("queries sorted events by half-open source ranges", () => {
  const events = new RangedEvents()
  assert.deepEqual([ events.hasInside([ 0, 100 ]), events.maximumInside([ 0, 100 ]) ], [ false, -1 ])

  events.add(10, 2)
  events.add(20, 7)
  events.add(30, 3)
  events.add(40, 5)

  assert.deepEqual([
    events.hasInside([ 11, 40 ]), events.hasInside([ 41, 50 ]),
    events.maximumInside([ 11, 40 ]), events.maximumInside([ 40, 41 ]),
    events.maximumInside([ 11, 20 ])
  ], [ true, false, 7, 5, -1 ])
})

test("invalidates its maximum index when another event is added", () => {
  const events = new RangedEvents()
  events.add(10, 2)
  assert.equal(events.maximumInside([ 0, 20 ]), 2)

  events.add(15, 9)
  assert.equal(events.maximumInside([ 0, 20 ]), 9)
})
