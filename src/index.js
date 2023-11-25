// @ts-check

import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";

import { serverUri } from "./serverUri";
import client, { initializeParams } from "./client";
import trace from "./trace";
import linter from "./linter";
import linker from "./linker";
import publishDiagnosticsClientCapabilities from "./publishDiagnosticsClientCapabilities";
import textDocumentSyncClientCapabilities, {
  textDocument,
} from "./textDocumentSyncClientCapabilities";
import documentLinkClientCapabilities from "./documentLinkClientCapabilities";

new EditorView({
  doc: String.raw`#include <stdio.h>

int main() {
  printf("Hello World\n");
}`,
  extensions: [
    basicSetup,
    EditorState.readOnly.of(false),

    client(),
    trace("verbose"),
    linter(),
    linker(),
    publishDiagnosticsClientCapabilities(),
    textDocumentSyncClientCapabilities(),
    documentLinkClientCapabilities(),

    initializeParams.of({
      rootUri: "file:///home/whom/codemirror-lsp/ls/example/c",
    }),
    serverUri.of(`ws://${location.host}/ls/example/c`),
    textDocument.init(() => ({
      uri: "file:///home/whom/codemirror-lsp/ls/example/c/hello-world.c",
      languageId: "c",
      version: 1,
    })),
  ],
  parent: document.body,
});
