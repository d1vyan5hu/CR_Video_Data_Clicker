// Evaluates a step's `condition` object against the answers collected so far.
// Supports: "==" (default), "!=", "in", "not in".
// A condition may specify a single `value` (implying "==") or a `values` array
// (for "in" / "not in").
export function evaluateCondition(condition, answers) {
  if (!condition) return true;
  const { step_id, operator = '==' } = condition;
  const actual = answers[step_id];

  switch (operator) {
    case '!=':
      return actual !== condition.value;
    case 'in':
      return Array.isArray(condition.values) && condition.values.includes(actual);
    case 'not in':
      return Array.isArray(condition.values) && !condition.values.includes(actual);
    case '==':
    default:
      return actual === condition.value;
  }
}

// Returns only the steps whose condition passes given the current answers.
// Since conditions only ever reference earlier steps, this can be computed
// incrementally, but recomputing the full filtered list each time is simple
// and fast enough for typical config sizes.
export function activeSteps(steps, answers) {
  return steps.filter((step) => evaluateCondition(step.condition, answers));
}
