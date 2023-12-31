// @ts-check

import { ViewPlugin } from "@codemirror/view";

import { initializeParams } from "./client.js";
import { textDocument } from "./textDocumentSyncClientCapabilities.js";
import {
  cmPositionToLsp,
  getStateIfNeedsRefresh,
  lspRangeToCm,
  mixin,
} from "./utils.js";
import { hoverable } from "./hoverable.js";
import { providable } from "./providable.js";

export class Hover extends hoverable() {}

//
// If there's a failure to mixin the *hoverProviderMixin*, it's helpful to use the following snippet
// in the target scope to inspect the signature produced by Typescript for the 'foo' function.
//
// class A extends providable("textDocument/XXX", (r) => r || null) {}
//
// /**
//  * @typedef B
//  * @type {typeof hoverProviderMixin}
//  */
// /**
//  * @typedef A1
//  * @type {import("./utils").Intersect<A, B>}
//  */
// /**
//  * @typedef A2
//  * @type {import("./utils").Intersect<B, A>}
//  */
// /**
//  * @typedef A3
//  * @type {import("./utils").EqualThen<A1, A2, boolean>}
//  */
// /**
//  *
//  * @param {A1} a1
//  * @param {A2} a2
//  * @param {A3} a3
//  */
// function foo(a1, a2, a3) { }
//
export const hoverProviderMixin = {
  pos: NaN,

  /**
   *
   * @param {import("@codemirror/view").ViewUpdate} update
   * @returns
   */
  params(update) {
    return {
      textDocument: { uri: update.state.field(textDocument).uri },
      position: cmPositionToLsp(this.pos, update.view.state.doc),
    };
  },

  /**
   *
   * @param {import("@codemirror/view").ViewUpdate} update
   * @returns
   */
  needsRefresh(update) {
    const pos = getStateIfNeedsRefresh(update, Hover.state, false);
    if (pos == null) {
      return false;
    }

    this.pos = pos;
    return true;
  },
};

const BaseHoverProvider = mixin(
  providable(
    "textDocument/hover",
    /**
     * @param {import("./providable.js").HoverResponse | undefined} r
     * @returns {{
     *   datum: import("./providable.js").HoverResponse,
     *   pos: number,
     *   from: number,
     *   to: number,
     * }}
     */
    (r) => ({ datum: r || null, pos: NaN, from: NaN, to: NaN }),
  ),
  hoverProviderMixin,
);

export class HoverProvider extends BaseHoverProvider {
  /** @type {InstanceType<BaseHoverProvider>['revise']} */
  revise = (value, { changes, docChanged, state }, draft) => {
    draft.from = draft.to = draft.pos = this.pos;
    if (draft.datum?.range) {
      [draft.from, draft.to] = lspRangeToCm(draft.datum.range, state.doc);
    }
    if (docChanged) {
      draft.pos = changes.mapPos(draft.pos);
      draft.from = changes.mapPos(draft.from, 1);
      draft.to = changes.mapPos(draft.to, -1);
    }
  };
}

export const hover = ViewPlugin.fromClass(Hover, Hover.spec);

export const hoverProvider = ViewPlugin.fromClass(
  HoverProvider,
  HoverProvider.spec,
);

export default function () {
  return [
    hover,
    hoverProvider,
    initializeParams.of({
      capabilities: {
        textDocument: {
          hover: {},
        },
      },
    }),
  ];
}
