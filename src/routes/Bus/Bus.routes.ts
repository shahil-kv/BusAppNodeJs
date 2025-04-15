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
 *                 minimum: 1
 *                 description: The ID of the bus owner whose dashboard data is to be retrieved.
 *             required:
 *               - ownerId
 *     responses:
 *       200:
 *         description: Successfully retrieved owner dashboard data.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     BusList:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           bus_id:
 *                             type: integer
 *                           registration_number:
 *                             type: string
 *                           model:
 *                             type: string
 *                           capacity:
 *                             type: integer
 *                           bus_created_at:
 *                             type: string
 *                             format: date-time
 *                           bus_updated_at:
 *                             type: string
 *                             format: date-time
 *                           routes:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 route_id:
 *                                   type: integer
 *                                 sequence_order:
 *                                   type: integer
 *                                 # Add other known route fields if necessary
 *                                 start_time:
 *                                   type: string
 *                                   format: time
 *                                 end_time:
 *                                   type: string
 *                                   format: time
 *                                 route_created_at:
 *                                   type: string
 *                                   format: date-time
 *                                 route_updated_at:
 *                                   type: string
 *                                   format: date-time
 *                     reports:
 *                       type: object
 *                       properties:
 *                         reportList:
 *                           type: array
 *                           items:
 *                             type: object # Define specific report structure if known, otherwise generic object
 *                           description: List of reports (structure TBD).
 *                         summaryMetrics:
 *                           type: object
 *                           properties:
 *                             totalBusesOperated:
 *                               type: integer
 *                             activeRoutesReported:
 *                               type: integer
 *                             totalDistanceCoveredToday:
 *                               type: number # Assuming distance can be decimal
 *                             totalRevenueReportedToday:
 *                               type: number # Assuming revenue can be decimal
 *                             metricsLastUpdated:
 *                               type: string
 *                               format: date-time
 *                 message:
 *                   type: string
 *                   example: "Successfully retrieved operational data for owner ID 1."
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Invalid input data (e.g., non-integer ownerId).
 *       404:
 *         description: Owner data not found for the provided ownerId.
 *       500:
 *         description: Internal server error.
 */
router.route("/get-owner-dashboard").get(validate, GetBusOwnersDashboard);

export default router;
