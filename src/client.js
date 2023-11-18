import { EditorState } from "@codemirror/state";
import { ViewPlugin } from "@codemirror/view";
import { listen } from "vscode-ws-jsonrpc";
import {
  InitializeParams,
  InitializeResult,
  MessageConnection,
  Trace,
} from "vscode-languageserver-protocol";
import ReconnectingWebSocket from "reconnecting-websocket";

import * as packageJson from "../package.json";
import { mergePublishDiagnosticsClientCapabilities } from "./publishDiagnosticsClientCapabilities";
import serverUri from "./serverUri";
import { mergeTrace } from "./trace";

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
  mergeTrace(state, params);

  return params;
}

/**
 * @param {MessageConnection} connection
 * @param {InitializeParams} params
 * @returns {Promise<InitializeResult>}
 */
export async function performHandshake(connection, params) {
  const result = await connection.sendRequest("initialize", params);
  await connection.sendNotification("initialized");
  return result;
}

export const client = ViewPlugin.define((view) => {
  const params = createInitializeParams(view.state);
  const webSocket = new ReconnectingWebSocket(
    view.state.facet(serverUri, false)
  );

  /**
   * @callback Resolve
   * @param {MessageConnection | null} c
   * @returns {void}
   */
  /** @type {Resolve} */
  let resolve;

  /** @type {Promise<MessageConnection | null>} */
  let promise;

  const reset = () => (promise = new Promise((r) => (resolve = r)));
  const onClose = (ev) => {
    console.debug("The websocket is closed:", ev.reason);
    console.debug("Reset the promise of the connection");
    reset();
  };
  webSocket.addEventListener("close", onClose);

  reset();
  listen({
    webSocket,
    onConnection: async (connection) => {
      if (params.trace) {
        connection.trace(Trace.fromString(params.trace), console);
      }
      connection.listen();
      await performHandshake(connection, params);
      resolve(connection);
    },
  });

  return {
    destroy() {
      webSocket.removeEventListener("close", onClose);
      webSocket.close();
      resolve(null);
    },
  };
});

export default client;
