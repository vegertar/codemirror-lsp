// @ts-check

import { StateField, StateEffect } from "@codemirror/state";

import { getConnectionAndInitializeResult } from "./client";
import { getLastValueFromTransaction, getValueIfNeedsRefresh } from "./utils";
import { TextDocumentSynchronization } from "./textDocumentSyncClientCapabilities";

const providableCapabilities = /** @type {const} */ ({
  "textDocument/documentLink": "documentLinkProvider",
  "textDocument/documentSymbol": "documentSymbolProvider",
});

/**
 * @template {keyof typeof providableCapabilities} T
 * @param {T} method
 * @returns
 */
export function providable(method) {
  /**
   * @typedef LinkRequest
   * @type {import("vscode-languageserver-protocol").DocumentLinkParams}
   */

  /**
   * @typedef LinkResponse
   * @type {import("vscode-languageserver-types").DocumentLink[]}
   */

  /**
   * @typedef SymbolRequest
   * @type {import("vscode-languageserver-protocol").DocumentSymbolParams}
   */

  /**
   * @typedef SymbolResponse
   * @type {import("vscode-languageserver-types").DocumentSymbol[] | import("vscode-languageserver-types").SymbolInformation[]}
   */

  /**
   * @typedef Request
   * @type {T extends "textDocument/documentLink" ? LinkRequest :
   * T extends "textDocument/documentSymbol" ? SymbolRequest : never}
   */

  /**
   * @typedef Response
   * @type {T extends "textDocument/documentLink" ? LinkResponse :
   * T extends "textDocument/documentSymbol" ? SymbolResponse : never}
   */

  const provider = providableCapabilities[method];
  return class Provider {
    /** @type {import("@codemirror/state").StateEffectType<Response | null>} */
    static effect = StateEffect.define();

    static state = StateField.define({
      /** @returns {Response | null} */
      create() {
        return null;
      },
      update(value, tr) {
        return getLastValueFromTransaction(tr, Provider.effect) || value;
      },
    });

    /**
     *
     * @param {import("vscode-jsonrpc").MessageConnection} c
     * @param {Request} params
     * @returns {Promise<Response | null>}
     */
    async request(c, params) {
      return await c.sendRequest(method, params);
    }

    /**
     *
     * @param {import("@codemirror/view").ViewUpdate} update
     * @abstract
     * @returns {Request}
     */
    params(update) {
      void update;
      throw new Error("Must be implemented by subclass!");
    }

    /**
     *
     * @param {import("@codemirror/view").ViewUpdate} update
     * @returns {boolean}
     */
    needsRefresh(update) {
      return !!getValueIfNeedsRefresh(
        update,
        TextDocumentSynchronization.didVersion,
      );
    }

    /**
     *
     * @param {import("vscode-languageserver-protocol").ServerCapabilities[typeof provider] | undefined} capability
     * @returns {boolean}
     */
    isCapable(capability) {
      return !!capability;
    }

    /**
     *
     * @param {import("@codemirror/view").ViewUpdate} update
     * @param {Response | null} result
     */
    dispatch(update, result) {
      update.view.dispatch({
        effects: Provider.effect.of(result),
      });
    }

    /**
     * Implementation of the ViewPlugin update.
     * @param {import("@codemirror/view").ViewUpdate} update
     * @returns {void}
     */
    update(update) {
      const v = getConnectionAndInitializeResult(update.state);

      if (
        v &&
        this.isCapable(v[1]?.capabilities[provider]) &&
        this.needsRefresh(update)
      ) {
        this.request(v[0], this.params(update))
          .then((result) => this.dispatch(update, result))
          .catch(console.error);
      }
    }
  };
}
