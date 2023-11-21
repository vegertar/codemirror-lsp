#!/usr/bin/env node

import { WebSocketServer } from "ws";
import {
  createServerProcess,
  createWebSocketConnection,
  forward,
} from "vscode-ws-jsonrpc/server";
import { toSocket } from "vscode-ws-jsonrpc";

const argv = process.argv.slice(2);
const port = parseInt(argv[0]);
if (!isNaN(port)) {
  argv.shift();
}

const magic = argv[0] || process.env.MAGIC || "ls";
const wss = new WebSocketServer(
  {
    port: port || process.env.PORT || 3000,
    perMessageDeflate: false,
  },
  () => {
    const { address: host, port } = wss.address();
    console.log(`Listening to WebSocket request on ${host}:${port}`);
  },
);

wss.on("connection", (socket, request) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const [_, ls, type] = url.pathname.split("/", 3);
  if (ls != magic) {
    console.error(`URL should be starting with /${magic}/`, request.url);
    socket.close();
    return;
  }

  const command = `.${url.pathname}/run`;
  const rpcProcess = createServerProcess(type, command, [url.search]);
  const rpcSocket = toSocket(socket);
  forward(createWebSocketConnection(rpcSocket), rpcProcess);

  console.log(`Forwarding new client to ${command}`);
  rpcSocket.onClose((code, reason) => {
    console.log(`Client closed: code=${code} reason=${reason}`);
    rpcProcess.dispose();
  });
});
