import pino from "pino";
import { isProd } from "./env";

let prettyAvailable = false;
if (!isProd) {
  try {
    require.resolve("pino-pretty");
    prettyAvailable = true;
  } catch {
    prettyAvailable = false;
  }
}

export const logger = pino({
  level: isProd ? "info" : "debug",
  transport: prettyAvailable ? { target: "pino-pretty", options: { colorize: true } } : undefined,
});