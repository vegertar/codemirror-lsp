import { StateField, StateEffect, StateEffectType } from "@codemirror/state";
import { ViewPlugin } from "@codemirror/view";
import { listen } from "vscode-ws-jsonrpc";
import { MessageConnection } from "vscode-languageserver-protocol";
import ReconnectingWebSocket from "reconnecting-websocket";

import serverUri from "./serverUri";
import { getLastValueFromTransaction } from "./utils";

/**
 * @type {StateEffectType<MessageConnection>}
 */
export const ConnectionStateEffect = StateEffect.define();

/**
 * @type {StateField<MessageConnection | null>}
 */
export const connection = StateField.define({
  create() {
    return null;
  },
  update(value, tr) {
    return getLastValueFromTransaction(tr, ConnectionStateEffect) || value;
  },
});

/**
 * The client is defined as a ViewPlugin which holds the network handler
 * independent of editor transactions, as redo/undo operations typically
 * do not affect network connections.
 */
export const client = ViewPlugin.define((view) => {
  const webSocket = new ReconnectingWebSocket(
    view.state.facet(serverUri, false)
  );

  listen({
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

export default [client, connection];
