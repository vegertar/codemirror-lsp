// @ts-check

import { StateField } from "@codemirror/state";
import { ViewPlugin } from "@codemirror/view";
import { produce } from "immer";

import { getConnectionAndInitializeResult, initializeParams } from "./client";
import { cmPositionToLspPosition } from "./utils";

export const textDocument = StateField.define({
  /** @returns {Omit<import("vscode-languageserver-protocol").TextDocumentItem, "text">} */
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
        })
      : value;
  },
});

class TextDocumentSynchronization {
  /** @type {0 | 1 | 2 | 3} 0: closed, 1: opening, 2: open, 3: changing */
  didState = 0;

  /** @type {import("vscode-languageserver-protocol").TextDocumentSyncOptions} */
  syncOption = {};

  /** @type {import("vscode-languageserver-protocol").DidChangeTextDocumentParams[]} */
  pendingChanges = [];

  /** @param {import("@codemirror/view").EditorView} view */
  constructor(view) {
    this.view = view;
  }

  /**
   * @param {import("vscode-languageserver-protocol").MessageConnection} c
   * @param {import("vscode-languageserver-protocol").DidOpenTextDocumentParams} params
   */
  didOpen(c, params) {
    this.didState = 1;
    c.sendNotification("textDocument/didOpen", params).then(() => {
      this.didState = 2;
    });
  }

  /**
   * @param {import("vscode-languageserver-protocol").MessageConnection} c
   * @param {import("vscode-languageserver-protocol").DidCloseTextDocumentParams} params
   */
  didClose(c, params) {
    if (this.pendingChanges.length) {
      console.error(`There are ${this.pendingChanges.length} unsynced changes`);
    }

    c.sendNotification("textDocument/didClose", params);
  }

  /**
   * @param {import("vscode-languageserver-protocol").MessageConnection} c
   * @param {import("vscode-languageserver-protocol").DidChangeTextDocumentParams} params
   */
  didChange(c, params) {
    this.didState = 3;
    c.sendNotification("textDocument/didChange", params).then(() => {
      this.didState = 2;
    });
  }

  /**
   * @param {import("vscode-languageserver-protocol").MessageConnection} c
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

  /**
   * Implementation of the ViewPlugin update.
   * @param {import("@codemirror/view").ViewUpdate} update
   * @returns
   */
  update(update) {
    const v = getConnectionAndInitializeResult(update.state);
    // Reset states if either is not connected or is not handshaked
    if (!v || !v[1]) {
      this.didState = 0;
      this.pendingChanges.length = 0;
      return;
    }

    const currentTextDocument = update.state.field(textDocument);
    if (this.didState === 0) {
      const cap = v[1].capabilities.textDocumentSync;
      if (typeof cap === "number") {
        this.syncOption.openClose = cap > 0;
        this.syncOption.change = cap;
      } else if (cap) {
        Object.assign(this.syncOption, cap);
      }

      if (this.syncOption.openClose) {
        return this.didOpen(v[0], {
          textDocument: {
            ...currentTextDocument,
            text: update.state.doc.toString(),
          },
        });
      }
    } else if (update.docChanged && this.syncOption.change) {
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
        textDocument: currentTextDocument,
        contentChanges,
      };
      if (this.didState === 2) {
        this.didChange(v[0], params);
      } else {
        if (this.syncOption.change === 1) {
          // Clear old pending changes for full sync
          this.pendingChanges.length = 0;
        }
        this.pendingChanges.push(params);
      }
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

export const textDocumentSynchronization = ViewPlugin.fromClass(
  TextDocumentSynchronization,
);

/** @type {import("vscode-languageserver-protocol").TextDocumentSyncClientCapabilities} */
const defaultValue = {
  dynamicRegistration: true,
  willSave: true,
  willSaveWaitUntil: true,
  didSave: true,
};

export default function (value = defaultValue) {
  return [
    textDocument,
    textDocumentSynchronization,
    initializeParams.of({
      capabilities: {
        textDocument: {
          synchronization: value,
        },
      },
    }),
  ];
}
