// @ts-check

import { ViewPlugin } from "@codemirror/view";

import { initializeParams } from "./client";
import { textDocument } from "./textDocumentSyncClientCapabilities";
import {
  cmPositionToLsp,
  getValueIfNeedsRefresh,
  logMissingField,
  mixin,
} from "./utils";
import { hoverable } from "./hoverable";
import { providable } from "./providable";

export class Hover extends hoverable() {
  /**
   *
   * @param {import("@codemirror/state").EditorState} state
   * @param {string} [hint]
   */
  static value(state, hint) {
    const pos = state.field(Hover.state, false);
    if (pos === undefined) {
      logMissingField("Hover.state", hint);
    } else if (isNaN(pos)) {
      return null;
    }
    return pos;
  }
}

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
    const pos = getValueIfNeedsRefresh(update, Hover.state, false);
    if (pos === undefined || isNaN(pos)) {
      return false;
    }

    this.pos = pos;
    return true;
  },

  /**
   * Relate the current hover position to the response.
   * @param {any} response
   * @returns {any} The modified response with the hover position tied.
   */
  touch(response) {
    if (response) {
      response.pos = this.pos;
    }
    return response;
  },
};

export class HoverProvider extends mixin(
  providable("textDocument/hover", (r) => r || null),
  hoverProviderMixin,
) {}

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
