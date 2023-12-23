// @ts-check

import { StateField, StateEffect } from "@codemirror/state";
import { ViewPlugin } from "@codemirror/view";
import { produce } from "immer";

import {
  getConnectionAndInitializeResult,
  initializeParams,
  initializeResult,
} from "./client";
import {
  cmPositionToLsp,
  getLastValueFromTransaction,
  getStateIfNeedsRefresh,
  getStatePairs,
} from "./utils";

/**
 * @typedef {Omit<import("vscode-languageserver-types").TextDocumentItem, "text">} TextDocument
 */

/**
 * @typedef {Omit<import("vscode-languageserver-protocol").DidChangeTextDocumentParams, "textDocument"> & {
 * "textDocument": TextDocument}} DidChangeTextDocumentParams
 */
/** @type {import("@codemirror/state").StateEffectType<TextDocument['uri']>} */
export const textDocumentUriEffect = StateEffect.define();

/** @type {import("@codemirror/state").StateEffectType<TextDocument['languageId']>} */
export const textDocumentLanguageIdEffect = StateEffect.define();

/**
 * The textDocument extension carries the fields mentioned by LSP TextDocumentItem
 * except the text content, which must be owned by the hosted EditState.
 * @type {import("@codemirror/state").StateField<TextDocument>}
 */
export const textDocument = StateField.define({
  create() {
    return {
      uri: "untitled:Untitled",
      languageId: "plaintext",
      version: 1,
    };
  },
  update(value, tr) {
    return produce(value, (draft) => {
      if (tr.docChanged) {
        draft.version++;
      }
      for (const effect of tr.effects) {
        if (effect.is(textDocumentUriEffect)) {
          draft.uri = effect.value;
        } else if (effect.is(textDocumentLanguageIdEffect)) {
          draft.languageId = effect.value;
        }
      }
    });
  },
});

export class TextDocumentSynchronization {
  /**
   * An effect to notify that the text document has had synchronizations up to the given version number.
   * Specially, 0 means not synced at all or did close.
   * @type {import("@codemirror/state").StateEffectType<number>}
   */
  static versionEffect = StateEffect.define();

  /**
   * @typedef TextDocumentSynchronizationState
   * @type {0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}
   */

  /**
   * The default state. This state is set both by default and after the RPC "textDocument/didClose" succeeds in the `CLOSING` state.
   * It can also transition from the `HALTED` state if the document URI is available.
   * @type {TextDocumentSynchronizationState}
   */
  static CLOSED = 0;

  /**
   * If the document URI is available, the `CLOSED` state transitions to the `OPENING` state.
   * @type {TextDocumentSynchronizationState}
   */
  static OPENING = 1;

  /**
   * The `OPEN` state is set after the RPC "textDocument/didOpen" succeeds in the `OPENING` state
   * or "textDocument/didChange" succeeds in the `CHANGING` state.
   * @type {TextDocumentSynchronizationState}
   */
  static OPEN = 2;

  /**
   * The `CHANGING` state is transitioned if there are pending changes in the `OPEN` state.
   * @type {TextDocumentSynchronizationState}
   */
  static CHANGING = 3;

  /**
   * The `CLOSING` state is transitioned if the document URI is empty in the `OPEN` state, this is the proper way to close the file.
   * @type {TextDocumentSynchronizationState}
   */
  static CLOSING = 4;

  /**
   * The `HALTED` state is set if any errors occur. It can also transition from the `CLOSED` state if the document URI is unavailable.
   * @type {TextDocumentSynchronizationState}
   */
  static HALTED = 5;

  /**
   * The `REOPENING` state is transitioned if the language ID changes in the `OPEN` state.
   * @type {TextDocumentSynchronizationState}
   */
  static REOPENING = 6;

  /**
   * The `SWITCHING` state is transitioned if the document URI changes in the `OPEN` state, the underlying file would switch to the new one and retain the old file open.
   * @type {TextDocumentSynchronizationState}
   */
  static SWITCHING = 7;

  /** @type {import("@codemirror/state").StateEffectType<TextDocumentSynchronizationState>} */
  static stateEffect = StateEffect.define();

  /** @type {import("@codemirror/state").StateEffectType<TextDocument | null>} */
  static textDocumentEffect = StateEffect.define();

  /** @type {import("@codemirror/state").StateEffectType<DidChangeTextDocumentParams[]>} */
  static changesEffect = StateEffect.define();

  /**
   * The state field of the version number that the text document has had synchronizations up to.
   * Specially, 0 means not synced at all or did close.
   */
  static version = StateField.define({
    create() {
      return 0;
    },
    update(value, tr) {
      if (getStateIfNeedsRefresh(tr, initializeResult) !== undefined) {
        // The connection has reset
        return 0;
      }

      const v = getLastValueFromTransaction(
        tr,
        TextDocumentSynchronization.versionEffect,
      );
      if (v !== undefined) {
        return v;
      }

      return value;
    },
  });

  static textDocument = StateField.define({
    /** @return {TextDocument | null} */
    create() {
      return null;
    },
    update(value, tr) {
      if (getStateIfNeedsRefresh(tr, initializeResult) !== undefined) {
        // The connection has reset
        return null;
      }

      const v = getLastValueFromTransaction(
        tr,
        TextDocumentSynchronization.textDocumentEffect,
      );
      if (v !== undefined) {
        return v;
      }

      return value;
    },
  });

  static option = StateField.define({
    /** @returns {import("vscode-languageserver-protocol").TextDocumentSyncOptions} */
    create() {
      return {};
    },
    update(value, tr) {
      const r = getStateIfNeedsRefresh(tr, initializeResult);
      if (r === undefined) {
        // No changes
        return value;
      }
      if (r === null) {
        // The connection has reset
        return {};
      }

      /** @type {import("vscode-languageserver-protocol").TextDocumentSyncOptions} */
      const option = {};
      const cap = r.capabilities.textDocumentSync;
      if (typeof cap === "number") {
        option.openClose = cap > 0;
        option.change = cap;
      } else if (cap) {
        Object.assign(option, cap);
      }
      return option;
    },
  });

  static state = StateField.define({
    /** @returns {TextDocumentSynchronizationState} */
    create() {
      return TextDocumentSynchronization.CLOSED;
    },
    update(value, tr) {
      if (getStateIfNeedsRefresh(tr, initializeResult) !== undefined) {
        // The connection has reset
        return TextDocumentSynchronization.CLOSED;
      }

      const v = getLastValueFromTransaction(
        tr,
        TextDocumentSynchronization.stateEffect,
      );
      if (v !== undefined) {
        return v;
      }

      const option = tr.state.field(TextDocumentSynchronization.option);
      const doc = tr.state.field(TextDocumentSynchronization.textDocument);
      const did = tr.state.field(TextDocumentSynchronization.version);
      const { uri, languageId, version } = tr.state.field(textDocument);

      switch (value) {
        case TextDocumentSynchronization.CLOSED:
          if (!uri) {
            value = TextDocumentSynchronization.HALTED;
          } else if (option.openClose) {
            value = TextDocumentSynchronization.OPENING;
          }
          break;
        case TextDocumentSynchronization.OPEN:
          if (!doc || !did) {
            throw new Error("Inconsistent state");
          }

          if (!uri) {
            // The proper way to close a file.
            value = TextDocumentSynchronization.CLOSING;
          } else if (doc.uri === uri && doc.languageId !== languageId) {
            // By spec the file needs to be reopened.
            value = TextDocumentSynchronization.REOPENING;
          } else if (doc.uri !== uri) {
            // Open a new file while retain the old file open
            value = TextDocumentSynchronization.SWITCHING;
          } else if (did < version && option.change) {
            value = TextDocumentSynchronization.CHANGING;
          }
          break;
        case TextDocumentSynchronization.HALTED:
          if (uri) {
            value = TextDocumentSynchronization.CLOSED;
          }
          break;
      }

      return value;
    },
  });

  static changes = StateField.define({
    /** @returns {DidChangeTextDocumentParams[]} */
    create() {
      return [];
    },
    update(value, tr) {
      if (getStateIfNeedsRefresh(tr, initializeResult) !== undefined) {
        // The connection has reset
        return [];
      }

      const v = getLastValueFromTransaction(
        tr,
        TextDocumentSynchronization.changesEffect,
      );
      if (v !== undefined) {
        return v;
      }

      const state = tr.state.field(TextDocumentSynchronization.state);

      if (
        state !== TextDocumentSynchronization.OPENING &&
        state !== TextDocumentSynchronization.CHANGING
      ) {
        // Out of responsibility
        return value;
      }

      const option = tr.state.field(TextDocumentSynchronization.option);
      /** @type {import("vscode-languageserver-protocol").TextDocumentContentChangeEvent[]} */
      const contentChanges = [];

      if (option.change === 2) {
        tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
          const start = cmPositionToLsp(fromA, tr.startState.doc);
          const end = cmPositionToLsp(toA, tr.startState.doc);
          contentChanges.push({
            range: { start, end },
            text: inserted.toString(),
          });
        });
      } else if (tr.docChanged) {
        contentChanges.push({ text: tr.state.doc.toString() });
      }

      return produce(value, (draft) => {
        if (contentChanges.length) {
          if (option.change === 1) {
            // Reset if sync in full
            draft.length = 0;
          }
          draft.push({
            textDocument: tr.state.field(textDocument),
            contentChanges,
          });
        }

        const version = tr.state.field(TextDocumentSynchronization.version);
        if (version > 0 && draft.length) {
          // Remove outdated changes
          while (draft[0].textDocument.version <= version) {
            draft.shift();
          }
        }
        const doc = tr.state.field(TextDocumentSynchronization.textDocument);
        if (doc) {
          const i = draft.findIndex(
            (v) =>
              v.textDocument.uri !== doc.uri ||
              v.textDocument.languageId !== doc.languageId,
          );
          if (i !== -1) {
            // Remove incompatible changes
            draft.splice(i);
          }
        }
      });
    },
  });

  /** @type {import("@codemirror/view").PluginSpec<TextDocumentSynchronization>} */
  static spec = {
    provide: () => [
      TextDocumentSynchronization.version,
      TextDocumentSynchronization.textDocument,
      TextDocumentSynchronization.option,
      TextDocumentSynchronization.state,
      TextDocumentSynchronization.changes,
    ],
  };

  /** @param {import("@codemirror/view").EditorView} view */
  constructor(view) {
    this.view = view;
  }

  /**
   * @param {import("vscode-jsonrpc").MessageConnection} c
   * @param {import("vscode-languageserver-protocol").DidOpenTextDocumentParams} params
   */
  async didOpen(c, params) {
    try {
      await c.sendNotification("textDocument/didOpen", params);
    } catch (err) {
      return this.reset(err);
    }

    this.open(params);
  }

  /**
   * @param {import("vscode-jsonrpc").MessageConnection} c
   * @param {import("vscode-languageserver-protocol").DidCloseTextDocumentParams} params
   * @param {import("vscode-languageserver-protocol").DidChangeTextDocumentParams | null} [refresh]
   * @param {import("vscode-languageserver-protocol").DidOpenTextDocumentParams | null} [reopen]
   */
  async didClose(c, params, refresh, reopen) {
    try {
      await Promise.all([
        refresh
          ? c.sendNotification("textDocument/didChange", refresh)
          : Promise.resolve(),
        c.sendNotification("textDocument/didClose", params),
        reopen
          ? c.sendNotification("textDocument/didOpen", reopen)
          : Promise.resolve(),
      ]);
    } catch (err) {
      return this.reset(err);
    }

    if (reopen) {
      this.open(reopen);
    } else {
      this.reset();
    }
  }

  /**
   * @param {import("vscode-jsonrpc").MessageConnection} c
   * @param {import("vscode-languageserver-protocol").DidChangeTextDocumentParams} params
   */
  async didChange(c, params) {
    try {
      await c.sendNotification("textDocument/didChange", params);
    } catch (err) {
      return this.reset(err);
    }

    this.view.dispatch({
      effects: [
        TextDocumentSynchronization.stateEffect.of(
          TextDocumentSynchronization.OPEN,
        ),
        TextDocumentSynchronization.versionEffect.of(
          params.textDocument.version,
        ),
      ],
    });
  }

  /**
   *
   * @param {any} [reason]
   */
  reset(reason) {
    if (reason) {
      console.error("Reset due to", reason);
    }

    this.view.dispatch({
      effects: [
        TextDocumentSynchronization.stateEffect.of(
          reason
            ? TextDocumentSynchronization.HALTED
            : TextDocumentSynchronization.CLOSED,
        ),
        TextDocumentSynchronization.changesEffect.of([]),
        TextDocumentSynchronization.textDocumentEffect.of(null),
        TextDocumentSynchronization.versionEffect.of(0),
      ],
    });
  }

  /**
   * @param {import("vscode-languageserver-protocol").DidOpenTextDocumentParams} params
   */
  open(params) {
    const { uri, languageId, version } = params.textDocument;
    this.view.dispatch({
      effects: [
        TextDocumentSynchronization.stateEffect.of(
          TextDocumentSynchronization.OPEN,
        ),
        TextDocumentSynchronization.textDocumentEffect.of({
          uri,
          languageId,
          version,
        }),
        TextDocumentSynchronization.versionEffect.of(version),
      ],
    });
  }

  /**
   *
   * @param {import("@codemirror/view").ViewUpdate} update
   * @returns
   */
  doOpen({ state }) {
    const v = getConnectionAndInitializeResult(state);
    if (!v?.[1]) {
      throw new Error("Inconsistent state");
    }

    this.didOpen(v[0], {
      textDocument: {
        ...state.field(textDocument),
        text: state.doc.toString(),
      },
    });
  }

  /**
   * @param {import("@codemirror/view").ViewUpdate} update
   * @param {boolean} [reopen]
   */
  doClose({ state }, reopen) {
    const v = getConnectionAndInitializeResult(state);
    const doc = state.field(TextDocumentSynchronization.textDocument);
    if (!v?.[1] || !doc) {
      throw new Error("Inconsistent state");
    }

    this.didClose(
      v[0],
      { textDocument: { uri: doc.uri } },
      this.makeChangeParams(state),
      reopen ? { textDocument: { ...doc, text: state.doc.toString() } } : null,
    );
  }

  /**
   * @param {import("@codemirror/view").ViewUpdate} update
   */
  doReopen(update) {
    return this.doClose(update, true);
  }

  /**
   * @param {import("@codemirror/view").ViewUpdate} update
   */
  doSwitch(update) {
    return this.doOpen(update);
  }

  /**
   * @param {import("@codemirror/view").ViewUpdate} update
   */
  doChange({ state }) {
    const v = getConnectionAndInitializeResult(state);
    const params = this.makeChangeParams(state);
    if (!v?.[1] || !params) {
      throw new Error("Inconsistent state");
    }

    this.didChange(v[0], params);
  }

  /**
   * @param {import("@codemirror/state").EditorState} state
   */
  makeChangeParams(state) {
    const changes = state.field(TextDocumentSynchronization.changes);
    if (!changes.length) {
      return null;
    }
    /** @type {import("vscode-languageserver-protocol").TextDocumentContentChangeEvent[]} */
    const contentChanges = [];
    for (const item of changes) {
      contentChanges.push(...item.contentChanges);
    }
    return {
      textDocument: changes[changes.length - 1].textDocument,
      contentChanges,
    };
  }

  /**
   * Implementation of the ViewPlugin update.
   * @param {import("@codemirror/view").ViewUpdate} update
   * @returns {void}
   */
  update(update) {
    const [last, curr] = getStatePairs(
      update,
      TextDocumentSynchronization.state,
    );

    if (
      last === TextDocumentSynchronization.CLOSED &&
      curr === TextDocumentSynchronization.OPENING
    ) {
      this.doOpen(update);
    } else if (
      last === TextDocumentSynchronization.OPEN &&
      curr === TextDocumentSynchronization.CHANGING
    ) {
      this.doChange(update);
    } else if (
      last === TextDocumentSynchronization.OPEN &&
      curr === TextDocumentSynchronization.CLOSING
    ) {
      this.doClose(update);
    } else if (
      last === TextDocumentSynchronization.OPEN &&
      curr === TextDocumentSynchronization.REOPENING
    ) {
      this.doReopen(update);
    } else if (
      last === TextDocumentSynchronization.OPEN &&
      curr === TextDocumentSynchronization.SWITCHING
    ) {
      this.doSwitch(update);
    }
  }

  // Implementation of ViewPlugin destroy.
  destroy() {
    // TODO: There should be a UI to explicitly prompt users to close the document, and the destroy method here is primarily for cleaning up the relevant DOM elements rather than handling the document closure.
  }
}

export const textDocumentSynchronization = ViewPlugin.fromClass(
  TextDocumentSynchronization,
  TextDocumentSynchronization.spec,
);

export default function () {
  return [
    textDocument,
    textDocumentSynchronization,
    initializeParams.of({
      capabilities: {
        textDocument: {
          synchronization: {},
        },
      },
    }),
  ];
}
