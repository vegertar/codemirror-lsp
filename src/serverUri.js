// @ts-check

import { Facet } from "@codemirror/state";
import { firstAvailable } from "./utils";

const exampleUri = `ws://${location.host}/ls/example/plaintext`;

/**
 * The websocket server URI to create a connection.
 * @type {Facet<string, string>}
 */
export const serverUri = Facet.define({
  combine: (values) => firstAvailable(values, exampleUri),
});
