import { Router } from 'express';
import { validate } from '../validators/validate';
import { GetDashboard } from '../controllers/home.controller';

const router = Router();

/**
 * @swagger
 * /group/manage-group:
 *   post:
 *     tags: [Group]
 *     summary: Manage group
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               members: { type: array, items: { type: string } }
 */
router
    .route("/get-dashboard")
    .get(validate, GetDashboard);

export default router;