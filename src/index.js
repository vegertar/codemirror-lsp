// @ts-check

import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";

import client from "./client";
import trace from "./trace";
import linter from "./linter";
import publishDiagnosticsClientCapabilities from "./publishDiagnosticsClientCapabilities";
import textDocumentSyncClientCapabilities, {
  textDocument,
} from "./textDocumentSyncClientCapabilities";
import { serverUri } from "./serverUri";

new EditorView({
  doc: String.raw`#include <stdio.h>

int main() {
  printf("Hello World\n");
}`,
  extensions: [
    basicSetup,
    EditorState.readOnly.of(false),
    client({ rootUri: "file:///home/whom/codemirror-lsp/ls/example/c" }),
    serverUri.of(`ws://${location.host}/ls/example/c`),
    textDocument.init(() => ({
      uri: "file:///home/whom/codemirror-lsp/ls/example/c/hello-world.c",
      languageId: "c",
      version: 1,
    })),
    trace("verbose"),
    linter(),
    publishDiagnosticsClientCapabilities(),
    textDocumentSyncClientCapabilities(),
  ],
  parent: document.body,
});
