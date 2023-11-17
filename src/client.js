import { StateField, EditorState } from "@codemirror/state";
import { listen } from "vscode-ws-jsonrpc";
import ReconnectingWebSocket from "reconnecting-websocket";
import * as packageJson from "../package.json";
import { mergePublishDiagnosticsClientCapabilities } from "./publishDiagnosticsClientCapabilities";
import {
  InitializeResult,
  InitializeParams,
  MessageConnection,
} from "vscode-languageserver-protocol";
import serverUri from "./serverUri";

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

  return params;
}

/**
 * Create a connection to a remote language server, in which the handshake has been finished.
 * @param {EditorState} state
 * @param {InitializeParams} params
 * @param {ReconnectingWebSocket} [webSocket]
 * @returns {{
 *  params: InitializeParams,
 *  webSocket: ReconnectingWebSocket,
 *  ready: boolean,
 *  promise: Promise<{
 *  result: InitializeResult,
 *  connection: MessageConnection,
 * }>}}
 */
export function createConnection(state, params, webSocket) {
  webSocket =
    webSocket || new ReconnectingWebSocket(state.facet(serverUri, false));
  const value = {
    params,
    webSocket,
    ready: false,
    promise: new Promise((resolve) => {
      listen({
        webSocket,
        onConnection: async (connection) => {
          connection.listen();
          const result = await connection.sendRequest("initialize", params);
          await connection.sendNotification("initialized");
          resolve({ result, connection });
          value.ready = true;
        },
      });
    }),
  };
  return value;
}

export const client = StateField.define({
  create(state) {
    const params = createInitializeParams(state);
    return createConnection(state, params);
  },
  update(value, tr) {
    return value.ready && value.webSocket.readyState == value.webSocket.CLOSED
      ? createConnection(tr.state, value.params, value.webSocket)
      : value;
  },
});

export default client;
