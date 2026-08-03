import http from "node:http";
import { env, isR2Configured, isCdseConfigured } from "./config/env.ts";
import app from "./app.ts";

const server = http.createServer(app);

/**
 * An occupied port otherwise surfaces as an unhandled 'error' event and a raw
 * stack trace. Port 5000 is called out specifically because macOS runs the
 * AirPlay Receiver there by default - the resulting EADDRINUSE looks like a
 * bug in this app and is not.
 */
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code !== "EADDRINUSE") throw err;

  console.error(`Port ${env.port} is already in use.`);
  if (env.port === 5000) {
    console.error(
      "  On macOS, port 5000 is the AirPlay Receiver. Set PORT=5050 in " +
        "backend/.env, or disable it in System Settings > General > AirDrop & Handoff."
    );
  }
  console.error("  Free the port, or set a different PORT in backend/.env.");
  process.exit(1);
});

server.listen(env.port, () => {
  console.log(`FarmSense backend listening on port ${env.port}`);

  // Surface degraded integrations at boot. Each of these silently lowers the
  // quality of every recommendation the system makes, so it should not take
  // reading the code to discover one is missing.
  if (!env.aiServiceToken) {
    console.warn("  AI_SERVICE_TOKEN unset - disease detection is disabled.");
  }
  if (!isR2Configured()) {
    console.warn("  R2 unconfigured - crop photos will not be stored.");
  }
  if (!isCdseConfigured()) {
    console.warn(
      "  CDSE unconfigured - no satellite correction; crop states will report low confidence."
    );
  }
});
