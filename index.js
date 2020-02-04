"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_pty_1 = require("node-pty");
const ws_1 = require("ws");
const program = require("commander");
const pkg = require("./package.json");
const cryptoRandomString = require("crypto-random-string");
program
    .version(pkg.version)
    .option("--host <string>", "listen host", "127.0.0.1")
    .option("-p, --port <number>", "listen port", 8081)
    .option("--path <string>", "random path", cryptoRandomString({ length: 16 }))
    .requiredOption("-c, --executable <string>", "executable to be spawned when accept connection");
program.parse(process.argv);
const server = new ws_1.Server({
    host: program.host,
    port: +program.port,
    path: "/" + program.path
});
console.log("secret path: %s", program.path);
console.log("ws://%s:%d/%s", program.host, +program.port, program.path);
server.on("error", err => {
    console.error(err);
});
server.on("connection", con => {
    con.binaryType = "nodebuffer";
    const pty = node_pty_1.spawn(program.executable, [], { useConpty: true });
    con.on("close", () => {
        pty.kill();
    });
    con.on("message", data => {
        if (typeof data === "string") {
            try {
                const action = JSON.parse(data);
                if ("resize" in action && action.resize.cols && action.resize.rows) {
                    pty.resize(action.resize.cols, action.resize.rows);
                }
                else {
                    con.close(1002, "unknown action");
                }
            }
            catch {
                con.close(1002, "unable to parse");
            }
        }
        else {
            pty.write(data.toString('utf-8'));
        }
    });
    pty.on("data", data => {
        con.send(data, { binary: true });
    });
    pty.on("exit", () => {
        con.close(1000);
    });
});
