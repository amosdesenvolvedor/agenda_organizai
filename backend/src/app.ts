import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { openApiDocument } from "./docs/openapi.js";
import { errorHandler } from "./middleware/error.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { attachmentRouter } from "./modules/attachments/attachment.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { calendarRouter } from "./modules/calendar/calendar.routes.js";
import { eventRouter } from "./modules/events/event.routes.js";
import { notificationRouter } from "./modules/notifications/notification.routes.js";
import { taskRouter } from "./modules/tasks/task.routes.js";

export const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: env.APP_URL, credentials: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

app.get("/health", (_req, res) => res.json({ status: "ok", service: "agenda-organizai-api" }));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.use("/api/auth", authRouter);
app.use("/api/calendars", calendarRouter);
app.use("/api/events", eventRouter);
app.use("/api/tasks", taskRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/admin", adminRouter);
app.use("/api/attachments", attachmentRouter);
app.use(errorHandler);
