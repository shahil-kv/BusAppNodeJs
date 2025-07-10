// Initiate next call
// import { ApiResponse } from '../utils/ApiResponse';
import { Request } from 'express';
import { PrismaClient } from '@prisma/client';
import { CallStatusEnum, SessionStatusEnum } from '../constant';
import { WorkflowStep } from './workflow.service';

// Initialize Twilio client
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN, {
  lazyLoading: true,
});
const prisma = new PrismaClient();
const NGROK_BASE_URL = process.env.NGROK_BASE_URL;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

const initiateNextCall = async (sessionId: number, req: Request, workflow: WorkflowStep[]) => {
  const session = await prisma.call_session.findUnique({
    where: { id: sessionId },
    include: { call_history: true },
  });
  if (!session || session.status !== SessionStatusEnum.IN_PROGRESS) return;

  const contacts = session.contacts as {
    id?: string;
    name: string;
    phoneNumber: string;
  }[];
  const currentIndex = session.current_index || 0;
  if (currentIndex >= contacts.length) {
    await prisma.call_session.update({
      where: { id: sessionId },
      data: { status: SessionStatusEnum.COMPLETED, updated_at: new Date() },
    });
    const io = req.app?.get('io');
    io.emit('callStatusUpdate', {
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
  const callHistory = session.call_history.find(
    (ch) => ch.contact_phone === contact.phoneNumber && ch.status === CallStatusEnum.PENDING,
  );
  if (!callHistory) {
    await prisma.call_session.update({
      where: { id: sessionId },
      data: { current_index: { increment: 1 }, updated_at: new Date() },
    });
    await new Promise((res) => setTimeout(res, 500)); // Reduced delay for speed
    await initiateNextCall(sessionId, req, workflow);
    return;
  }

  try {
    const call = await client.calls.create({
      url: `${NGROK_BASE_URL}/voice-update`,
      to: contact.phoneNumber,
      from: twilioNumber,
      statusCallback: `${NGROK_BASE_URL}/call-status`,
      statusCallbackMethod: 'POST',
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

    const io = req.app?.get('io');
    io.emit('callStatusUpdate', {
      sessionId,
      status: session.status,
      currentIndex: session.current_index,
      totalCalls: session.total_calls,
      currentContact: { name: contact.name, phoneNumber: contact.phoneNumber },
      attempt: callHistory.attempt,
    });
  } catch (error) {
    console.error(`Error initiating call to ${contact.phoneNumber}:`, error);
    await prisma.call_history.update({
      where: { id: callHistory.id },
      data: {
        status: CallStatusEnum.FAILED,
        error_message: error.message,
        updated_at: new Date(),
      },
    });
    await prisma.call_session.update({
      where: { id: sessionId },
      data: { failed_calls: { increment: 1 }, updated_at: new Date() },
    });
    await initiateNextCall(sessionId, req, workflow);
  }
};

export { initiateNextCall };
