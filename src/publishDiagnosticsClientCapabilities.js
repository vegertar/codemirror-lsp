// @ts-check

import { linter } from "@codemirror/lint";
import { StateField, StateEffect } from "@codemirror/state";

import { BeforeHandshake, initializeParams } from "./client";
import {
  getLastValueFromTransaction,
  lspPositionToCmPosition,
  lspSeverityToCmServerity,
} from "./utils";

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

export const diagnosticLinter = linter(
  (view) => {
    const params = view.state.field(publishDiagnosticsParams);
    if (params) {
      return params.diagnostics.map((item) => ({
        from: lspPositionToCmPosition(item.range.start, view.state.doc),
        to: lspPositionToCmPosition(item.range.end, view.state.doc),
        severity: lspSeverityToCmServerity(item.severity),
        message: item.message,
      }));
    }

    return [];
  },
  {
    needsRefresh(update) {
      const oldValue = update.startState.field(publishDiagnosticsParams);
      const newValue = update.state.field(publishDiagnosticsParams);
      return oldValue !== newValue;
    },
  },
);

/** @type {import("vscode-languageserver-protocol").PublishDiagnosticsClientCapabilities} */
const defaultValue = {
  relatedInformation: true,
  versionSupport: false,
  tagSupport: {
    valueSet: [1, 2],
  },
  codeDescriptionSupport: true,
  dataSupport: true,
};

export default function (value = defaultValue) {
  return [
    diagnosticLinter,
    publishDiagnosticsParams,
    publishDiagnosticsNotification,
    initializeParams.of({
      capabilities: {
        textDocument: {
          publishDiagnostics: value,
        },
      },
    }),
  ];
}
