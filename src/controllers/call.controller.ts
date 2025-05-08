import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import twilio from 'twilio';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const prisma = new PrismaClient();
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN); // Set in .env
const twilioNumber = process.env.TWILIO_PHONE_NUMBER; // Set in .env

// Main function to handle call initiation
const handleCall = asyncHandler(async (req: Request, res: Response) => {
    const { userId, contacts, groupId, groupType, messageContent } = req.body;
    console.log('Incoming call initiation request:', req.body);

    const numericUserId = parseInt(userId, 10);
    const numericGroupId = parseInt(groupId, 10);

    if (isNaN(numericUserId)) {
        return res.status(400).json(new ApiResponse(400, null, 'Invalid user ID format'));
    }

    if (isNaN(numericGroupId)) {
        return res.status(400).json(new ApiResponse(400, null, 'Invalid Group ID format'));
    }

    if (!messageContent) {
        return res.status(400).json(new ApiResponse(400, null, 'Message content is required for TTS'));
    }

    let targetGroupId: number;
    let contactsToCall: { name: string; phoneNumber: string }[] = [];

    if (numericGroupId === 0 && groupType === 'MANUAL') {
        // Manual group: create a temporary group and use provided contacts
        const manualGroup = await prisma.groups.create({
            data: {
                user_id: numericUserId,
                group_name: `Manual Call - ${new Date().toISOString()}`,
                group_type: 'MANUAL',
                description: 'Manual call group',
                contacts: {
                    create: contacts.map((contact: { name: string; phoneNumber: string }) => ({
                        name: contact.name,
                        phone_number: contact.phoneNumber,
                    })),
                },
            },
            include: { contacts: true },
        });
        targetGroupId = manualGroup.id;
        contactsToCall = manualGroup.contacts.map(c => ({ name: c.name, phoneNumber: c.phone_number }));
    } else {
        // Group-based: fetch contacts from the group
        const existingGroup = await prisma.groups.findUnique({
            where: { id: numericGroupId },
            include: { contacts: true },
        });

        if (!existingGroup) {
            return res.status(404).json(new ApiResponse(404, null, 'Group not found'));
        }
        targetGroupId = numericGroupId;
        contactsToCall = existingGroup.contacts.map(c => ({ name: c.name, phoneNumber: c.phone_number }));
    }

    const callResults = [];

    for (const contact of contactsToCall) {
        // Find or create the contact in the contacts table
        let contactRecord = await prisma.contacts.findFirst({
            where: {
                group_id: targetGroupId,
                phone_number: contact.phoneNumber,
            },
        });
        if (!contactRecord) {
            contactRecord = await prisma.contacts.create({
                data: {
                    group_id: targetGroupId,
                    name: contact.name,
                    phone_number: contact.phoneNumber,
                },
            });
        }
        const callHistory = await saveCallHistory({
            userId: numericUserId,
            groupId: targetGroupId,
            contactId: contactRecord.id,
            contactPhone: contact.phoneNumber,
            status: 'PENDING',
            attempt: 1,
            messageContent,
        });

        try {
            const call = await client.calls.create({
                url: `https://e7f3-103-182-167-251.ngrok-free.app/voice?messageContent=${encodeURIComponent(messageContent)}`,
                to: contact.phoneNumber,
                from: twilioNumber,
                statusCallback: 'https://e7f3-103-182-167-251.ngrok-free.app/call-status',
                statusCallbackMethod: 'POST',
            });
            console.log(`Call initiated to ${contact.phoneNumber}. Twilio Call SID: ${call.sid}`);

            await prisma.call_history.update({
                where: { id: callHistory.id },
                data: { call_sid: call.sid, status: 'IN_PROGRESS' },
            });
            console.log(`Call history updated to IN_PROGRESS for contact ${contact.phoneNumber}, callHistoryId: ${callHistory.id}`);

            callResults.push({
                contact: contact.name,
                phoneNumber: contact.phoneNumber,
                status: 'IN_PROGRESS',
                callHistoryId: callHistory.id,
            });
        } catch (error) {
            console.error(`Error initiating call to ${contact.phoneNumber}:`, error);
            await prisma.call_history.update({
                where: { id: callHistory.id },
                data: { status: 'FAILED' },
            });
            console.log(`Call history updated to FAILED for contact ${contact.phoneNumber}, callHistoryId: ${callHistory.id}`);
            callResults.push({
                contact: contact.name,
                phoneNumber: contact.phoneNumber,
                status: 'FAILED',
                callHistoryId: callHistory.id,
            });
        }
    }

    return res.status(200).json(new ApiResponse(200, callResults, 'Calls initiated successfully'));
});

// Function to save call history
const saveCallHistory = async ({
    userId,
    groupId,
    contactId,
    contactPhone,
    status,
    attempt,
    messageContent,
    callSid,
}: {
    userId: number;
    groupId: number;
    contactId?: number;
    contactPhone: string;
    status: string;
    attempt: number;
    messageContent?: string;
    callSid?: string;
}) => {
    return await prisma.call_history.create({
        data: {
            user_id: userId,
            group_id: groupId,
            contact_id: contactId,
            contact_phone: contactPhone,
            status,
            attempt,
            message_content: messageContent,
            call_sid: callSid,
        },
    });
};

// TwiML route for call flow
const voiceHandler = asyncHandler(async (req: Request, res: Response) => {
    const twiml = new twilio.twiml.VoiceResponse();
    const { messageContent } = req.query;

    if (messageContent) {
        twiml.say(decodeURIComponent(messageContent as string));
    } else {
        twiml.say('Tomorrow there is a meeting');
    }

    twiml.hangup();
    res.type('text/xml');
    res.send(twiml.toString());
});

// Call status callback
const callStatusHandler = asyncHandler(async (req: Request, res: Response) => {
    console.log('Twilio status callback received:', req.body);
    if (!req.body || Object.keys(req.body).length === 0) {
        console.warn('Empty req.body received in /call-status. Make sure express.json() middleware is used.');
        return res.status(400).json({ message: 'Empty body received. Check express.json() middleware.' });
    }
    const { CallSid, CallStatus } = req.body;

    const callHistory = await prisma.call_history.findFirst({
        where: { call_sid: CallSid },
    });

    if (!callHistory) {
        console.warn(`No call_history found for CallSid: ${CallSid}`);
    } else {
        console.log(`Found call_history record for CallSid: ${CallSid}, id: ${callHistory.id}, current status: ${callHistory.status}`);
    }

    if (callHistory) {
        let mappedStatus;
        switch (CallStatus) {
            case 'completed':
                mappedStatus = 'ACCEPTED';
                break;
            case 'no-answer':
                mappedStatus = 'NO_ANSWER';
                break;
            case 'busy':
            case 'failed':
                mappedStatus = 'FAILED';
                break;
            default:
                mappedStatus = CallStatus;
        }

        await prisma.call_history.update({
            where: { id: callHistory.id },
            data: { status: mappedStatus },
        });
        console.log(`Updated call_history id: ${callHistory.id} to status: ${mappedStatus}`);

        if (
            CallStatus === 'no-answer' &&
            (callHistory.attempt ?? 1) < 2 &&
            callHistory.contact_id &&
            callHistory.contact_phone &&
            callHistory.message_content
        ) {
            const newAttempt = (callHistory.attempt ?? 1) + 1;
            try {
                const newCall = await client.calls.create({
                    url: `https://e7f3-103-182-167-251.ngrok-free.app/voice?messageContent=${encodeURIComponent(callHistory.message_content)}`,
                    to: callHistory.contact_phone,
                    from: twilioNumber,
                    statusCallback: 'https://e7f3-103-182-167-251.ngrok-free.app/call-status',
                    statusCallbackMethod: 'POST',
                });
                console.log(`Retrying call to ${callHistory.contact_phone}. New Twilio Call SID: ${newCall.sid}`);
                await saveCallHistory({
                    userId: callHistory.user_id,
                    groupId: callHistory.group_id,
                    contactId: callHistory.contact_id,
                    contactPhone: callHistory.contact_phone,
                    status: 'IN_PROGRESS',
                    attempt: newAttempt,
                    messageContent: callHistory.message_content,
                    callSid: newCall.sid,
                });
                console.log(`Saved new call_history for retry attempt ${newAttempt} to ${callHistory.contact_phone}`);
            } catch (error) {
                console.error(`Error retrying call to ${callHistory.contact_phone}:`, error);
                await prisma.call_history.update({
                    where: { id: callHistory.id },
                    data: { status: 'FAILED' },
                });
                console.log(`Updated call_history id: ${callHistory.id} to FAILED after retry error`);
            }
        } else if (CallStatus === 'no-answer' && (callHistory.attempt ?? 1) < 2) {
            console.warn('Cannot retry call: missing contact_id, contact_phone, or message_content in callHistory', callHistory);
        }
    }

    res.sendStatus(200);
});

export { handleCall, voiceHandler, callStatusHandler, saveCallHistory };
