// @ts-check

import { StateField, StateEffect } from "@codemirror/state";

import { getLastValueFromTransaction, getValueIfNeedsRefresh } from "./utils";
import { getConnectionAndInitializeResult, initializeResult } from "./client";
import { TextDocumentSynchronization } from "./textDocumentSyncClientCapabilities";

const providableCapabilities = /** @type {const} */ ({
  "textDocument/documentLink": "documentLinkProvider",
  "documentLink/resolve": "documentLinkProvider",
  "textDocument/documentSymbol": "documentSymbolProvider",
});

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
 * @typedef {T extends "textDocument/documentLink" ? LinkRequest :
 * T extends "documentLink/resolve" ? LinkResolveRequest :
 * T extends "textDocument/documentSymbol" ? SymbolRequest : never} ProvidableRequest<T>
 * @template T
 */

/**
 * @typedef {T extends "textDocument/documentLink" ? LinkResponse :
 * T extends "documentLink/resolve" ? LinkResolveResponse :
 * T extends "textDocument/documentSymbol" ? SymbolResponse : never} ProvidableResponse<T>
 * @template T
 */

/**
 * @typedef {((this: import("@codemirror/state").EditorState, response?: ProvidableResponse<T>) => U)} StateCreate<T, U>
 * @template T, U
 */

/**
 * @typedef {((value: U, transaction: import("@codemirror/state").Transaction) => U)} StateUpdate<U>
 * @template U
 */

/**
 * @template {keyof typeof providableCapabilities} T
 * @template U
 * @param {T} method
 * @param {StateCreate<T, U>} stateCreate
 * @param {StateUpdate<U>} [stateUpdate]
 * @returns
 */
export function providable(method, stateCreate, stateUpdate) {
  const provider = providableCapabilities[method];
  return class Provider {
    /** @type {import("@codemirror/state").StateEffectType<ProvidableResponse<T>>} */
    static effect = StateEffect.define();

    /** @type {import("@codemirror/state").StateField<U>} */
    static state = StateField.define({
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

    refreshAfterHandshake = false;
    refreshAfterSynchronization = false;

    /**
     *
     * @param {import("vscode-jsonrpc").MessageConnection} c
     * @param {ProvidableRequest<T>} params
     * @returns {Promise<ProvidableResponse<T>>}
     */
    sendRequest(c, params) {
      return c.sendRequest(method, params);
    }

    /**
     *
     * @param {import("@codemirror/view").ViewUpdate} update
     * @returns {ProvidableRequest<T>}
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
      if (
        this.refreshAfterHandshake &&
        !!getValueIfNeedsRefresh(update, initializeResult)
      ) {
        return true;
      }

      if (
        this.refreshAfterSynchronization &&
        !!getValueIfNeedsRefresh(
          update,
          TextDocumentSynchronization.didVersion,
          false, // Allow the server’s ability to fulfill requests to be independent of TextDocumentSynchronization.
        )
      ) {
        return true;
      }

      return false;
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
     * @param {ProvidableResponse<T>} response
     */
    dispatch(update, response) {
      update.view.dispatch({
        effects: Provider.effect.of(response),
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
