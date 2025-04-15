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
 *                 description: Operation mode (INSERT, UPDATE, or DELETE).
 *               busOwnerId:
 *                 type: integer
 *                 description: Required for INSERT. ID of the bus owner.
 *               registrationNumber:
 *                 type: string
 *                 description: Required for INSERT, optional for UPDATE. Bus registration number (3-100 chars).
 *               model:
 *                 type: string
 *                 description: Optional for INSERT/UPDATE. Bus model (max 100 chars).
 *               capacity:
 *                 type: integer
 *                 description: Optional for INSERT/UPDATE. Bus seating capacity (positive integer).
 *               busIdToModify:
 *                 type: integer
 *                 description: Required for UPDATE/DELETE. ID of the bus to modify or delete.
 *               routes:
 *                 type: array
 *                 description: Optional for INSERT/UPDATE. Array of route objects. If provided null or empty array for UPDATE, existing routes will be deleted.
 *                 items:
 *                   type: object
 *                   properties:
 *                     sequence_order:
 *                       type: integer
 *                       description: Required. Non-negative integer defining the route sequence. Must be unique within the array.
 *                     from_location:
 *                       type: string
 *                       description: Required. Starting location of the route segment (max 255 chars).
 *                     to_location:
 *                       type: string
 *                       description: Required. Ending location of the route segment (max 255 chars).
 *                     location_name:
 *                       type: string
 *                       description: Optional. Name of the stop/location (max 255 chars).
 *                     start_time:
 *                       type: string
 *                       format: time
 *                       description: Optional. Start time for the segment (HH:MM or HH:MM:SS).
 *                     end_time:
 *                       type: string
 *                       format: time
 *                       description: Optional. End time for the segment (HH:MM or HH:MM:SS).
 *             required:
 *               - opsMode # Other fields are conditionally required based on opsMode
 *     responses:
 *       200:
 *         description: Bus operation successful (Inserted, Updated, or Deleted).
 *       201:
 *         description: Bus created successfully (for INSERT opsMode).
 *       400:
 *         description: Invalid input data or validation error.
 *       404:
 *         description: Bus or Bus Owner not found (relevant for UPDATE/DELETE).
 *       500:
 *         description: Internal server error.
 */
router.route("/manage-bus").post(manageBusValidation(), validate, manageBus);

router
  .route("/get-owner-dashboard")
  .get(GetBusOwnerDashboardValidation(), validate, GetBusOwnersDashboard);
export default router;
