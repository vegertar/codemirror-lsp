// @ts-check

import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";

import client from "./client";
import trace from "./trace";
import publishDiagnosticsClientCapabilities from "./publishDiagnosticsClientCapabilities";
import textDocumentSyncClientCapabilities from "./textDocumentSyncClientCapabilities";

new EditorView({
  extensions: [
    basicSetup,
    EditorState.readOnly.of(true),
    client(),
    trace("verbose"),
    publishDiagnosticsClientCapabilities(),
    textDocumentSyncClientCapabilities(),
  ],
  parent: document.body,
});
