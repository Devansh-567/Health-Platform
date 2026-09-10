import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { env, isProd } from "./config/env";
import { logger } from "./config/logger";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";

import authRoutes from "./modules/auth/auth.routes";
import usersRoutes from "./modules/users/users.routes";
import rolesRoutes from "./modules/roles/roles.routes";
import invitationsRoutes from "./modules/invitations/invitations.routes";
import patientsRoutes from "./modules/patients/patients.routes";
import auditRoutes from "./modules/audit/audit.routes";
import hospitalsRoutes from "./modules/hospitals/hospitals.routes";
import assignmentsRoutes from "./modules/assignments/assignments.routes";
import transfersRoutes from "./modules/transfers/transfers.routes";
import ambulancesRoutes from "./modules/ambulances/ambulances.routes";
import tripsRoutes from "./modules/trips/trips.routes";
import emergencyRoutes from "./modules/emergency/emergency.routes";
import appointmentsRoutes from "./modules/appointments/appointments.routes";
import clinicalRoutes from "./modules/clinical/clinical.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import profileRoutes from "./modules/profile/profile.routes";

export const app = express();

// Render (like most PaaS hosts) sits the app behind its own reverse proxy,
// so every request arrives with X-Forwarded-For/X-Forwarded-Proto set by
// that proxy, not by the actual client. Without this, Express treats the
// proxy's own connection as "the client" — express-rate-limit refuses to
// trust X-Forwarded-For at all in that case (logged as a startup-adjacent
// ValidationError) and effectively rate-limits by the proxy's IP instead of
// each real visitor's, and `secure: isProd` on the refresh cookie also
// depends on Express correctly seeing X-Forwarded-Proto: https here.
// "1" trusts exactly one hop (Render's own proxy) rather than an
// unbounded chain, which is the right setting for this specific host.
app.set("trust proxy", 1);

app.use(
  helmet({
    // Helmet's default CSP only allows 'self' everywhere, which would
    // silently break two of this app's core features once it starts
    // serving the built frontend itself: Leaflet's map tile images (loaded
    // from OpenStreetMap, not this origin) and the browser's direct
    // MQTT-over-WebSocket connection to HiveMQ Cloud for live vitals/
    // alarms. styleSrc allows 'unsafe-inline' because React's inline
    // `style={{...}}` props render as literal style="" attributes, which
    // CSP's style-src otherwise blocks regardless of where the JS came from.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
        fontSrc: ["'self'", "data:", "https:"],
        objectSrc: ["'none'"],
      },
    },
  })
);
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(pinoHttp({ logger, autoLogging: env.NODE_ENV !== "test" }));

app.get("/health", (_req, res) => res.json({ success: true, status: "ok", time: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/invitations", invitationsRoutes);
app.use("/api/patients", patientsRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/hospitals", hospitalsRoutes);
app.use("/api/assignments", assignmentsRoutes);
app.use("/api/transfers", transfersRoutes);
app.use("/api/ambulances", ambulancesRoutes);
app.use("/api/trips", tripsRoutes);
app.use("/api/emergency-cases", emergencyRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/clinical", clinicalRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/profile", profileRoutes);

// Serves the built frontend (see Dockerfile — vite build output is copied
// to backend/public at image build time) so the whole app is one origin:
// no CORS, and the auth refresh cookie's sameSite=strict just works, since
// there's no second domain for the browser to treat as cross-site. Only
// active when the build actually exists (i.e. in the combined-deploy
// production image) — local dev keeps using the Vite dev server on its own
// port with the proxy in frontend/vite.config.ts.
const clientDist = path.join(__dirname, "public");
if (isProd && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);