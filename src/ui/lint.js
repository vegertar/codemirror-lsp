// @ts-check

import { linter } from "@codemirror/lint";
import { publishDiagnosticsParams } from "../publishDiagnosticsClientCapabilities";
import {
  lspPositionToCm,
  lspSeverityToCm,
  getValueIfNeedsRefresh,
} from "../utils";

export const diagnosticLint = linter(
  (view) => {
    const params = view.state.field(publishDiagnosticsParams);
    if (params) {
      return params.diagnostics.map((item) => ({
        from: lspPositionToCm(item.range.start, view.state.doc),
        to: lspPositionToCm(item.range.end, view.state.doc),
        severity: lspSeverityToCm(item.severity),
        message: item.message,
      }));
    }

    return [];
  },
  {
    needsRefresh(update) {
      return (
        getValueIfNeedsRefresh(update, publishDiagnosticsParams) !== undefined
      );
    },
  },
);

export default function () {
  return [diagnosticLint];
}