import { execFile, spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import { promisify } from "node:util";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const execFileAsync = promisify(execFile);
const backendPort = 5131;
const backendDirectory =
  "C:\\Users\\berat\\Desktop\\GeminiAsistanBackend\\src\\api";

const findBackendPids = async () => {
  const { stdout } = await execFileAsync("netstat.exe", ["-ano", "-p", "tcp"]);
  const pids = new Set<number>();

  for (const line of stdout.split(/\r?\n/)) {
    if (!line.includes(`:${backendPort}`) || !/\bLISTENING\b/i.test(line)) {
      continue;
    }

    const pid = Number(line.trim().split(/\s+/).at(-1));
    if (Number.isInteger(pid) && pid > 0) pids.add(pid);
  }

  return [...pids];
};

const stopBackendProcess = async () => {
  const pids = await findBackendPids();
  await Promise.all(
    pids.map((pid) =>
      execFileAsync("taskkill.exe", ["/PID", String(pid)]),
    ),
  );
  return pids;
};

const startBackendProcess = async () => {
  if ((await findBackendPids()).length > 0) return;

  const child = spawn("dotnet.exe", ["run"], {
    cwd: backendDirectory,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
};

const sendJson = (
  response: ServerResponse,
  status: number,
  body: Record<string, unknown>,
) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
};

const backendManagerPlugin = (): Plugin => {
  const configureServer = (server: {
    middlewares: {
      use: (
        handler: (
          request: IncomingMessage,
          response: ServerResponse,
          next: () => void,
        ) => void,
      ) => void;
    };
  }) => {
    server.middlewares.use((request, response, next) => {
      const match = request.url?.match(
        /^\/__service-manager\/backend\/(start|stop|restart)$/,
      );
      if (request.method !== "POST" || !match) {
        next();
        return;
      }

      const operation = match[1];
      void (async () => {
        try {
          let stoppedPids: number[] = [];
          if (operation === "stop" || operation === "restart") {
            stoppedPids = await stopBackendProcess();
          }
          if (operation === "start" || operation === "restart") {
            await startBackendProcess();
          }

          sendJson(response, 200, { ok: true, operation, stoppedPids });
        } catch (error) {
          sendJson(response, 500, {
            ok: false,
            message:
              error instanceof Error
                ? error.message
                : "Backend işlemi gerçekleştirilemedi.",
          });
        }
      })();
    });
  };

  return {
    name: "local-backend-manager",
    configureServer,
    configurePreviewServer: configureServer,
  };
};

export default defineConfig({
  plugins: [react(), backendManagerPlugin()],
  server: {
    port: 5173,
    proxy: {
      "/Api": {
        target: "http://localhost:5131",
        changeOrigin: true,
      },
    },
  },
});
