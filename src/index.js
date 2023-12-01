// @ts-check

import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { cpp } from "@codemirror/lang-cpp";

import lint from "./lint";
import link from "./link";
import jump from "./jump";

import { serverUri } from "./serverUri";
import client, { initializeParams } from "./client";
import trace from "./trace";
import publishDiagnosticsClientCapabilities from "./publishDiagnosticsClientCapabilities";
import textDocumentSyncClientCapabilities, {
  textDocument,
} from "./textDocumentSyncClientCapabilities";
import documentLinkClientCapabilities from "./documentLinkClientCapabilities";
import documentSymbolClientCapabilities from "./documentSymbolClientCapabilities";

new EditorView({
  doc: String.raw`#include <stdio.h>
#include <stdlib.h>

int main() {
  printf("Hello World\n");
  exit(0);
}`,
  extensions: [
    basicSetup,
    EditorState.readOnly.of(true),
    cpp(),

    // UI based on LSP
    lint(),
    link(),
    jump(),

    // LSP implementations
    client(),
    trace("verbose"),
    publishDiagnosticsClientCapabilities(),
    textDocumentSyncClientCapabilities(),
    documentLinkClientCapabilities(),
    documentSymbolClientCapabilities(),

    // LSP configurations
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
