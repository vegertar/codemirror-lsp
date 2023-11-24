// @ts-check

import { linter } from "@codemirror/lint";
import { publishDiagnosticsParams } from "./publishDiagnosticsClientCapabilities";
import { lspPositionToCmPosition, lspSeverityToCmServerity } from "./utils";

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

export default function () {
  return [diagnosticLinter];
}
