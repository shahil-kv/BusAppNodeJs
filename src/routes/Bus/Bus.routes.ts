import { Router } from "express";
import {
  GetBusOwnersDashboard,
  manageBus,
} from "../../controllers/Bus/bus.controller";
import {
  GetBusOwnerDashboardValidation,
  manageBusValidation,
} from "../../validators/bus/Bus.validate";
import { validate } from "../../validators/validate";
const router = Router();

// unsecured routes

/**
 * @swagger
 * /bus/manage-bus:
 *   post:
 *     summary: Manage bus details (Insert, Update, Delete)
 *     tags: [Bus]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               opsMode:
 *                 type: string
 *                 enum: [INSERT, UPDATE, DELETE]
 *               busOwnerId:
 *                 type: integer
 *               registrationNumber:
 *                 type: string
 *               model:
 *                 type: string
 *               capacity:
 *                 type: integer
 *               busIdToModify:
 *                 type: integer
 *               routes:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     sequence_order:
 *                       type: integer
 *                     from_location:
 *                       type: string
 *                     to_location:
 *                       type: string
 *                     location_name:
 *                       type: string
 *                     start_time:
 *                       type: string
 *                     end_time:
 *                       type: string
 *     responses:
 *       200:
 *         description: Bus operation successful
 *       201:
 *         description: Bus created successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Bus or Bus Owner not found
 *       500:
 *         description: Internal server error
 */
router.route("/manage-bus").post(manageBusValidation(), validate, manageBus);

/**
 * @swagger
 * /bus/get-owner-dashboard:
 *   get:
 *     summary: Get dashboard data for a specific bus owner
 *     tags: [Bus]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ownerId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Successfully retrieved owner dashboard data
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Owner data not found
 *       500:
 *         description: Internal server error
 */
router
  .route("/get-owner-dashboard")
  .get(GetBusOwnerDashboardValidation(), validate, GetBusOwnersDashboard);

export default router;
