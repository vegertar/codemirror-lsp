import { Transaction, StateEffectType } from "@codemirror/state";
import merge from "lodash.merge";

/**
 * Get the first available element from within the provided array, otherwise return the default value.
 * @template T
 * @param {readonly T[]} values
 * @param {T} [x]
 * @returns {T}
 */
export function firstAvailable(values, x) {
  if (values) {
    for (const v of values) {
      if (v) {
        return v;
      }
    }
  }
  return x;
}

/**
 * Merge all available values from provided candidates.
 * @template T
 * @param {readonly T[]} values
 * @returns {T}
 */
export function mergeAll(values) {
  /** @type {T} */
  const result = {};
  for (const item of values) {
    merge(result, item);
  }
  return result;
}

/**
 * @template T
 * @param {Transaction} tr
 * @param {StateEffectType<T>} valueStateEffect
 * @returns T
 */
export function getLastValueFromTransaction(tr, valueStateEffect) {
  let value;
  for (const effect of tr.effects) {
    if (effect.is(valueStateEffect)) {
      value = effect.value;
    }
  }
  return value;
}
