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

test("includes all events at the start boundary and excludes all at the end", () => {
  const events = new RangedEvents()
  events.add(10, 9)
  events.add(10, 2)
  events.add(20, 12)
  events.add(20, 3)

  const cases = [
    [ [ 0, 10 ], false, -1 ],
    [ [ 10, 10 ], false, -1 ],
    [ [ 10, 20 ], true, 9 ],
    [ [ 11, 20 ], false, -1 ],
    [ [ 20, 21 ], true, 12 ],
    [ [ 21, 30 ], false, -1 ]
  ]
  cases.forEach(([ range, isInside, maximum ]) => {
    assert.equal(events.hasInside(range), isInside)
    assert.equal(events.maximumInside(range), maximum)
  })
})
