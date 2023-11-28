// @ts-check

import { StateField, StateEffect } from "@codemirror/state";

import { getConnectionAndInitializeResult } from "./client";
import { getLastValueFromTransaction, getValueIfNeedsRefresh } from "./utils";
import { TextDocumentSynchronization } from "./textDocumentSyncClientCapabilities";

const providableCapabilities = /** @type {const} */ ({
  "textDocument/documentLink": "documentLinkProvider",
  "documentLink/resolve": "documentLinkProvider",
  "textDocument/documentSymbol": "documentSymbolProvider",
});

/**
 * @template {keyof typeof providableCapabilities} T
 * @template U
 * @param {T} method
 * @param {((this: import("@codemirror/state").EditorState, response?: ProvidableResponse) => U)} stateCreate
 * @param {((value: U, transaction: import("@codemirror/state").Transaction) => U)} [stateUpdate]
 * @returns
 */
export function providable(method, stateCreate, stateUpdate) {
  /**
   * @typedef LinkRequest
   * @type {import("vscode-languageserver-protocol").DocumentLinkParams}
   */

  /**
   * @typedef LinkResponse
   * @type {import("vscode-languageserver-types").DocumentLink[] | null}
   */

  /**
   * @typedef LinkResolveRequest
   * @type {import("vscode-languageserver-protocol").DocumentLink}
   */

  /**
   * @typedef LinkResolveResponse
   * @type {import("vscode-languageserver-types").DocumentLink}
   */

  /**
   * @typedef SymbolRequest
   * @type {import("vscode-languageserver-protocol").DocumentSymbolParams}
   */

  /**
   * @typedef SymbolResponse
   * @type {import("vscode-languageserver-types").DocumentSymbol[] | import("vscode-languageserver-types").SymbolInformation[] | null}
   */

  /**
   * @typedef ProvidableRequest
   * @type {T extends "textDocument/documentLink" ? LinkRequest :
   * T extends "documentLink/resolve" ? LinkResolveRequest :
   * T extends "textDocument/documentSymbol" ? SymbolRequest : never}
   */

  /**
   * @typedef ProvidableResponse
   * @type {T extends "textDocument/documentLink" ? LinkResponse :
   * T extends "documentLink/resolve" ? LinkResolveResponse :
   * T extends "textDocument/documentSymbol" ? SymbolResponse : never}
   */

  const provider = providableCapabilities[method];
  return class Provider {
    /** @type {import("@codemirror/state").StateEffectType<ProvidableResponse>} */
    static effect = StateEffect.define();

    static state = StateField.define({
      /** @returns {U} */
      create(state) {
        return stateCreate.call(state);
      },
      update(value, tr) {
        if (stateUpdate) {
          return stateUpdate(value, tr);
        }
        const response = getLastValueFromTransaction(tr, Provider.effect);
        return response !== undefined
          ? stateCreate.call(tr.state, response)
          : value;
      },
    });

    /**
     *
     * @param {import("vscode-jsonrpc").MessageConnection} c
     * @param {ProvidableRequest} params
     * @returns {Promise<ProvidableResponse>}
     */
    sendRequest(c, params) {
      return c.sendRequest(method, params);
    }

    /**
     *
     * @param {import("@codemirror/view").ViewUpdate} update
     * @abstract
     * @returns {ProvidableRequest}
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
     * @param {import("vscode-languageserver-protocol").InitializeResult} r
     * @returns {boolean}
     */
    // eslint-disable-next-line no-unused-vars
    isCapable(capability, r) {
      return !!capability;
    }

    /**
     *
     * @param {import("@codemirror/view").ViewUpdate} update
     * @param {ProvidableResponse} result
     */
    dispatch(update, result) {
      update.view.dispatch({
        effects: Provider.effect.of(result),
      });
    }

    /**
     *
     * @param {import("@codemirror/view").ViewUpdate} update
     * @param {import("vscode-jsonrpc").MessageConnection} c
     * @param {import("vscode-languageserver-protocol").InitializeResult} r
     */
    // eslint-disable-next-line no-unused-vars
    refresh(update, c, r) {
      this.sendRequest(c, this.params(update))
        .then((result) => this.dispatch(update, result))
        .catch(console.error);
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
        v[1] &&
        this.isCapable(v[1].capabilities[provider], v[1]) &&
        this.needsRefresh(update)
      ) {
        this.refresh(update, v[0], v[1]);
      }
    }
  };
}
