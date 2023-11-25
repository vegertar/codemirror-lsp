import merge from "lodash.merge";

/**
 * @template T
 * @overload
 * @param {readonly T[]} values
 * @returns {T | undefined}
 */

/**
 * @template T
 * @overload
 * @param {readonly T[]} values
 * @param {T} defaultValue
 * @returns {T}
 */

/**
 * Get the first available element from within the provided array or the default value.
 * @template T
 * @param {readonly T[]} values
 * @param {T} [defaultValue]
 * @returns {T | undefined}
 */
export function firstAvailable(values, defaultValue) {
  if (values) {
    for (const v of values) {
      if (v) {
        return v;
      }
    }
  }
  return defaultValue;
}

/**
 * Merge all available values from provided candidates.
 * @template {object} T
 * @param {readonly T[]} values
 * @returns {T}
 */
export function mergeAll(values) {
  const result = {};
  for (const item of values) {
    merge(result, item);
  }
  // @ts-ignore
  return result;
}

/**
 * Retrieve the last value corresponding the given StateEffect.
 * @template T
 * @param {import("@codemirror/state").Transaction} tr
 * @param {import("@codemirror/state").StateEffectType<T>} valueEffect
 * @returns {T | undefined}
 */
export function getLastValueFromTransaction(tr, valueEffect) {
  let value;
  for (const effect of tr.effects) {
    if (effect.is(valueEffect)) {
      value = effect.value;
    }
  }
  return value;
}

/**
 * Convert given text position from CodeMirror to the LSP Position.
 * @param {number} pos
 * @param {import("@codemirror/state").Text} text
 * @returns {import("vscode-languageserver-types").Position}
 */
export function cmPositionToLspPosition(pos, text) {
  const line = text.lineAt(pos);

  return {
    line: line.number - 1,
    character: pos - line.from,
  };
}

/**
 * Convert given text position from LSP to the CodeMirror Position.
 * @param {import("vscode-languageserver-types").Position} pos
 * @param {import("@codemirror/state").Text} text
 * @returns {number}
 */
export function lspPositionToCmPosition(pos, text) {
  const line = text.line(pos.line + 1);
  return line.from + pos.character;
}

/**
 * Convert the diagnostic severity from LSP to CodeMirror.
 * @param {import("vscode-languageserver-types").DiagnosticSeverity | undefined} severity
 * @returns {import("@codemirror/lint").Diagnostic['severity']}
 */
export function lspSeverityToCmServerity(severity) {
  switch (severity) {
    case 1:
      return "error";
    case 2:
      return "warning";
    case 3:
      return "info";
    default:
      return "hint";
  }
}

/**
 * Examine if a refresh is needed by comparing the provided state field's old and new values.
 * The new value is returned if true.
 * @template T
 * @param {{state: import("@codemirror/state").EditorState, startState: import("@codemirror/state").EditorState}} param0
 * @param {import("@codemirror/state").StateField<T extends undefined ? never : T>} field
 * @returns {T | undefined}
 */
export function getValueIfNeedsRefresh({ state, startState }, field) {
  const oldValue = startState.field(field);
  const newValue = state.field(field);
  return oldValue !== newValue ? newValue : undefined;
}
