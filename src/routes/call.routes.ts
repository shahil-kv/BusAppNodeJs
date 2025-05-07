import { Router } from 'express';
import { validate } from '../validators/validate';
import { validateCall } from '../validators/call.validators';
import { handleCall } from '../controllers/call.controller';

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
    .route("/call_list")
    .post(validateCall, validate, handleCall);

export default router;