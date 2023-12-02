// @ts-check

import { StateField, StateEffect } from "@codemirror/state";
import { ViewPlugin } from "@codemirror/view";
import { produce } from "immer";

import {
  getConnectionAndInitializeResult,
  initializeParams,
  initializeResultEffect,
} from "./client";
import { fileInfo } from "./file";
import { cmPositionToLspPosition } from "./utils";

/**
 * @typedef {Omit<import("vscode-languageserver-types").TextDocumentItem, "text">} TextDocument
 */

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
    return tr.docChanged
      ? produce(value, (draft) => {
          draft.version++;
          const fi = tr.state.field(fileInfo, false);
          if (fi?.type === "textDocument") {
            draft.uri = fi.uri;
            draft.languageId = fi.languageId;
          }
        })
      : value;
  },
});

export class TextDocumentSynchronization {
  /**
   * An effect to notify that the text document has had synchronizations up to the given version number.
   * Specially, 0 means not synced at all or did close.
   * @type {import("@codemirror/state").StateEffectType<number>}
   */
  static didEffect = StateEffect.define();

  /**
   * The state field of the version number that the text document has had synchronizations up to.
   * Specially, 0 means not synced at all or did close.
   */
  static didVersion = StateField.define({
    create() {
      return 0;
    },
    update(value, tr) {
      for (const effect of tr.effects) {
        if (effect.is(TextDocumentSynchronization.didEffect)) {
          value = effect.value;
        } else if (effect.is(initializeResultEffect)) {
          value = 0;
        }
      }
      return value;
    },
  });

  /** @type {0 | 1 | 2 | 3 | 4} 0: closed, 1: opening, 2: open, 3: changing, 4: closing */
  didState = 0;
  didUri = "";

  /** @type {import("vscode-languageserver-protocol").TextDocumentSyncOptions} */
  syncOption = {};

  /** @type {import("vscode-languageserver-protocol").DidChangeTextDocumentParams[]} */
  pendingChanges = [];

  /** @param {import("@codemirror/view").EditorView} view */
  constructor(view) {
    this.view = view;
  }

  /** @param {number} version */
  did(version) {
    this.view.dispatch({
      effects: TextDocumentSynchronization.didEffect.of(version),
    });
  }

  /**
   * @param {import("vscode-jsonrpc").MessageConnection} c
   * @param {import("vscode-languageserver-protocol").DidOpenTextDocumentParams} params
   */
  didOpen(c, params) {
    this.didState = 1;
    this.didUri = params.textDocument.uri;
    c.sendNotification("textDocument/didOpen", params).then(() => {
      this.didState = 2;
      this.did(params.textDocument.version);
    });
  }

  /**
   * @param {import("vscode-jsonrpc").MessageConnection} c
   * @param {import("vscode-languageserver-protocol").DidCloseTextDocumentParams} params
   */
  didClose(c, params) {
    if (this.pendingChanges.length) {
      console.error(`There are ${this.pendingChanges.length} pending changes`);
    }

    this.didState = 4;
    this.didUri = params.textDocument.uri;
    c.sendNotification("textDocument/didClose", params).then(() => {
      this.didState = 0;
      this.did(0);
    });
  }

  /**
   * @param {import("vscode-jsonrpc").MessageConnection} c
   * @param {import("vscode-languageserver-protocol").DidChangeTextDocumentParams} params
   */
  didChange(c, params) {
    this.didState = 3;
    this.didUri = params.textDocument.uri;
    c.sendNotification("textDocument/didChange", params).then(() => {
      this.didState = 2;
      this.did(params.textDocument.version);
    });
  }

  /**
   * @param {import("vscode-jsonrpc").MessageConnection} c
   */
  didPendingChanges(c) {
    const n = this.pendingChanges.length;
    if (n) {
      /** @type {import("vscode-languageserver-protocol").TextDocumentContentChangeEvent[]} */
      const contentChanges = [];
      for (const item of this.pendingChanges) {
        contentChanges.push(...item.contentChanges);
      }
      this.didChange(c, {
        textDocument: this.pendingChanges[n - 1].textDocument,
        contentChanges,
      });
    }
  }

  reset() {
    this.didState = 0;
    this.didUri = "";
    this.syncOption = {};
    this.pendingChanges.length = 0;
  }

  /**
   *
   * @param {TextDocument} oldTextDocument
   * @param {TextDocument} newTextDocument
   * @param {import("vscode-jsonrpc").MessageConnection} c
   */
  checkReOpen(oldTextDocument, newTextDocument, c) {
    if (
      oldTextDocument.uri !== newTextDocument.uri ||
      oldTextDocument.languageId !== newTextDocument.languageId
    ) {
      this.didClose(c, { textDocument: oldTextDocument });
    }
  }

  /**
   *
   * @param {import("@codemirror/view").ViewUpdate} update
   * @param {TextDocument} textDocument
   * @param {import("vscode-jsonrpc").MessageConnection} c
   * @param {import("vscode-languageserver-protocol").InitializeResult} r
   * @returns
   */
  doOpen(update, textDocument, c, r) {
    const cap = r.capabilities.textDocumentSync;
    if (typeof cap === "number") {
      this.syncOption.openClose = cap > 0;
      this.syncOption.change = cap;
    } else if (cap) {
      Object.assign(this.syncOption, cap);
    }

    if (this.syncOption.openClose) {
      return this.didOpen(c, {
        textDocument: {
          ...textDocument,
          text: update.state.doc.toString(),
        },
      });
    }
  }

  /**
   * @param {import("@codemirror/view").ViewUpdate} update
   * @param {TextDocument} textDocument
   * @param {import("vscode-jsonrpc").MessageConnection} c
   */
  doChange(update, textDocument, c) {
    /** @type {import("vscode-languageserver-protocol").TextDocumentContentChangeEvent[]} */
    const contentChanges = [];

    if (this.syncOption.change === 2) {
      update.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
        const start = cmPositionToLspPosition(fromA, update.startState.doc);
        const end = cmPositionToLspPosition(toA, update.startState.doc);
        contentChanges.push({
          range: { start, end },
          text: inserted.toString(),
        });
      });
    } else {
      contentChanges.push({ text: update.state.doc.toString() });
    }

    const params = {
      textDocument,
      contentChanges,
    };
    if (this.didState === 2) {
      this.didChange(c, params);
    } else {
      if (this.syncOption.change === 1) {
        // Clear old pending changes for full sync
        this.pendingChanges.length = 0;
      }
      this.pendingChanges.push(params);
    }
  }

  /**
   * Implementation of the ViewPlugin update.
   * @param {import("@codemirror/view").ViewUpdate} update
   * @returns {void}
   */
  update(update) {
    const v = getConnectionAndInitializeResult(update.state);
    // Reset states if either is not connected or has not completed the handshake.
    if (!v || !v[1]) {
      return this.reset();
    }

    const oldTextDocument = update.startState.field(textDocument);
    const newTextDocument = update.state.field(textDocument);
    this.checkReOpen(oldTextDocument, newTextDocument, v[0]);

    if (this.didState === 4) {
      console.debug("Closing a document:", this.didUri);
    } else if (this.didState === 0) {
      this.doOpen(update, newTextDocument, v[0], v[1]);
    } else if (update.docChanged && this.syncOption.change) {
      this.doChange(update, newTextDocument, v[0]);
    } else if (this.didState === 2) {
      this.didPendingChanges(v[0]);
    }
  }

  // Implementation of ViewPlugin destroy.
  destroy() {
    if (this.didState >= 2) {
      const v = getConnectionAndInitializeResult(this.view.state);
      if (v) {
        this.didClose(v[0], {
          textDocument: this.view.state.field(textDocument),
        });
      }
    }
  }
}

export const textDocumentSynchronization = [
  TextDocumentSynchronization.didVersion,
  ViewPlugin.fromClass(TextDocumentSynchronization),
];

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
