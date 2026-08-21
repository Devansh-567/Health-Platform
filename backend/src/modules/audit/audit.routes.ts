import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate } from "../../middlewares/authenticate";
import { requireRole } from "../../middlewares/rbac";
import { validate } from "../../middlewares/validate";
import { prisma } from "../../config/prisma";

const router = Router();

const listSchema = z.object({
  query: z.object({
    userId: z.string().uuid().optional(),
    action: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
  }),
});

// Audit logs are restricted to SUPER_ADMIN specifically — enforced by role
// rather than by permission so a per-user permission override can never
// widen access to them.
router.use(authenticate, requireRole("SUPER_ADMIN"));

router.get("/", validate(listSchema), asyncHandler(async (req, res) => {
  const { userId, action, page, pageSize } = req.query as any;
  const where: any = {};
  if (userId) where.userId = userId;
  if (action) where.action = { contains: action, mode: "insensitive" };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ success: true, data: { items, total, page: Number(page), pageSize: Number(pageSize) } });
}));

export default router;