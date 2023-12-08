// @ts-check

import { StateField, StateEffect } from "@codemirror/state";

import { getLastValueFromTransaction, getValueIfNeedsRefresh } from "./utils";
import { getConnectionAndInitializeResult, initializeResult } from "./client";
import { TextDocumentSynchronization } from "./textDocumentSyncClientCapabilities";

/**
 * Provides capabilities mapping for the client request *method* to the server capability *property*.
 * Every change to the map should be accompanied by the mutation of relative Request and Response
 * definitions below.
 */
const providableCapabilities = /** @type {const} */ ({
  "textDocument/documentLink": "documentLinkProvider",
  "documentLink/resolve": "documentLinkProvider",
  "textDocument/documentSymbol": "documentSymbolProvider",
  "textDocument/hover": "hoverProvider",
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
 * @typedef HoverRequest
 * @type {import("vscode-languageserver-protocol").HoverParams}
 */

/**
 * @typedef HoverResponse
 * @type {import("vscode-languageserver-types").Hover | null}
 */

/**
 * @typedef {T extends "textDocument/documentLink" ? LinkRequest :
 * T extends "documentLink/resolve" ? LinkResolveRequest :
 * T extends "textDocument/documentSymbol" ? SymbolRequest :
 * T extends "textDocument/hover" ? HoverRequest : never} ProvidableRequest<T>
 * @template T
 */

/**
 * @typedef {T extends "textDocument/documentLink" ? LinkResponse :
 * T extends "documentLink/resolve" ? LinkResolveResponse :
 * T extends "textDocument/documentSymbol" ? SymbolResponse :
 * T extends "textDocument/hover" ? HoverResponse : never} ProvidableResponse<T>
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
  return class Providing {
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
        const response = getLastValueFromTransaction(tr, Providing.effect);
        return response !== undefined
          ? stateCreate.call(tr.state, response)
          : value;
      },
    });

    /** @type {import("@codemirror/view").PluginSpec<Providing>} */
    static spec = {
      provide: () => [Providing.state],
    };

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
     * @param {{state: import("@codemirror/state").EditorState}} param0
     * @returns {ProvidableRequest<T>}
     */
    params({ state }) {
      void state;
      throw new Error("Must be implemented by subclass!");
    }

    /**
     *
     * @param {{
     *   state: import("@codemirror/state").EditorState,
     *   startState: import("@codemirror/state").EditorState,
     * }} update
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
     * @param {import("vscode-languageserver-protocol").InitializeResult} r
     * @param {typeof provider} provider
     * @returns {boolean}
     */
    // eslint-disable-next-line no-unused-vars
    isCapable(r, provider) {
      return !!r.capabilities[provider];
    }

    /**
     *
     * @param {{view: import("@codemirror/view").EditorView}} param0
     * @param {ProvidableResponse<T>} response
     */
    dispatch({ view }, response) {
      view.dispatch({
        effects: Providing.effect.of(response),
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
        v?.[1] &&
        this.isCapable(v[1], provider) &&
        this.needsRefresh(update)
      ) {
        this.refresh(update, v[0], v[1]);
      }
    }
  };
}
