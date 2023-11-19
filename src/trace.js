// @ts-check

import { initializeParams } from "./client";

/**
 * @param {import("vscode-languageserver-protocol").TraceValues} trace
 */
export default function (trace) {
  return initializeParams.of({ trace });
}
