import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";

import client from "./client";
import publishDiagnosticsClientCapabilities from "./publishDiagnosticsClientCapabilities";

new EditorView({
  extensions: [
    basicSetup,
    EditorState.readOnly.of(true),
    client,
    publishDiagnosticsClientCapabilities.of(),
  ],
  parent: document.body,
});
