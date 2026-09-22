/**
 * Confirms the ESLint plugin fires through the package export.
 *
 * `eslint app` passing proves the config loads and the app is clean - it does
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
  + JSON.stringify(result.messages.map((m) => m.ruleId)),
)

// The fixture puts `class="card"` between the two directives. The fix rewrites
// the whole span from the first directive to the last, so offering it here
// would delete that attribute - the rule must report without one.
assert.equal(
  reported[0].fix,
  undefined,
  'the rule offered an autofix across an intervening attribute',
)

console.log(`PASS  ${ruleId} fires on the fixture and withholds the unsafe fix`)
