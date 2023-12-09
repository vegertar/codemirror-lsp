// @ts-check

import { StateField } from "@codemirror/state";

import { getLastValueFromTransaction } from "./utils";

/**
 * @typedef {(value: T) => void} Resolve<T>
 * @template T
 */

/**
 * @typedef {(reason?: T) => void} Reject<T>
 * @template T
 */

/**
 * @typedef {[Promise<T>, Resolve<T>, Reject<any>]} PromisingState
 * @template T
 */

/**
 * @template T, U
 * @param {import("@codemirror/state").Facet<Promise<T>, Promise<T[]>>} facet
 * @param {import("@codemirror/state").StateEffectType<U>} effect
 */
export function promisable(facet, effect) {
  return class Promising {
    /** @type {StateField<PromisingState<T>>} */
    static state = StateField.define({
      create() {
        /** @type {Resolve<T>} */
        let resolve;
        /** @type {Reject<any>} */
        let reject;

        /** @type {Promise<T>} */
        const promise = new Promise((r0, r1) => {
          resolve = r0;
          reject = r1;
        });

        return [
          promise,
          // @ts-ignore
          resolve,
          // @ts-ignore
          reject,
        ];
      },
      update(value, tr) {
        if (getLastValueFromTransaction(tr, effect) !== undefined) {
          value[2](new Error("Legacy Error"));
          value = this.create(tr.state);
        }
        return value;
      },

      provide: (f) => facet.from(f, (value) => value[0]),
    });

    /**
     *
     * @param {import("@codemirror/state").EditorState} state
     */
    static resolver(state) {
      return state.field(Promising.state)[1];
    }

    /**
     *
     * @param {import("@codemirror/state").EditorState} state
     */
    static rejector(state) {
      return state.field(Promising.state)[2];
    }
  };
}
