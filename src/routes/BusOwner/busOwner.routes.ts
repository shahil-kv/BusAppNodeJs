import { Router } from "express";
import {
  BusOwnerRegistration,
  GetBusOwners,
  loginBusOwner,
} from "../../controllers/BusOwner/busOwner.controller";
import {
  busOwnerLoginValidator,
  busOwnerRegisteration,
} from "../../validators/BusOwner/BusOwner.validate";
import { validate } from "../../validators/validate";
const router = Router();

// unsecured routes

/**
 * @swagger
 * /bus-owner/bus-owners:
 *   get:
 *     summary: Retrieve a list of bus owners
 *     tags: [BusOwner]
 *     responses:
 *       200:
 *         description: A list of bus owners.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object # Define structure based on GetBusOwners response
 *       500:
 *         description: Internal server error
 */
router.route("/bus-owners").get(GetBusOwners);

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
  .route("/register-busowner")
  .post(busOwnerRegisteration(), validate, BusOwnerRegistration);

/**
 * @swagger
 * /bus-owner/login-busowner:
 *   post:
 *     summary: Login a bus owner
 *     tags: [BusOwner]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               # Define properties based on busOwnerLoginValidator
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful, returns user info and tokens.
 *       400:
 *         description: Invalid credentials or input data.
 *       401:
 *         description: Unauthorized (wrong password).
 *       404:
 *         description: User not found.
 *       500:
 *         description: Internal server error
 */
router
  .route("/login-busowner")
  .post(busOwnerLoginValidator(), validate, loginBusOwner);

export default router;
