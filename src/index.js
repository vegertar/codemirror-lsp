import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";

import client from "./client";
import publishDiagnosticsClientCapabilities from "./publishDiagnosticsClientCapabilities";
import trace from "./trace";

new EditorView({
  extensions: [
    basicSetup,
    EditorState.readOnly.of(true),
    client,
    publishDiagnosticsClientCapabilities.of(),
    trace.of("verbose"),
  ],
  parent: document.body,
});
