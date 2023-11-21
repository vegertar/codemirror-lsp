import merge from "lodash.merge";

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
 * @returns T
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
 * @returns {import("vscode-languageserver-protocol").Position}
 */
export function cmPositionToLspPosition(pos, text) {
  const line = text.lineAt(pos);

  return {
    line: line.number - 1,
    character: pos - line.from,
  };
}
