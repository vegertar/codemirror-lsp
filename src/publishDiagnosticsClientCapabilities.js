// @ts-check

import { StateField, StateEffect } from "@codemirror/state";

import { BeforeHandshake, initializeParams } from "./client.js";
import { getLastValueFromTransaction } from "./utils.js";

/** @type {import("@codemirror/state").StateEffectType<import("vscode-languageserver-protocol").PublishDiagnosticsParams>} */
export const publishDiagnosticsEffect = StateEffect.define();

export const publishDiagnosticsParams = StateField.define({
  /** @returns {import("vscode-languageserver-protocol").PublishDiagnosticsParams | null} */
  create() {
    return null;
  },
  update(value, tr) {
    return getLastValueFromTransaction(tr, publishDiagnosticsEffect) || value;
  },
});

export const publishDiagnosticsNotification = BeforeHandshake.from(
  async (update, c) => {
    const disposable = c.onNotification(
      "textDocument/publishDiagnostics",
      /** @param {import("vscode-languageserver-protocol").PublishDiagnosticsParams} params */
      (params) =>
        update.view.dispatch({
          effects: publishDiagnosticsEffect.of(params),
        }),
    );
    return () => disposable.dispose();
  },
);

export default function () {
  return [
    publishDiagnosticsParams,
    publishDiagnosticsNotification,
    initializeParams.of({
      capabilities: {
        textDocument: {
          publishDiagnostics: {},
        },
      },
    }),
  ];
}
