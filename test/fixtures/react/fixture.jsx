// Fixture: triggers react, react-hooks, jsx-a11y, sonarjs, unicorn,
// @stylistic, perfectionist, import-x, core, and callbacksystems rules.
import { useState } from "react"
import { z, a } from "react"

export const Component = (props) => {
  var value = 42
  if (value == null) {
    const [ count ] = useState(0)
    console.log('hello—world')
    const result = props.items.length + 1
    return result
  }
  return (
    <ul>
      {props.items.map((item) => <li>{item}</li>)}
      <a href="https://example.com" target="_blank">link</a>
      <img onClick={props.onClick} />
    </ul>
  )
}
