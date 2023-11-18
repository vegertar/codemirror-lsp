import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";

import client from "./client";
import initialize from "./initialize";
import trace from "./trace";
import publishDiagnosticsClientCapabilities from "./publishDiagnosticsClientCapabilities";
import textDocumentSyncClientCapabilities from "./textDocumentSyncClientCapabilities";

new EditorView({
  extensions: [
    basicSetup,
    EditorState.readOnly.of(true),
    client,
    initialize,
    trace.of("verbose"),
    publishDiagnosticsClientCapabilities.of(),
    textDocumentSyncClientCapabilities.of(),
  ],
  parent: document.body,
});
