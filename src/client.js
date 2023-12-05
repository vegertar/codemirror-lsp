// @ts-check

import { StateField, StateEffect, Facet } from "@codemirror/state";
import { ViewPlugin } from "@codemirror/view";
import { listen } from "vscode-ws-jsonrpc";
import ReconnectingWebSocket from "reconnecting-websocket";

import * as packageJson from "../package.json";
import { serverUri } from "./serverUri";
import { getLastValueFromTransaction, mergeAll } from "./utils";
import { promisable } from "./promisable";

export const { name, version } = packageJson;

/**
 * An effect to notify there is a new connection.
 * @type {import("@codemirror/state").StateEffectType<import("vscode-jsonrpc").MessageConnection>}
 */
export const connectionEffect = StateEffect.define();

export const connection = StateField.define({
  /** @returns {import("vscode-jsonrpc").MessageConnection | null} value */
  create() {
    return null;
  },
  update(value, tr) {
    return getLastValueFromTransaction(tr, connectionEffect) || value;
  },
});

/**
 * The socket is defined as a ViewPlugin in which the owned network handler
 * is independent of editing transactions, as redo/undo operations typically
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
      // TODO: make the socket be destroy free
      webSocket.close();
    },
  };
});

/** @type {Facet<Partial<import("vscode-languageserver-protocol").InitializeParams>, Partial<import("vscode-languageserver-protocol").InitializeParams>>} */
export const initializeParams = Facet.define({
  combine: (values) => mergeAll(values),
});

/**
 * An effect to notify the handshake is finished.
 * @type {import("@codemirror/state").StateEffectType<[import("vscode-jsonrpc").MessageConnection, import("vscode-languageserver-protocol").InitializeResult]>}
 */
export const initializeResultEffect = StateEffect.define();

export const initializeResult = StateField.define({
  /** @returns {import("vscode-languageserver-protocol").InitializeResult | null} value */
  create() {
    return null;
  },
  update(value, tr) {
    const c = tr.state.field(connection);
    for (const effect of tr.effects) {
      // Reset if appeared a new connection
      if (effect.is(connectionEffect)) {
        return null;
      }
      if (effect.is(initializeResultEffect) && c === effect.value[0]) {
        return effect.value[1];
      }
    }

    return value;
  },
});

/**
 * Retrieve the connection and the result of the handshake.
 * @param {import("@codemirror/state").EditorState} state
 * @returns {[import("vscode-jsonrpc").MessageConnection, import("vscode-languageserver-protocol").InitializeResult | null] | undefined}
 */
export function getConnectionAndInitializeResult(state) {
  const c = state.field(connection);
  if (c) {
    return [c, state.field(initializeResult)];
  }
}

/**
 * Send request with InitializeParams and wait for InitializeResult from server.
 * @param {import("vscode-jsonrpc").MessageConnection} connection
 * @param {Partial<import("vscode-languageserver-protocol").InitializeParams>} initializeParams
 * @param {import("vscode-languageserver-protocol").InitializedParams} initializedParams
 * @returns {Promise<import("vscode-languageserver-protocol").InitializeResult>}
 */
export async function performHandshake(
  connection,
  initializeParams,
  initializedParams,
) {
  const result = await connection.sendRequest("initialize", initializeParams);
  await connection.sendNotification("initialized", initializedParams);
  return result;
}

export class BeforeHandshake {
  /** @type {Facet<Promise<void>, Promise<void[]>>} */
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
   * @param {import("@codemirror/view").PluginSpec<V>} [spec]
   * @returns
   */
  static define(create, spec) {
    return promisable(BeforeHandshake.promise, connectionEffect, (field) =>
      ViewPlugin.define(
        (view) =>
          create(
            view,
            (state) => state.field(field)?.[1],
            (state) => state.field(field)?.[2],
          ),
        spec,
      ),
    );
  }

  /**
   *
   * @param {(update: import("@codemirror/view").ViewUpdate, connection: import("vscode-jsonrpc").MessageConnection) => Promise<void | (() => void)>} fn The async routine used to operate the connection before handshake, in which an optional cleanup process is returned.
   */
  static from(fn) {
    return BeforeHandshake.define((_, resolver) => {
      let busy = false;

      /** @type {null | (() => void)} */
      let cleanup = null;

      return {
        update(update) {
          const v = getConnectionAndInitializeResult(update.state);

          if (v && !v[1] && !busy) {
            const resolve = resolver(update.state);
            if (!resolve) {
              throw new Error("Resolve is unavailable");
            }

            if (cleanup) {
              cleanup();
              cleanup = null;
            }

            return fn(update, v[0])
              .then((cleanupFn) => {
                if (cleanupFn) {
                  cleanup = cleanupFn;
                }
              })
              .finally(resolve);
          }
        },

        destroy() {
          cleanup?.();
        },
      };
    });
  }
}

/**
 * The handshake is defined as a ViewPlugin to perform the LSP handshake
 * whenever it detects a new connection.
 */
export const handshake = ViewPlugin.define(() => {
  let busy = false;

  return {
    update({ state, view }) {
      const v = getConnectionAndInitializeResult(state);

      if (v && !v[1] && !busy) {
        busy = true;
        const c = v[0];

        c.listen();
        state.facet(BeforeHandshake.promise).finally(() =>
          performHandshake(c, state.facet(initializeParams), {})
            .then((result) => {
              view.dispatch({
                effects: initializeResultEffect.of([c, result]),
              });
            })
            .catch((err) => {
              console.error("LSP Handshake Failed: ", err);
            })
            .finally(() => {
              busy = false;
            }),
        );
      }
    },
  };
});

export default function () {
  return [
    socket,
    connection,
    handshake,
    initializeResult,
    initializeParams.of({
      processId: null,
      clientInfo: { name, version },
    }),
  ];
}
