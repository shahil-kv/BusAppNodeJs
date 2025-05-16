import { Router } from "express";
import { validate } from "../validators/validate";
import { validateCall } from "../validators/call.validators";
import {
  startCalls,
  stopSession,
  getCallHistory,
  voiceHandler,
  callStatusHandler,
} from "../controllers/call.controller";

const router = Router();

/**
 * @swagger
 * /call_list:
 *   post:
 *     tags: [Calls]
 *     summary: Start a sequential call session
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId: { type: string, description: "ID of the user initiating the call" }
 *               groupId: { type: integer, description: "ID of the group to call (set to 0 for manual group)" }
 *               groupType: { type: string, enum: ["MANUAL", "USER_DEFINED"], description: "Type of group (MANUAL for manual contact list)" }
 *               contacts: {
 *                 type: array,
 *                 items: {
 *                   type: object,
 *                   properties: {
 *                     id: { type: string },
 *                     name: { type: string },
 *                     phoneNumber: { type: string }
 *                   }
 *                 },
 *                 description: "List of contacts to call (required if groupId is 0)"
 *               }
 *               messageContent: { type: string, description: "Message to be played during the call" }
 *     responses:
 *       200:
 *         description: Call session started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: {
 *                   type: object,
 *                   properties: {
 *                     sessionId: { type: integer, description: "ID of the created call session" }
 *                   }
 *                 }
 *                 message: { type: string }
 *       400:
 *         description: Invalid request
 *       404:
 *         description: User or group not found
 */
router.route("/call_list").post(startCalls);

/**
 * @swagger
 * /call/stop:
 *   post:
 *     tags: [Calls]
 *     summary: Stop an ongoing call session
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionId: { type: integer, description: "ID of the call session to stop" }
 *     responses:
 *       200:
 *         description: Call session stopped successfully
 *       400:
 *         description: Invalid session ID
 *       404:
 *         description: Session not found
 */
router.route("/stop").post(validate, stopSession);

/**
 * @swagger
 * /call/history:
 *   get:
 *     tags: [Calls]
 *     summary: Retrieve call history for a session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID of the call session
 *     responses:
 *       200:
 *         description: Call history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: {
 *                   type: array,
 *                   items: {
 *                     type: object,
 *                     properties: {
 *                       id: { type: integer },
 *                       session_id: { type: integer },
 *                       user_id: { type: integer },
 *                       group_id: { type: integer },
 *                       contact_id: { type: integer },
 *                       contact_phone: { type: string },
 *                       status: { type: string },
 *                       attempt: { type: integer },
 *                       max_attempts: { type: integer },
 *                       message_content: { type: string },
 *                       called_at: { type: string, format: date-time },
 *                       answered_at: { type: string, format: date-time },
 *                       ended_at: { type: string, format: date-time },
 *                       duration: { type: integer },
 *                       error_message: { type: string }
 *                     }
 *                   }
 *                 }
 *                 message: { type: string }
 *       400:
 *         description: Invalid session ID
 */
router.route("/history").get(validate, getCallHistory);

/**
 * @swagger
 * /call/voice:
 *   get:
 *     tags: [Calls]
 *     summary: Generate TwiML for Twilio voice calls (used by Twilio)
 *     parameters:
 *       - in: query
 *         name: messageContent
 *         schema:
 *           type: string
 *         description: Message content to be played during the call
 *     responses:
 *       200:
 *         description: TwiML response for Twilio
 *         content:
 *           text/xml:
 *             schema:
 *               type: string
 */
router.route("/voice").get(voiceHandler);

/**
 * @swagger
 * /call/call-status:
 *   post:
 *     tags: [Calls]
 *     summary: Handle Twilio call status callbacks (used by Twilio)
 *     requestBody:
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               CallSid: { type: string }
 *               CallStatus: { type: string }
 *               CallDuration: { type: string }
 *               AnsweredBy: { type: string }
 *     responses:
 *       200:
 *         description: Status callback processed
 */
router.route("/call-status").post(callStatusHandler);

export default router;
