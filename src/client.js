import { StateField, EditorState } from "@codemirror/state";
import { listen } from "vscode-ws-jsonrpc";
import * as packageJson from "../package.json";
import { mergePublishDiagnosticsClientCapabilities } from "./publishDiagnosticsClientCapabilities";
import serverUri from "./serverUri";

export const { name, version } = packageJson;

export function createInitializeParams(state) {
  const params = {
    processId: null,
    clientInfo: { name, version },
  };
  mergePublishDiagnosticsClientCapabilities(state, params);

  return params;
}

/**
 *
 * @param {EditorState} state
 * @param {InitializeParams} params
 * @returns Promise<InitializeResult & {connection: MessageConnection}>
 */
export function createConnection(state, params) {
  const uri = state.facet(serverUri, false);
  const webSocket = new WebSocket(uri);
  return new Promise((onConnection) => {
    listen({ webSocket, onConnection });
  }).then(async (connection) => {
    connection.listen();
    const response = await connection.sendRequest("initialize", params);
    await connection.sendNotification("initialized");
    return { ...response, connection };
  });
}

export const client = StateField.define({
  create(state) {
    const params = createInitializeParams(state);
    return createConnection(state, params);
  },
  update(value) {
    return value;
  },
});

export default client;
