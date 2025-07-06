// Handle call status updates
import { asyncHandler } from '../utils/asyncHandler';
// import { ApiResponse } from '../utils/ApiResponse';
import { Request, Response } from 'express';
import { CallStatusEnum, SessionStatusEnum } from '../constant';
import { PrismaClient } from '@prisma/client';
import { initiateNextCall } from '../services/call.service';
import { getWorkflowSteps } from '../services/workflow.service';

const prisma = new PrismaClient();

const callStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const { CallSid, CallStatus, CallDuration } = req.body;
  if (!req.body || Object.keys(req.body).length === 0) {
    console.error('Empty body in callStatusHandler');
    return res.status(400).json({ message: 'Empty body received' });
  }

  const callHistory = await prisma.call_history.findFirst({
    where: { call_sid: CallSid },
    include: { call_session: true },
  });

  if (!callHistory || !callHistory.call_session) {
    console.warn(`No call_history for CallSid: ${CallSid}`);
    return res.sendStatus(200);
  }

  let mappedStatus = '';
  let isSuccessful = false;
  switch (CallStatus) {
    case 'completed':
      mappedStatus = CallStatusEnum.ACCEPTED;
      isSuccessful = true;
      break;
    case 'failed':
      mappedStatus = CallStatusEnum.FAILED;
      break;
    default:
      mappedStatus = CallStatusEnum.FAILED;
  }

  await prisma.call_history.update({
    where: { id: callHistory.id },
    data: {
      status: mappedStatus,
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

  const session = callHistory.call_session;
  const contacts = session.contacts as {
    id?: string;
    name: string;
    phoneNumber: string;
  }[];
  const currentContact = contacts[session.current_index] || null;

  const io = req.app?.get('io');
  io.emit('callStatusUpdate', {
    sessionId: callHistory.session_id,
    status: session.status,
    currentIndex: session.current_index,
    totalCalls: session.total_calls,
    currentContact: currentContact
      ? { name: currentContact.name, phoneNumber: currentContact.phoneNumber }
      : null,
    attempt: callHistory.attempt,
  });

  if (session.status === SessionStatusEnum.IN_PROGRESS) {
    await prisma.call_session.update({
      where: { id: callHistory.session_id },
      data: { current_index: { increment: 1 }, updated_at: new Date() },
    });
    const workflow = await getWorkflowSteps(session.group_id);
    await initiateNextCall(callHistory.session_id, req, workflow);
  }

  if (session.current_index >= session.total_calls - 1) {
    await prisma.call_session.update({
      where: { id: callHistory.session_id },
      data: { status: SessionStatusEnum.COMPLETED, updated_at: new Date() },
    });
    io.emit('callStatusUpdate', {
      sessionId: callHistory.session_id,
      status: SessionStatusEnum.COMPLETED,
      currentIndex: session.current_index + 1,
      totalCalls: session.total_calls,
      currentContact: null,
      attempt: 0,
    });
  }

  // res.sendStatus(200);
});

// Recording status callback
const recordingStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  console.log('Recording status callback:', req.body);
  res.status(200).send('OK');
});

export { callStatusHandler, recordingStatusHandler };
