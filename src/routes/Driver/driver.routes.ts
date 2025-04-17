import { Router } from "express";
import { validate } from "../../validators/validate";
import { RegisterDriver, loginDriver, updateBusLocation } from "../../controllers/Driver/driver.controller";
import { busDriverRegisteration, busDriverLogin, updateBusLocationValidator } from "../../validators/Driver/Driver.validate";

const router = Router()

/**
 * @swagger
 * /driver/register-driver:
 *   post:
 *     summary: Register a new driver
 *     tags: [Driver]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               opsMode:
 *                 type: string
 *                 enum: [INSERT]
 *               fullName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               password:
 *                 type: string
 *               licenseNumber:
 *                 type: string
 *               licenseExpiryDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Driver created successfully
 *       400:
 *         description: Invalid input data
 *       409:
 *         description: Driver already exists
 *       500:
 *         description: Internal server error
 */
router.route(("/register-driver")).post(busDriverRegisteration(), validate, RegisterDriver)

/**
 * @swagger
 * /driver/login-driver:
 *   post:
 *     summary: Login a driver
 *     tags: [Driver]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phoneNumber:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Invalid credentials
 *       404:
 *         description: Driver not found
 *       500:
 *         description: Internal server error
 */
router.route("/login-driver").post(busDriverLogin(), validate, loginDriver)

/**
 * @swagger
 * /driver/update-bus-location:
 *   post:
 *     summary: Update bus location and details
 *     tags: [Driver]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               busId:
 *                 type: integer
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               kilometersAdded:
 *                 type: number
 *               isMoving:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Bus location updated successfully
 *       400:
 *         description: Invalid input data
 *       500:
 *         description: Internal server error
 */
router.route("/update-bus-location").post(updateBusLocationValidator(), validate, updateBusLocation);

export default router;