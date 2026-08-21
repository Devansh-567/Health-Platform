import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { env } from "./config/env";
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

app.use(helmet());
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

app.use(notFoundHandler);
app.use(errorHandler);