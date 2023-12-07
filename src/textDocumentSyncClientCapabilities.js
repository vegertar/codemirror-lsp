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
import { cmPositionToLsp } from "./utils";

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
    return produce(value, (draft) => {
      if (tr.docChanged) {
        draft.version++;
      }
      const fi = tr.state.field(fileInfo, false);
      if (fi?.type === "textDocument") {
        draft.uri = fi.uri;
        draft.languageId = fi.languageId;
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

  /** @type {TextDocument | null} */
  didTextDocument = null;

  /** @type {0 | 1 | 2} 0: nop, 1: prepare to reset, 3: resetting */
  didReset = 0;

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
    this.didTextDocument = params.textDocument;
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
      throw new Error(
        `TODO: Notify the user that there are ${this.pendingChanges.length} pending changes. The file cannot be closed until these changes are synced.`,
      );
    }

    this.didState = 4;
    c.sendNotification("textDocument/didClose", params).then(() => {
      this.reset();
      this.did(0);
    });
  }

  /**
   * @param {import("vscode-jsonrpc").MessageConnection} c
   * @param {import("vscode-languageserver-protocol").DidChangeTextDocumentParams} params
   */
  didChange(c, params) {
    this.didState = 3;
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
    this.didTextDocument = null;
    this.didReset = 0;
    this.syncOption = {};
    this.pendingChanges.length = 0;
  }

  /**
   *
   * @param {TextDocument} newTextDocument
   * @param {import("vscode-jsonrpc").MessageConnection} c
   */
  checkReset(newTextDocument, c) {
    if (!this.didTextDocument) {
      return;
    }

    // By the specification, it's required to close the old document first.
    if (
      this.didReset === 0 &&
      (this.didTextDocument.uri !== newTextDocument.uri ||
        this.didTextDocument.languageId !== newTextDocument.languageId)
    ) {
      this.didReset = 1;
    }

    if (this.didState === 2 && this.didReset === 1) {
      this.didReset = 2;
      this.didClose(c, { textDocument: this.didTextDocument });
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
      this.didOpen(c, {
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
        const start = cmPositionToLsp(fromA, update.startState.doc);
        const end = cmPositionToLsp(toA, update.startState.doc);
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

    const [c, r] = v;
    const t = update.state.field(textDocument);
    this.checkReset(t, c);

    if (this.didState === 4) {
      console.debug("Closing a document:", this.didTextDocument?.uri);
    } else if (this.didState === 0) {
      this.doOpen(update, t, c, r);
    } else if (update.docChanged && this.syncOption.change) {
      this.doChange(update, t, c);
    } else if (this.didState === 2) {
      this.didPendingChanges(c);
    }
  }

  // Implementation of ViewPlugin destroy.
  destroy() {
    // TODO: There should be a UI to explicitly prompt users to close the document, and the destroy method here is primarily for cleaning up the relevant DOM elements rather than handling the document closure.
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
