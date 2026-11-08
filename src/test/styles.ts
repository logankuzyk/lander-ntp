import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** The page's stylesheet, for the tests that guard the rules a browser was measured to need. */
export const css = readFileSync(join(process.cwd(), 'src/entrypoints/newtab/style.css'), 'utf8')

/** The text of the rule that opens with this selector, from the selector to its closing brace. */
export function rule(selector: string): string {
  const start = css.indexOf(`\n${selector} {`)
  if (start === -1) throw new Error(`no rule for ${selector}`)
  return css.slice(start, css.indexOf('}', start))
}

/** A number the rule gives a property (a custom property too). */
export function number(selector: string, property: string): number {
  const match = new RegExp(`${property}:\\s*([\\d.]+)`).exec(rule(selector))
  if (!match) throw new Error(`${selector} gives no ${property}`)
  return Number(match[1])
}
