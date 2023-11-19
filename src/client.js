// @ts-check

import {
  StateField,
  StateEffect,
  StateEffectType,
  Facet,
} from "@codemirror/state";
import { ViewPlugin } from "@codemirror/view";
import { listen } from "vscode-ws-jsonrpc";
import ReconnectingWebSocket from "reconnecting-websocket";
import { Trace } from "vscode-languageserver-protocol";

import * as packageJson from "../package.json";
import serverUri from "./serverUri";
import { getLastValueFromTransaction, mergeAvailables } from "./utils";

export const { name, version } = packageJson;

/**
 * @type {StateEffectType<import("vscode-languageserver-protocol").MessageConnection>}
 */
export const ConnectionStateEffect = StateEffect.define();

/**
 * @type {StateField<import("vscode-languageserver-protocol").MessageConnection | null>}
 */
export const connection = StateField.define({
  create() {
    return null;
  },
  /** @param {import("vscode-languageserver-protocol").MessageConnection | null} value */
  update(value, tr) {
    return getLastValueFromTransaction(tr, ConnectionStateEffect) || value;
  },
});

/**
 * The socket is defined as a ViewPlugin which holds the network handler
 * independent of editor transactions, as redo/undo operations typically
 * do not affect network connections.
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

/** @type {import("vscode-languageserver-protocol").InitializeParams['clientInfo']} */
const defaultClientInfo = { name, version };

/**
 * @type {Facet<Partial<import("vscode-languageserver-protocol").InitializeParams>, Partial<import("vscode-languageserver-protocol").InitializeParams>>}
 */
export const initializeParams = Facet.define({
  combine: (values) => mergeAvailables(values),
});

/**
 * Send request with InitializeParams and wait for InitializeResult from server.
 * @param {import("vscode-languageserver-protocol").MessageConnection} connection
 * @param {Partial<import("vscode-languageserver-protocol").InitializeParams>} params
 * @returns {Promise<import("vscode-languageserver-protocol").InitializeResult>}
 */
export async function performHandshake(connection, params) {
  const result = await connection.sendRequest("initialize", params);
  await connection.sendNotification("initialized");
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
        performHandshake(connection, params).then((result) => {
          update.view.dispatch({
            effects: InitializeResultStateEffect.of(result),
          });
        });
      }
    },
  };
});

export default function (clientInfo = defaultClientInfo) {
  return [
    socket,
    connection,
    initialize,
    initializeResult,
    initializeParams.of({ clientInfo }),
  ];
}
