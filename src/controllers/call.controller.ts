import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import twilio from "twilio";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { CallStatusEnum, SessionStatusEnum } from "src/constant";

const prisma = new PrismaClient();
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
const CALL_TIMEOUT_SECONDS = 60; // Timeout for calls in seconds

// Base ngrok URL from your ngrok output
// get server url
const NGROK_BASE_URL = "https://6811-103-165-167-98.ngrok-free.app";
// const NGROK_BASE_URL = process.env.API_URL;

// Initiates a new call session
const startCalls = asyncHandler(async (req: Request, res: Response) => {
  const { userId, groupId, groupType, contacts, messageContent } = req.body;
  // Validate inputs
  const numericUserId = parseInt(userId, 10);
  const numericGroupId = groupId != null ? parseInt(groupId, 10) : null;
  if (isNaN(numericUserId)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid user ID format"));
  }
  if (groupId != null && isNaN(numericGroupId)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid group ID format"));
  }
  if (!contacts && !groupId) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Contacts or group ID required"));
  }
  if (!messageContent) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Message content required"));
  }

  let contactsToCall: { id?: string; name: string; phoneNumber: string }[] = [];
  let targetGroupId: number | null = numericGroupId;

  // Handle group-based or manual contacts
  if (numericGroupId === 0 && groupType === "MANUAL") {
    const manualGroup = await prisma.groups.create({
      data: {
        user_id: numericUserId,
        group_name: `Manual Call - ${new Date().toISOString()}`,
        group_type: "MANUAL",
        description: "Manual call group created for one-time call session",
        contacts: {
          create: contacts.map(
            (contact: { name: string; phoneNumber: string }) => ({
              name: contact.name,
              phone_number: contact.phoneNumber,
            })
          ),
        },
      },
      include: { contacts: true },
    });
    targetGroupId = manualGroup.id;
    contactsToCall = manualGroup.contacts.map((c) => ({
      id: c.id.toString(),
      name: c.name,
      phoneNumber: c.phone_number,
    }));
  } else if (numericGroupId && numericGroupId > 0) {
    const group = await prisma.groups.findUnique({
      where: { id: numericGroupId },
      include: { contacts: true },
    });
    if (!group) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Group not found"));
    }
    targetGroupId = numericGroupId;
    contactsToCall = group.contacts.map((c) => ({
      id: c.id.toString(),
      name: c.name,
      phoneNumber: c.phone_number,
    }));
  } else {
    contactsToCall = contacts.map((c) => ({
      id: c.id,
      name: c.name,
      phoneNumber: c.phoneNumber,
    }));
    targetGroupId = numericGroupId;
  }

  // Check premium limit
  const user = await prisma.users.findUnique({
    where: { id: numericUserId },
  });
  if (!user) {
    return res.status(404).json(new ApiResponse(404, null, "User not found"));
  }
  const isPremium = user.is_premium ?? false;
  const contactLimit = isPremium ? 500 : 50;
  if (contactsToCall.length > contactLimit) {
    return res
      .status(400)
      .json(
        new ApiResponse(
          400,
          null,
          `Contact limit exceeded. ${
            isPremium ? "Premium" : "Free"
          } users can call up to ${contactLimit} contacts.`
        )
      );
  }

  // Create call session
  const session = await prisma.call_session.create({
    data: {
      user_id: numericUserId,
      group_id: targetGroupId,
      contacts: contactsToCall,
      status: SessionStatusEnum.IN_PROGRESS,
      total_calls: contactsToCall.length,
      successful_calls: 0,
      failed_calls: 0,
      updated_at: new Date(),
    },
  });
  // Create call history for each contact
  for (const contact of contactsToCall) {
    await prisma.call_history.create({
      data: {
        session_id: session.id,
        user_id: numericUserId,
        group_id: targetGroupId,
        contact_id: contact.id ? parseInt(contact.id) : null,
        contact_phone: contact.phoneNumber,
        status: CallStatusEnum.PENDING,
        attempt: 1,
        max_attempts: 2,
        message_content: messageContent,
        called_at: new Date(),
        updated_at: new Date(),
      },
    });
  }

  // Initiate first call
  await initiateNextCall(session.id);
  return res
    .status(200)
    .json(
      new ApiResponse(200, { sessionId: session.id }, "Call session started")
    );
});

// Stops an ongoing call session
const stopSession = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.body;
  const numericSessionId = parseInt(sessionId, 10);
  if (isNaN(numericSessionId)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid session ID format"));
  }

  const session = await prisma.call_session.findUnique({
    where: { id: numericSessionId },
  });
  if (!session) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Session not found"));
  }

  await prisma.call_session.update({
    where: { id: numericSessionId },
    data: {
      status: SessionStatusEnum.STOPPED,
      updated_at: new Date(),
    },
  });

  return res.status(200).json(new ApiResponse(200, null, "Session stopped"));
});

// Fetches call history for analytics
const getCallHistory = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.query;
  const numericSessionId = parseInt(sessionId as string, 10);
  if (isNaN(numericSessionId)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid session ID format"));
  }

  const history = await prisma.call_history.findMany({
    where: { session_id: numericSessionId },
    include: { contacts: true },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, history, "Call history retrieved"));
});

// Generates TwiML for call flow
const voiceHandler = asyncHandler(async (req: Request, res: Response) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const { messageContent } = req.query;

  if (messageContent) {
    twiml.say({ voice: "alice" }, decodeURIComponent(messageContent as string));
  } else {
    twiml.say({ voice: "alice" }, "There is a meeting tomorrow.");
  }

  twiml.hangup();
  res.type("text/xml");
  res.send(twiml.toString());
});

// Handles Twilio status callbacks
const callStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const { CallSid, CallStatus, CallDuration, AnsweredBy } = req.body;

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      message: "Empty body received. Check express.urlencoded() middleware.",
    });
  }

  const callHistory = await prisma.call_history.findFirst({
    where: { call_sid: CallSid },
    include: { call_session: true },
  });

  if (!callHistory || !callHistory.call_session) {
    console.warn(
      `callStatusHandler: No call_history found for CallSid: ${CallSid}`
    );
    return res.sendStatus(200);
  }

  let mappedStatus;
  let isSuccessful = false;
  switch (CallStatus) {
    case "completed":
      mappedStatus = CallStatusEnum.ACCEPTED;
      isSuccessful = true;
      break;
    case "no-answer":
      mappedStatus = CallStatusEnum.MISSED;
      break;
    case "busy":
      mappedStatus = CallStatusEnum.DECLINED;
      break;
    case "failed":
      mappedStatus = CallStatusEnum.FAILED;
      break;
    default:
      mappedStatus = CallStatusEnum.FAILED;
  }

  // Update call history
  await prisma.call_history.update({
    where: { id: callHistory.id },
    data: {
      status: mappedStatus,
      answered_at: AnsweredBy ? new Date() : null,
      ended_at: new Date(),
      duration: CallDuration ? parseInt(CallDuration) : null,
      updated_at: new Date(),
    },
  });

  // Update session stats
  await prisma.call_session.update({
    where: { id: callHistory.session_id },
    data: {
      successful_calls: { increment: isSuccessful ? 1 : 0 },
      failed_calls: { increment: !isSuccessful ? 1 : 0 },
      updated_at: new Date(),
    },
  });

  // Retry logic for missed calls
  if (
    CallStatus === "no-answer" &&
    callHistory.attempt < callHistory.max_attempts
  ) {
    const newAttempt = callHistory.attempt + 1;
    try {
      const statusCallbackUrl = `${NGROK_BASE_URL}/call-status`;
      const newCall = await client.calls.create({
        url: `${NGROK_BASE_URL}/voice?messageContent=${encodeURIComponent(
          callHistory.message_content || ""
        )}`,
        to: callHistory.contact_phone,
        from: twilioNumber,
        statusCallback: statusCallbackUrl,
        statusCallbackMethod: "POST",
      });

      await prisma.call_history.create({
        data: {
          session_id: callHistory.session_id,
          user_id: callHistory.user_id,
          group_id: callHistory.group_id,
          contact_id: callHistory.contact_id,
          contact_phone: callHistory.contact_phone,
          status: CallStatusEnum.IN_PROGRESS,
          call_sid: newCall.sid,
          attempt: newAttempt,
          max_attempts: callHistory.max_attempts,
          message_content: callHistory.message_content,
          called_at: new Date(),
          updated_at: new Date(),
        },
      });
    } catch (error) {
      await prisma.call_history.update({
        where: { id: callHistory.id },
        data: {
          status: CallStatusEnum.FAILED,
          error_message: error.message || "Failed to retry call",
          updated_at: new Date(),
        },
      });
      await initiateNextCall(callHistory.session_id);
    }
  } else {
    // Proceed to next call if session is still in progress
    if (callHistory.call_session.status === SessionStatusEnum.IN_PROGRESS) {
      await prisma.call_session.update({
        where: { id: callHistory.session_id },
        data: {
          current_index: { increment: 1 },
          updated_at: new Date(),
        },
      });
      await initiateNextCall(callHistory.session_id);
    }
    // Check if all calls are complete
    const session = await prisma.call_session.findUnique({
      where: { id: callHistory.session_id },
    });
    if (session.current_index >= session.total_calls - 1) {
      await prisma.call_session.update({
        where: { id: callHistory.session_id },
        data: {
          status: SessionStatusEnum.COMPLETED,
          updated_at: new Date(),
        },
      });
    }
  }
  res.sendStatus(200);
});

// Helper function to initiate the next call in sequence
const initiateNextCall = async (sessionId: number) => {
  const session = await prisma.call_session.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return;
  }

  if (session.status !== SessionStatusEnum.IN_PROGRESS) {
    return;
  }

  const contacts = session.contacts as {
    id?: string;
    name: string;
    phoneNumber: string;
  }[];
  const currentIndex = session.current_index;
  if (currentIndex >= contacts.length) {
    await prisma.call_session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatusEnum.COMPLETED,
        updated_at: new Date(),
      },
    });
    return;
  }
  const contact = contacts[currentIndex];
  // Find the call_history record for this contact
  const callHistory = await prisma.call_history.findFirst({
    where: {
      session_id: sessionId,
      contact_phone: contact.phoneNumber,
      status: { in: [CallStatusEnum.PENDING, CallStatusEnum.IN_PROGRESS] },
    },
  });

  if (!callHistory) {
    // Increment index and try the next contact
    await prisma.call_session.update({
      where: { id: sessionId },
      data: {
        current_index: { increment: 1 },
        updated_at: new Date(),
      },
    });
    await initiateNextCall(sessionId);
    return;
  }

  // If the call is already in progress, set a timeout to mark it as failed if no callback is received
  if (callHistory.status === CallStatusEnum.IN_PROGRESS) {
    const callStartTime = new Date(callHistory.called_at).getTime();
    const currentTime = new Date().getTime();
    const elapsedSeconds = (currentTime - callStartTime) / 1000;

    if (elapsedSeconds > CALL_TIMEOUT_SECONDS) {
      await prisma.call_history.update({
        where: { id: callHistory.id },
        data: {
          status: CallStatusEnum.FAILED,
          error_message: "Call timed out: No status callback received",
          updated_at: new Date(),
        },
      });
      await prisma.call_session.update({
        where: { id: sessionId },
        data: {
          failed_calls: { increment: 1 },
          updated_at: new Date(),
        },
      });
      // Proceed to the next contact
      await prisma.call_session.update({
        where: { id: sessionId },
        data: {
          current_index: { increment: 1 },
          updated_at: new Date(),
        },
      });
      await initiateNextCall(sessionId);
    }
    return;
  }

  try {
    const statusCallbackUrl = `${NGROK_BASE_URL}/call-status`;
    const call = await client.calls.create({
      url: `${NGROK_BASE_URL}/voice?messageContent=${encodeURIComponent(
        callHistory.message_content || ""
      )}`,
      to: contact.phoneNumber,
      from: twilioNumber,
      statusCallback: statusCallbackUrl,
      statusCallbackMethod: "POST",
    });

    await prisma.call_history.update({
      where: { id: callHistory.id },
      data: {
        call_sid: call.sid,
        status: CallStatusEnum.IN_PROGRESS,
        called_at: new Date(),
        updated_at: new Date(),
      },
    });
  } catch (error) {
    console.error(
      `initiateNextCall: Error initiating call to ${contact.phoneNumber}:`,
      error
    );
    await prisma.call_history.update({
      where: { id: callHistory.id },
      data: {
        status: CallStatusEnum.FAILED,
        error_message: error.message || "Failed to initiate call",
        updated_at: new Date(),
      },
    });
    await prisma.call_session.update({
      where: { id: sessionId },
      data: {
        failed_calls: { increment: 1 },
        updated_at: new Date(),
      },
    });

    // Proceed to the next contact
    await prisma.call_session.update({
      where: { id: sessionId },
      data: {
        current_index: { increment: 1 },
        updated_at: new Date(),
      },
    });
    await initiateNextCall(sessionId);
  }
};

export {
  startCalls,
  stopSession,
  getCallHistory,
  voiceHandler,
  callStatusHandler,
};
