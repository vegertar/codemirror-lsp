import { Facet } from "@codemirror/state";
import { firstAvailable } from "./utils";

const exampleUri = `ws://${location.host}/ls/example/plaintext`;

export const serverUri = Facet.define({
  combine: (values) => firstAvailable(values, exampleUri),
});

export default serverUri;
