"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const wss = new ws_1.WebSocketServer({ port: 8080 });
wss.on("connection", (ws) => {
    console.log("Client connected");
    ws.on("error", (err) => {
        console.log(err);
    });
    ws.send("Hello from server");
});
