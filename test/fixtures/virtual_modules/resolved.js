import { getCollection } from "astro:content"
import styles from "virtual:astro:image-styles.css"
import { readFile } from "node:fs/promises"

console.log(getCollection, styles, readFile)
