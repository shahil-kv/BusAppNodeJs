import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import twilio from "twilio";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { CallStatusEnum, SessionStatusEnum } from "../constant";
import { Server } from "socket.io";

const prisma = new PrismaClient();
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
  { lazyLoading: true } // Enable lazy loading to reduce initial connection overhead
);
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
const CALL_TIMEOUT_SECONDS = 60;

const NGROK_BASE_URL = "https://6811-103-165-167-98.ngrok-free.app"; // Replace with your actual Ngrok URL

const startCalls = asyncHandler(async (req: Request, res: Response) => {
  const { userId, groupId, groupType, contacts, messageContent } = req.body;
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
  let group = null;

  if (numericGroupId === 0 && groupType === "MANUAL") {
    group = await prisma.groups.create({
      data: {
        user_id: numericUserId,
        group_name: `Manual Call - ${new Date().toISOString()}`,
        group_type: "MANUAL",
        description: "Manual call group created for one-time call session",
        contacts: {
          create: contacts.map(({ name, phoneNumber }) => ({
            name,
            phone_number: phoneNumber,
          })),
        },
      },
      include: { contacts: true },
    });
  } else if (numericGroupId && numericGroupId > 0) {
    group = await prisma.groups.findUnique({
      where: { id: numericGroupId },
      include: { contacts: true },
    });

    if (!group) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Group not found"));
    }
  }

  if (group) {
    targetGroupId = group.id;
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

  // Batch create call history entries to reduce database round-trips
  await prisma.call_history.createMany({
    data: contactsToCall.map((contact) => ({
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
    })),
  });

  await initiateNextCall(session.id, req);
  return res
    .status(200)
    .json(
      new ApiResponse(200, { sessionId: session.id }, "Call session started")
    );
});

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

  const activeCalls = await prisma.call_history.findMany({
    where: {
      session_id: numericSessionId,
      status: CallStatusEnum.IN_PROGRESS,
    },
  });

  for (const call of activeCalls) {
    if (call.call_sid) {
      try {
        await client.calls(call.call_sid).update({ status: "completed" });
        await prisma.call_history.update({
          where: { id: call.id },
          data: {
            status: CallStatusEnum.DECLINED,
            ended_at: new Date(),
            updated_at: new Date(),
          },
        });
      } catch (error) {
        console.error(`Failed to terminate call ${call.call_sid}:`, error);
      }
    }
  }

  await prisma.call_session.update({
    where: { id: numericSessionId },
    data: {
      status: SessionStatusEnum.STOPPED,
      updated_at: new Date(),
    },
  });

  const io = req.app.get("io") as Server;
  io.emit("callStatusUpdate", {
    sessionId: numericSessionId,
    status: SessionStatusEnum.STOPPED,
    currentIndex: session.current_index,
    totalCalls: session.total_calls,
    currentContact: null,
    attempt: 0,
  });

  return res.status(200).json(new ApiResponse(200, null, "Session stopped"));
});

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

const callStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const { CallSid, CallStatus, CallDuration, AnsweredBy } = req.body;

  if (!req.body || Object.keys(req.body).length === 0) {
    console.error("Empty body received in callStatusHandler");
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

  await prisma.call_session.update({
    where: { id: callHistory.session_id },
    data: {
      successful_calls: { increment: isSuccessful ? 1 : 0 },
      failed_calls: { increment: !isSuccessful ? 1 : 0 },
      updated_at: new Date(),
    },
  });

  const session = await prisma.call_session.findUnique({
    where: { id: callHistory.session_id },
  });

  const contacts = session.contacts as {
    id?: string;
    name: string;
    phoneNumber: string;
  }[];
  const currentContact = contacts[session.current_index] || null;

  const io = req.app.get("io") as Server;
  io.emit("callStatusUpdate", {
    sessionId: callHistory.session_id,
    status: session.status,
    currentIndex: session.current_index,
    totalCalls: session.total_calls,
    currentContact: currentContact
      ? { name: currentContact.name, phoneNumber: currentContact.phoneNumber }
      : null,
    attempt: callHistory.attempt,
  });

  io.emit("callHistoryUpdate", {
    sessionId: callHistory.session_id,
    callHistory: {
      id: callHistory.id,
      contact_phone: callHistory.contact_phone,
      status: mappedStatus,
      attempt: callHistory.attempt,
      duration: CallDuration ? parseInt(CallDuration) : null,
      ended_at: new Date().toISOString(),
    },
  });

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
        timeout: 120, // Increase Twilio timeout to 120 seconds
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

      io.emit("callStatusUpdate", {
        sessionId: callHistory.session_id,
        status: session.status,
        currentIndex: session.current_index,
        totalCalls: session.total_calls,
        currentContact: currentContact
          ? {
              name: currentContact.name,
              phoneNumber: currentContact.phoneNumber,
            }
          : null,
        attempt: newAttempt,
      });
    } catch (error) {
      console.error("Failed to retry call:", error);
      await prisma.call_history.update({
        where: { id: callHistory.id },
        data: {
          status: CallStatusEnum.FAILED,
          error_message: error.message || "Failed to retry call",
          updated_at: new Date(),
        },
      });
      await initiateNextCall(callHistory.session_id, req);
    }
  } else {
    if (session.status === SessionStatusEnum.IN_PROGRESS) {
      await prisma.call_session.update({
        where: { id: callHistory.session_id },
        data: {
          current_index: { increment: 1 },
          updated_at: new Date(),
        },
      });
      await initiateNextCall(callHistory.session_id, req);
    }

    if (session.current_index >= session.total_calls - 1) {
      const activeCalls = await prisma.call_history.findMany({
        where: {
          session_id: callHistory.session_id,
          status: CallStatusEnum.IN_PROGRESS,
        },
      });

      for (const call of activeCalls) {
        if (call.call_sid) {
          try {
            await client.calls(call.call_sid).update({ status: "completed" });
            await prisma.call_history.update({
              where: { id: call.id },
              data: {
                status: CallStatusEnum.DECLINED,
                ended_at: new Date(),
                updated_at: new Date(),
              },
            });
          } catch (error) {
            console.error(`Failed to terminate call ${call.call_sid}:`, error);
          }
        }
      }

      await prisma.call_session.update({
        where: { id: callHistory.session_id },
        data: {
          status: SessionStatusEnum.COMPLETED,
          updated_at: new Date(),
        },
      });

      io.emit("callStatusUpdate", {
        sessionId: callHistory.session_id,
        status: SessionStatusEnum.COMPLETED,
        currentIndex: session.current_index + 1,
        totalCalls: session.total_calls,
        currentContact: null,
        attempt: 0,
      });
    }
  }
  res.sendStatus(200);
});

const initiateNextCall = async (sessionId: number, req: Request) => {
  const session = await prisma.call_session.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    console.error(`initiateNextCall: Session ${sessionId} not found`);
    return;
  }

  if (session.status !== SessionStatusEnum.IN_PROGRESS) {
    console.log(`initiateNextCall: Session ${sessionId} is not in progress`);
    return;
  }

  const contacts = session.contacts as {
    id?: string;
    name: string;
    phoneNumber: string;
  }[];
  const currentIndex = session.current_index;
  if (currentIndex >= contacts.length) {
    const activeCalls = await prisma.call_history.findMany({
      where: {
        session_id: sessionId,
        status: CallStatusEnum.IN_PROGRESS,
      },
    });

    for (const call of activeCalls) {
      if (call.call_sid) {
        try {
          await client.calls(call.call_sid).update({ status: "completed" });
          await prisma.call_history.update({
            where: { id: call.id },
            data: {
              status: CallStatusEnum.DECLINED,
              ended_at: new Date(),
              updated_at: new Date(),
            },
          });
        } catch (error) {
          console.error(`Failed to terminate call ${call.call_sid}:`, error);
        }
      }
    }

    await prisma.call_session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatusEnum.COMPLETED,
        updated_at: new Date(),
      },
    });

    const io = req.app.get("io") as Server;
    io.emit("callStatusUpdate", {
      sessionId,
      status: SessionStatusEnum.COMPLETED,
      currentIndex,
      totalCalls: session.total_calls,
      currentContact: null,
      attempt: 0,
    });
    return;
  }

  const contact = contacts[currentIndex];
  const callHistory = await prisma.call_history.findFirst({
    where: {
      session_id: sessionId,
      contact_phone: contact.phoneNumber,
      status: { in: [CallStatusEnum.PENDING, CallStatusEnum.IN_PROGRESS] },
    },
  });

  if (!callHistory) {
    console.warn(
      `initiateNextCall: No call history found for contact ${contact.phoneNumber}`
    );
    await prisma.call_session.update({
      where: { id: sessionId },
      data: {
        current_index: { increment: 1 },
        updated_at: new Date(),
      },
    });
    await initiateNextCall(sessionId, req);
    return;
  }

  if (callHistory.status === CallStatusEnum.IN_PROGRESS) {
    const callStartTime = new Date(callHistory.called_at).getTime();
    const currentTime = new Date().getTime();
    const elapsedSeconds = (currentTime - callStartTime) / 1000;

    if (elapsedSeconds > CALL_TIMEOUT_SECONDS) {
      console.error(
        `initiateNextCall: Call ${callHistory.id} timed out after ${elapsedSeconds}s`
      );
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
      await prisma.call_session.update({
        where: { id: sessionId },
        data: {
          current_index: { increment: 1 },
          updated_at: new Date(),
        },
      });
      await initiateNextCall(sessionId, req);
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
      timeout: 120, // Increase Twilio timeout to 120 seconds
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

    const io = req.app.get("io") as Server;
    io.emit("callStatusUpdate", {
      sessionId,
      status: session.status,
      currentIndex: session.current_index,
      totalCalls: session.total_calls,
      currentContact: {
        name: contact.name,
        phoneNumber: contact.phoneNumber,
      },
      attempt: callHistory.attempt,
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

    await initiateNextCall(sessionId, req);
  }
};

export {
  startCalls,
  stopSession,
  getCallHistory,
  voiceHandler,
  callStatusHandler,
};
