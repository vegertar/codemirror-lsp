import {
  EditorState,
  StateField,
  StateEffect,
  StateEffectType,
} from "@codemirror/state";
import { ViewPlugin } from "@codemirror/view";
import {
  InitializeParams,
  InitializeResult,
  MessageConnection,
  Trace,
} from "vscode-languageserver-protocol";

import * as packageJson from "../package.json";
import { mergePublishDiagnosticsClientCapabilities } from "./publishDiagnosticsClientCapabilities";
import { mergeTrace } from "./trace";
import { mergeTextDocumentSyncClientCapabilities } from "./textDocumentSyncClientCapabilities";
import { getLastValueFromTransaction } from "./utils";
import { ConnectionStateEffect } from "./client";

export const { name, version } = packageJson;

/**
 * Create the params for the initial request.
 * @param {EditorState} state
 * @returns {InitializeParams}
 */
export function createInitializeParams(state) {
  /** @type {InitializeParams} */
  const params = {
    processId: null,
    clientInfo: { name, version },
  };

  mergePublishDiagnosticsClientCapabilities(state, params);
  mergeTextDocumentSyncClientCapabilities(state, params);
  mergeTrace(state, params);

  return params;
}

/**
 * Send request with InitializeParams and wait for InitializeResult from server.
 * @param {MessageConnection} connection
 * @param {InitializeParams} params
 * @returns {Promise<InitializeResult>}
 */
export async function performHandshake(connection, params) {
  const result = await connection.sendRequest("initialize", params);
  await connection.sendNotification("initialized");
  return result;
}

/**
 * @type {StateEffectType<InitializeResult>}
 */
export const InitializeResultStateEffect = StateEffect.define();

/**
 * @type {StateField<InitializeResult | null>}
 */
export const initializeResult = StateField.define({
  create() {
    return null;
  },
  update(value, tr) {
    return (
      getLastValueFromTransaction(tr, InitializeResultStateEffect) || value
    );
  },
});

/**
 * The initialize is defined as a ViewPlugin to perform the LSP handshake
 * whenever it detects a transaction of the new connection.
 */
export const initialize = ViewPlugin.define(() => {
  return {
    update(update) {
      let connection;
      for (const tr of update.transactions) {
        connection = getLastValueFromTransaction(tr, ConnectionStateEffect);
      }

      if (connection) {
        connection.listen();
        const params = createInitializeParams(update.state);
        if (params.trace) {
          connection.trace(Trace.fromString(params.trace), console);
        }
        performHandshake(connection, params).then((result) => {
          update.view.dispatch({
            effects: InitializeResultStateEffect.of(result),
          });
        });
      }
    },
  };
});

export default [initialize, initializeResult];
