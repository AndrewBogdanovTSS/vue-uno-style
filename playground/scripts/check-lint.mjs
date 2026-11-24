/**
 * Confirms the ESLint plugin fires through the package export.
 *
 * `eslint .` passing proves the config loads and the playground is clean - it does
 * not prove the rule still matches anything. A plugin that resolved but whose
 * rule stopped firing would leave that command just as green. So this lints a
 * fixture that is known to violate the rule and fails if the report is missing.
 */
import { strict as assert } from 'node:assert'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const fixture = join(root, 'fixtures', 'multiple-directives.vue')
const ruleId = 'vue-uno-style/no-multiple-v-style'

const [result] = await new ESLint({ cwd: root }).lintFiles([fixture])
const reported = result.messages.filter((message) => message.ruleId === ruleId)

assert.equal(
  reported.length,
  1,
  `expected exactly one ${ruleId} report, got ${reported.length}: `
  + JSON.stringify(result.messages.map((m) => m.ruleId))
)

// The fixture puts `class="card"` between the two directives. The fix rewrites
// the whole span from the first directive to the last, so offering it here
// would delete that attribute - the rule must report without one.
assert.equal(
  reported[0].fix,
  undefined,
  'the rule offered an autofix across an intervening attribute'
)

console.log(`PASS  ${ruleId} fires on the fixture and withholds the unsafe fix`)

// A blocked property is reported with its configured message, even as an object literal key.
const [blocked] = await new ESLint({ cwd: root }).lintFiles([join(root, 'fixtures', 'blocked-property.vue')])
const blockedReports = blocked.messages.filter((message) => message.ruleId === ruleId)

assert.deepEqual(
  blockedReports.map((message) => message.message),
  ['v-uno-style: Property "tracking" is blocked in this project. Use the type scale instead.'],
  `expected one blocked-property report, got: ${JSON.stringify(blocked.messages.map((m) => m.message))}`
)

console.log(`PASS  ${ruleId} reports a blocked property with its message`)
