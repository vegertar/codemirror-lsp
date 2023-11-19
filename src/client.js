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
import ReconnectingWebSocket from "reconnecting-websocket";

import * as packageJson from "../package.json";
import { serverUri } from "./serverUri";
import { getLastValueFromTransaction, mergeAll } from "./utils";

export const { name, version } = packageJson;

/** @type {StateEffectType<import("vscode-languageserver-protocol").MessageConnection>} */
export const connectionEffect = StateEffect.define();

export const connection = StateField.define({
  /** @returns {import("vscode-languageserver-protocol").MessageConnection | null} value */
  create() {
    return null;
  },
  update(value, tr) {
    return getLastValueFromTransaction(tr, connectionEffect) || value;
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
        effects: connectionEffect.of(connection),
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

/** @type {StateEffectType<import("vscode-languageserver-protocol").InitializeResult>} */
export const initializeResultEffect = StateEffect.define();

export const initializeResult = StateField.define({
  /** @returns {import("vscode-languageserver-protocol").InitializeResult | null} value */
  create() {
    return null;
  },
  update(value, tr) {
    // Reset if appeared a new connection
    if (getLastValueFromTransaction(tr, connectionEffect)) {
      return null;
    }
    return getLastValueFromTransaction(tr, initializeResultEffect) || value;
  },
});

export const afterConnectedEffect = StateEffect.define();

export const afterConnected = EditorState.transactionExtender.of((tr) => {
  return getLastValueFromTransaction(tr, connectionEffect)
    ? {
        effects: afterConnectedEffect.of(null),
      }
    : null;
});

/** @type {Facet<Promise, Promise>} */
export const beforeHandshake = Facet.define({
  combine: (values) => Promise.all(values),
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
 * The initialize is defined as a ViewPlugin to perform the LSP handshake
 * whenever it detects a transaction of the new connection.
 */
export const initialize = ViewPlugin.define(() => {
  let busy = false;

  return {
    update(update) {
      const v = getConnectionAndInitializeResult(update.state);

      if (v && !v[1] && !busy) {
        busy = true;

        v[0].listen();
        update.state.facet(beforeHandshake).finally(() =>
          performHandshake(v[0], update.state.facet(initializeParams), {})
            .then((result) => {
              update.view.dispatch({
                effects: initializeResultEffect.of(result),
              });
            })
            .catch((err) => {
              console.error("LSP Handshake Failed: ", err);
            })
            .finally(() => {
              busy = false;
            })
        );
      }
    },
  };
});

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
    afterConnected,
    initialize,
    initializeResult,
    initializeParams.of(params),
  ];
}
