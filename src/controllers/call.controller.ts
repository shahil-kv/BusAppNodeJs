import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { CallStatusEnum, SessionStatusEnum } from '../constant';
import { initiateNextCall } from '../services/call.service';
import { getWorkflowSteps } from '../services/workflow.service';

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize Twilio client
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN, {
  lazyLoading: true,
});
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
const NGROK_BASE_URL = process.env.NGROK_BASE_URL;

/**
 * @author shahil
 * @desc main function for calling starting point this is the starting point of our application and based on that we will move to next steps and things 
 */
// Start a call session
const startCalls = asyncHandler(async (req: Request, res: Response) => {
  const { userId, groupId, groupType, contacts } = req.body;

  if (!userId) {
    return res.status(400).json(new ApiResponse(400, null, 'User ID is required'));
  }

  const numericUserId = parseInt(userId, 10);
  const numericGroupId = groupId != null ? parseInt(groupId, 10) : null;

  if (isNaN(numericUserId) || (groupId != null && isNaN(numericGroupId))) {
    return res.status(400).json(new ApiResponse(400, null, 'Invalid ID format'));
  }

  if (!contacts && !groupId) {
    return res.status(400).json(new ApiResponse(400, null, 'Contacts or group required'));
  }

  if (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !twilioNumber ||
    !NGROK_BASE_URL
  ) {
    return res
      .status(500)
      .json(new ApiResponse(500, null, 'Required environment variables missing'));
  }

  let contactsToCall: { id?: string; name: string; phoneNumber: string }[] = [];
  let targetGroupId: number | null = numericGroupId;
  let group = null;

  try {
    // if there is no group id and the groupType is manual then it means it is like new selected  group not already created group
    if (numericGroupId === 0 && groupType === 'MANUAL') {
      group = await prisma.groups.create({
        data: {
          user_id: numericUserId,
          group_name: `Manual Call - ${new Date().toISOString()}`,
          group_type: 'MANUAL',
          description: 'Manual call group',
          contacts: {
            create: contacts.map(({ name, phoneNumber }) => ({
              name,
              phone_number: phoneNumber,
            })),
          },
        },
        include: { contacts: true, workflows: true },
      });
    } else if (numericGroupId && numericGroupId > 0) {
      group = await prisma.groups.findUnique({
        where: { id: numericGroupId },
        include: { contacts: true, workflows: true },
      });
      if (!group) {
        return res.status(404).json(new ApiResponse(404, null, 'Group not found'));
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
      contactsToCall = contacts;
    }

    const user = await prisma.users.findUnique({ where: { id: numericUserId } });
    if (!user) {
      return res.status(404).json(new ApiResponse(404, null, 'User not found'));
    }

    const isPremium = user.is_premium ?? false;
    const contactLimit = isPremium ? 500 : 50;
    if (contactsToCall.length > contactLimit) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, `Contact limit exceeded: ${contactLimit}`));
    }

    //call session for a group of calls 
    const session = await prisma.call_session.create({
      data: {
        user_id: numericUserId,
        group_id: targetGroupId,
        contacts: contactsToCall,
        status: SessionStatusEnum.IN_PROGRESS,
        total_calls: contactsToCall.length,
        successful_calls: 0,
        failed_calls: 0,
        current_index: 0,
        updated_at: new Date(),
      },
    });

    //get workflow based on the group id 
    const workflow = await getWorkflowSteps(targetGroupId);
    //created call history for each and every contacts
    await prisma.call_history.createMany({
      data: contactsToCall.map((contact) => ({
        session_id: session.id,
        user_id: numericUserId,
        group_id: targetGroupId,
        contact_id: contact.id ? parseInt(contact.id) : null,
        contact_phone: contact.phoneNumber,
        status: CallStatusEnum.PENDING,
        attempt: 1,
        max_attempts: 3,
        current_step:
          workflow.length > 0
            ? JSON.stringify({
              workflow_id: group?.workflows?.id || null,
              step_id: workflow[0].id,
            })
            : null,
        called_at: new Date(),
        updated_at: new Date(),
      })),
    });
    //called the service for initiate next call in call service
    await initiateNextCall(session.id, req, workflow);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { sessionId: session.id },
          'Call session started successfully',
        ),
      );
  } catch (error) {
    console.error('Error starting call session:', error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, `Failed to start call session: ${error.message}`));
  }
});

// Stop a call session
const stopSession = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.body;
  const numericSessionId = parseInt(sessionId, 10);
  if (isNaN(numericSessionId)) {
    return res.status(400).json(new ApiResponse(400, null, 'Invalid session ID'));
  }

  const session = await prisma.call_session.findUnique({
    where: { id: numericSessionId },
  });
  if (!session) {
    return res.status(404).json(new ApiResponse(404, null, 'Session not found'));
  }

  const activeCalls = await prisma.call_history.findMany({
    where: { session_id: numericSessionId, status: CallStatusEnum.IN_PROGRESS },
  });

  for (const call of activeCalls) {
    if (call.call_sid) {
      try {
        await client.calls(call.call_sid).update({ status: 'completed' });
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
    data: { status: SessionStatusEnum.STOPPED, updated_at: new Date() },
  });

  const io = req.app?.get('io');
  io.emit('callStatusUpdate', {
    sessionId: numericSessionId,
    status: SessionStatusEnum.STOPPED,
    currentIndex: session.current_index,
    totalCalls: session.total_calls,
    currentContact: null,
    attempt: 0,
  });

  return res.status(200).json(new ApiResponse(200, null, 'Session stopped successfully'));
});

// Get call history
const getCallHistory = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.query;
  const numericSessionId = parseInt(sessionId as string, 10);
  if (isNaN(numericSessionId)) {
    return res.status(400).json(new ApiResponse(400, null, 'Invalid session ID'));
  }

  const history = await prisma.call_history.findMany({
    where: { session_id: numericSessionId },
    include: { contacts: true },
  });

  return res.status(200).json(new ApiResponse(200, history, 'Call history retrieved'));
});

export { startCalls, stopSession, getCallHistory };
