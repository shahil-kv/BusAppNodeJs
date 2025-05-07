import { Router } from 'express';
import { validate } from '../validators/validate';
import { validateManageGroup } from '../validators/group.validators';
import { manageGroup } from '../controllers/group.controller';

const router = Router();

/**
 * @swagger
 * /bus-owner/register-busowner:
 *   post:
 *     summary: Register a new bus owner
 *     tags: [BusOwner]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               # Define properties based on busOwnerRegisteration validator
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               # Add other required fields...
 *     responses:
 *       201:
 *         description: Bus owner created successfully.
 *       400:
 *         description: Invalid input data.
 *       500:
 *         description: Internal server error
 */
router
    .route("/manage-group")
    .post(validateManageGroup, validate, manageGroup);

export default router;