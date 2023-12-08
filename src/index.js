// @ts-check

import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { cpp } from "@codemirror/lang-cpp";

import lint from "./ui/lint";
import link from "./ui/link";
import file from "./ui/file";
import step from "./ui/step";
import page from "./ui/page";
import hint from "./ui/hint";

import { serverUri } from "./serverUri";
import client, { initializeParams } from "./client";
import trace from "./trace";
import publishDiagnosticsClientCapabilities from "./publishDiagnosticsClientCapabilities";
import textDocumentSyncClientCapabilities, {
  textDocument,
} from "./textDocumentSyncClientCapabilities";
import documentLinkClientCapabilities from "./documentLinkClientCapabilities";
import documentSymbolClientCapabilities from "./documentSymbolClientCapabilities";
import hoverClientCapabilities from "./hoverClientCapabilities";

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
    file(),
    step(),
    page(),
    hint(),

    // LSP implementations
    client(),
    trace("verbose"),
    publishDiagnosticsClientCapabilities(),
    textDocumentSyncClientCapabilities(),
    documentLinkClientCapabilities(),
    documentSymbolClientCapabilities(),
    hoverClientCapabilities(),

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
