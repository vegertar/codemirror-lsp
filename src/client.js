// @ts-check

import { StateField, StateEffect, Facet } from "@codemirror/state";
import { ViewPlugin } from "@codemirror/view";
import {
  toSocket,
  ConsoleLogger,
  createWebSocketConnection,
} from "vscode-ws-jsonrpc";

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

class ConnectionFactory {
  /** @type {WeakMap<import("vscode-jsonrpc").MessageConnection, ConnectionFactory>} */
  static recycled = new WeakMap();

  /** @type {WebSocket | null} */
  handler = null;
  /** @type {import("vscode-jsonrpc").MessageConnection | null} */
  connection = null;
  /** @type {ConnectionFactory | null} */
  delegated = null;
  destroyId = NaN;
  destroyed = false;

  /**
   *
   * @param {import("@codemirror/view").EditorView} view
   */
  constructor(view) {
    this.view = view;
    this.recycle() || this.open();
  }

  /**
   *
   * @param {string} uri
   */
  createWebSocket(uri) {
    const view = this.view;
    const handler = (this.handler = new WebSocket(uri));

    handler.addEventListener("open", () => {
      const c = createWebSocketConnection(
        toSocket(handler),
        new ConsoleLogger(),
      );
      this.connection = c;
      view.dispatch({ effects: connectionEffect.of(c) });
    });
    handler.addEventListener("close", () => {
      // The close event should be dispatched only once during the entire lifetime of a socket.
      // Hence simply create a new one if closed non-manually.
      if (!this.destroyed) {
        requestIdleCallback(this.open);
      }
    });
  }

  open = () => {
    const uri = this.view.state.facet(serverUri);
    const url = new URL(uri);
    switch (url.protocol) {
      case "ws:":
      case "wss:":
        this.createWebSocket(uri);
        break;
      default:
        throw new Error(`Unsupported URI: ${uri}`);
    }
  };

  close() {
    this.destroyed = true;
    this.handler?.close();
  }

  recycle() {
    const c = this.view.state.field(connection);
    if (!c) {
      return false;
    }

    const recycled = ConnectionFactory.recycled.get(c);
    if (!recycled) {
      return false;
    }

    this.delegated = recycled;
    cancelIdleCallback(this.delegated.destroyId);
    return true;
  }

  /**
   * Implementation of the ViewPlugin update.
   * @param {import("@codemirror/view").ViewUpdate} update
   * @returns {void}
   */
  update(update) {
    /**
     * Consider the following scenario:
     * - Create an EditorView with the root EditorState, denoted as A(0).
     * - A(0) dispatches a new connection.
     * - The current EditorState is A(1).
     * - Perform various transactions, leading to the current EditorState A(n).
     * - Call EditorView.setState with an older EditorState; let's say A(k) where 0 < k < n:
     *   - Destroy all ViewPlugins at A(n).
     *   - Initialize all ViewPlugins at A(k).
     * - The current EditorState is now A(k), and the socket ViewPlugin recycles the one destroyed at A(n).
     * - Disconnect the connection.
     * - The socket ViewPlugin reconnects and dispatches the new connection to the current EditorState A(k).
     * - Call EditorView.setState with A(n):
     *   - Destroy all ViewPlugins at A(k).
     *   - Initialize all ViewPlugins at A(n).
     * - The current EditorState is A(n), where:
     *   - The connection StateField is not null but has been closed.
     *   - The value associated with the connection in ConnectionFactory.recycled is present.
     * - A(n) recycles the socket ViewPlugin destroyed early by itself.
     * - A(n) remains disconnected until the connection held by A(k) is lost.
     */
    if (!this.consistent(update)) {
      console.error("Inconsistent connection");
    }
  }

  /**
   *
   * @param {{state: import("@codemirror/state").EditorState}} param0
   */
  consistent({ state }) {
    const c = this.delegated?.connection || this.connection;
    return c === state.field(connection);
  }

  /**
   * Implementation of the ViewPlugin destroy.
   * @returns {void}
   */
  destroy() {
    if (this.delegated) {
      return this.delegated.destroy();
    }

    if (!this.handler) {
      return;
    }

    const c = this.connection;
    if (!c) {
      return this.close();
    }

    // Place the destroy procedure in the idle callback to allow for the reuse of the present
    // connection in operations like "reload," where creation immediately follows destruction.
    this.destroyId = requestIdleCallback(() => {
      ConnectionFactory.recycled.delete(c);
      this.close();
    });
    ConnectionFactory.recycled.set(c, this);
  }
}

export const socket = ViewPlugin.fromClass(ConnectionFactory);

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
