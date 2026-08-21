import { Router } from "express";
import * as controller from "./auth.controller";
import { validate } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/authenticate";
import { loginLimiter, forgotPasswordLimiter } from "../../middlewares/rateLimiters";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "./auth.validation";

const router = Router();

// No public registration: every account (admin, staff, patient) is created
// by someone with the right permission — see /api/users/admins,
// /api/invitations (doctor/nurse), and /api/patients. This is the only
// public, unauthenticated entry point into the app.
router.post("/login", loginLimiter, validate(loginSchema), controller.login);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);
router.post("/forgot-password", forgotPasswordLimiter, validate(forgotPasswordSchema), controller.forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), controller.resetPassword);

router.use(authenticate);
router.get("/me", controller.me);
router.post("/change-password", validate(changePasswordSchema), controller.changePassword);

export default router;
