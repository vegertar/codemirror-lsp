// @ts-check

import { Facet } from "@codemirror/state";
import { ViewPlugin } from "@codemirror/view";
import { Trace } from "vscode-languageserver-protocol";

import {
  afterConnectedEffect,
  beforeHandshake,
  getConnectionAndInitializeResult,
  initializeParams,
} from "./client";
import { firstAvailable } from "./utils";
import { promisable } from "./promisable";

/** @type {Facet<import("vscode-languageserver-protocol").TraceValues | undefined, import("vscode-languageserver-protocol").TraceValues  | undefined>} */
export const trace = Facet.define({
  combine: (values) => firstAvailable(values),
});

export const setTraceNotification = promisable(
  beforeHandshake,
  afterConnectedEffect,
  (promisingField) =>
    ViewPlugin.define(() => {
      /** @type {import("vscode-languageserver-protocol").TraceValues | undefined } */
      let lastValue = "off";
      let busy = false;

      return {
        update(update) {
          const v = getConnectionAndInitializeResult(update.state);

          if (v && !busy) {
            const promising = update.state.field(promisingField);

            /** @type {import("vscode-languageserver-protocol").TraceValues | undefined} */
            let value;
            let sendNotification = false;

            if (!v[1]) {
              value = update.state.facet(initializeParams).trace;
            } else {
              value = update.state.facet(trace);
              sendNotification = true;
            }

            if (!value) {
              value = "off";
            }

            if (lastValue !== value) {
              busy = true;

              v[0]
                .trace(Trace.fromString(value), console, sendNotification)
                .then(() => {
                  lastValue = value;
                })
                .catch((err) => {
                  console.error("SetTraceNotification Failed: ", err);
                })
                .finally(() => {
                  busy = false;
                  promising?.[1]();
                });
            }
          }
        },
      };
    })
);

/**
 * @param {import("vscode-languageserver-protocol").TraceValues} [value]
 */
export default function (value) {
  return [
    trace.of(value),
    setTraceNotification,
    initializeParams.of({ trace: value }),
  ];
}
