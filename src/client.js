// @ts-check

import {
  EditorState,
  StateField,
  StateEffect,
  StateEffectType,
  Facet,
} from "@codemirror/state";
import { ViewPlugin } from "@codemirror/view";
import { listen } from "vscode-ws-jsonrpc";
import { Trace } from "vscode-languageserver-protocol";
import ReconnectingWebSocket from "reconnecting-websocket";

import * as packageJson from "../package.json";
import { serverUri } from "./serverUri";
import { getLastValueFromTransaction, mergeAll } from "./utils";

export const { name, version } = packageJson;

/** @type {StateEffectType<import("vscode-languageserver-protocol").MessageConnection>} */
export const ConnectionStateEffect = StateEffect.define();

export const connection = StateField.define({
  /** @returns {import("vscode-languageserver-protocol").MessageConnection | null} value */
  create() {
    return null;
  },
  update(value, tr) {
    return getLastValueFromTransaction(tr, ConnectionStateEffect) || value;
  },
});

/**
 * The socket is defined as a ViewPlugin in which the owned network handler
 * is independent of eiditing transactions, as redo/undo operations typically
 * do not affect network states.
 */
export const socket = ViewPlugin.define((view) => {
  // TODO: reconnect to a new serverUri
  const webSocket = new ReconnectingWebSocket(view.state.facet(serverUri));

  listen({
    // @ts-ignore
    webSocket,
    onConnection: (connection) => {
      view.dispatch({
        effects: ConnectionStateEffect.of(connection),
      });
    },
  });

  return {
    destroy() {
      webSocket.close();
    },
  };
});

/** @type {Facet<Partial<import("vscode-languageserver-protocol").InitializeParams>, Partial<import("vscode-languageserver-protocol").InitializeParams>>} */
export const initializeParams = Facet.define({
  combine: (values) => mergeAll(values),
});

/**
 * Send request with InitializeParams and wait for InitializeResult from server.
 * @param {import("vscode-languageserver-protocol").MessageConnection} connection
 * @param {Partial<import("vscode-languageserver-protocol").InitializeParams>} initializeParams
 * @param {import("vscode-languageserver-protocol").InitializedParams} initializedParams
 * @returns {Promise<import("vscode-languageserver-protocol").InitializeResult>}
 */
export async function performHandshake(
  connection,
  initializeParams,
  initializedParams
) {
  const result = await connection.sendRequest("initialize", initializeParams);
  await connection.sendNotification("initialized", initializedParams);
  return result;
}

/**
 * @type {StateEffectType<import("vscode-languageserver-protocol").InitializeResult>}
 */
export const InitializeResultStateEffect = StateEffect.define();

/**
 * @type {StateField<import("vscode-languageserver-protocol").InitializeResult | null>}
 */
export const initializeResult = StateField.define({
  create() {
    return null;
  },
  /** @param {import("vscode-languageserver-protocol").InitializeResult | null} value */
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
        const params = update.state.facet(initializeParams);
        // TODO: remove the trace to the trace extension
        if (params.trace) {
          connection.trace(Trace.fromString(params.trace), console);
        }
        performHandshake(connection, params, {}).then((result) => {
          update.view.dispatch({
            effects: InitializeResultStateEffect.of(result),
          });
        });
      }
    },
  };
});

/**
 * Retrieve the connection and the result of the handshake.
 * @param {EditorState} state
 * @returns {[import("vscode-languageserver-protocol").MessageConnection, import("vscode-languageserver-protocol").InitializeResult | null] | undefined}
 */
export function getConnectionAndInitializeResult(state) {
  const c = state.field(connection);
  if (c) {
    return [c, state.field(initializeResult)];
  }
}

/** @type {import("vscode-languageserver-protocol").InitializeParams} */
const defaultInitializeParams = {
  processId: null,
  clientInfo: { name, version },
  capabilities: {},
  rootUri: null,
};

export default function (params = defaultInitializeParams) {
  return [
    socket,
    connection,
    initialize,
    initializeResult,
    initializeParams.of(params),
  ];
}
