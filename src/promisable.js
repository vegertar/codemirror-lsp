// @ts-check

import { StateField } from "@codemirror/state";

import { getLastValueFromTransaction } from "./utils";

/**
 * @typedef PromisableField
 * @type {StateField<null | [Promise<void>, () => void, (reason?: any) => void]>}
 */

/**
 * @template U
 * @param {import("@codemirror/state").Facet<Promise<void>, Promise<void | void[]>>} facet
 * @param {import("@codemirror/state").StateEffectType<U>} effect
 * @param {(field: PromisableField) => import("@codemirror/state").Extension} create
 * @returns {import("@codemirror/state").Extension[]}
 */
export function promisable(facet, effect, create) {
  /** @type {PromisableField} */
  const field = StateField.define({
    create() {
      return null;
    },

    // @ts-ignore
    update(value, tr) {
      if (getLastValueFromTransaction(tr, effect) !== undefined) {
        let resolve, reject;

        const promise = new Promise((r0, r1) => {
          resolve = r0;
          reject = r1;
        });

        return [promise, resolve, reject];
      }
      return value;
    },
  });

  return [
    field,
    facet.from(field, (value) => value?.[0] || Promise.resolve()),
    create(field),
  ];
}
