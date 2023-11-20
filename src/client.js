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
import { promisable } from "./promisable";

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

export class BeforeHandshake {
  /** @type {Facet<Promise, Promise>} */
  static promise = Facet.define({
    combine: (values) => Promise.all(values),
  });

  /**
   * @typedef ResolverRejector
   * @type {(state: import("@codemirror/state").EditorState) => ((value?: any) => void) | undefined}
   */

  /**
   * @template {import("@codemirror/view").PluginValue} V
   * @param {(view: import("@codemirror/view").EditorView, resolver: ResolverRejector, rejector: ResolverRejector) => V} create
   * @param {import("@codemirror/view").PluginSpec} [spec]
   * @returns
   */
  static define(create, spec) {
    return promisable(BeforeHandshake.promise, connectionEffect, (field) =>
      ViewPlugin.define(
        (view) =>
          create(
            view,
            (state) => state.field(field)?.[1],
            (state) => state.field(field)?.[2]
          ),
        spec
      )
    );
  }

  /**
   *
   * @param {(update: import("@codemirror/view").ViewUpdate, connection: import("vscode-languageserver-protocol").MessageConnection) => Promise<void>} fn
   */
  static fromUpdate(fn) {
    return BeforeHandshake.define((_, resolver) => {
      let busy = false;

      return {
        update(update) {
          const v = getConnectionAndInitializeResult(update.state);

          if (v && !v[1] && !busy) {
            const resolve = resolver(update.state);
            if (!resolve) {
              throw new Error("Resolve is unavailable");
            }

            return fn(update, v[0]).finally(resolve);
          }
        },
      };
    });
  }
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
        update.state.facet(BeforeHandshake.promise).finally(() =>
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
    initialize,
    initializeResult,
    initializeParams.of(params),
  ];
}
