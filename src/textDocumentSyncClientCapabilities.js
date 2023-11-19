// @ts-check

import { EditorState, StateField } from "@codemirror/state";
import { ViewPlugin } from "@codemirror/view";
import { produce } from "immer";

import { getConnectionAndInitializeResult, initializeParams } from "./client";

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

/**
 * @param {EditorState} state
 * @returns {import("vscode-languageserver-protocol").DidOpenTextDocumentParams}
 */
export function createDidOpenTextDocumentParams(state) {
  return {
    textDocument: {
      ...state.field(textDocument),
      text: state.doc.toString(),
    },
  };
}

export const textDocumentSynchronization = ViewPlugin.define(() => {
  let open = false;

  return {
    update(update) {
      const v = getConnectionAndInitializeResult(update.state);
      if (v && v[1]) {
        const c = v[0];
        if (!open) {
          c.sendNotification(
            "textDocument/didOpen",
            createDidOpenTextDocumentParams(update.state)
          ).then(() => (open = true));
        } else if (update.docChanged) {
          // TODO: didChange
        }
      }
    },
  };
});

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
