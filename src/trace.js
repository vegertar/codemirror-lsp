// @ts-check

import { Trace } from "vscode-languageserver-protocol";

import { BeforeHandshake, initializeParams } from "./client";

export const setTrace = BeforeHandshake.fromUpdate(async (update, c) => {
  const value = update.state.facet(initializeParams).trace;
  if (value) {
    await c.trace(Trace.fromString(value), console);
  }
});

/**
 * @param {import("vscode-languageserver-protocol").TraceValues} [value]
 */
export default function (value) {
  return [setTrace, initializeParams.of({ trace: value })];
}
