// @ts-check

import { Trace } from "vscode-jsonrpc";

import { BeforeHandshake, initializeParams } from "./client";

export const setTrace = BeforeHandshake.from(async (update, c) => {
  const value = update.state.facet(initializeParams).trace;
  if (value) {
    await c.trace(Trace.fromString(value), console);
  }
});

/**
 * @param {import("vscode-jsonrpc").TraceValues} [value]
 */
export default function (value) {
  return [setTrace, initializeParams.of({ trace: value })];
}
