// Twilio WebSocket Handler for ConversationRelay - Malayalam Focus
import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { createSystemPrompt, initializeChatSession, sendMessageToGemini } from '../services/ai-agent.service';
import { getWorkflowSteps } from '../services/workflow.service';
import { env } from '../config/env';
import { PrismaClient } from '@prisma/client';
import { CallStatusEnum } from '../constant';
// Import or re-initialize Twilio client (copy from call.service.ts)
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN, {
    lazyLoading: true,
});

// Initialize Prisma client
const prisma = new PrismaClient();

// Check for required environment variables
if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable not set');
}

interface TwilioMessage {
    type: string;
    callSid?: string;
    voicePrompt?: string;
    groupId?: number;
}

export class TwilioWebSocketHandler {
    private wss: WebSocket.Server;

    constructor(server) {
        this.wss = new WebSocket.Server({ server, path: '/ws' });
        this.setupWebSocket();
        logger.success('Malayalam WebSocket server setup completed');
    }

    private setupWebSocket() {
        this.wss.on('connection', (ws: WebSocket & { callSid?: string; groupId?: number }, req) => {
            logger.log('New WebSocket connection from:', req.socket.remoteAddress);

            ws.on('message', async (data: Buffer) => {
                try {
                    const message: TwilioMessage = JSON.parse(data.toString());
                    // Store callSid and groupId on ws after setup
                    if (message.type === 'setup' && message.callSid) {
                        ws.callSid = message.callSid;
                        if (message.groupId) {
                            ws.groupId = message.groupId;
                        }
                    }

                    if (!message.callSid && ws.callSid) {
                        message.callSid = ws.callSid;
                    }
                    if (!message.groupId && ws.groupId) {
                        message.groupId = ws.groupId;
                    }
                    await this.handleMessage(ws, message);
                } catch (error) {
                    logger.error('Error handling WebSocket message:', error);
                }
            });

            ws.on('close', () => {
                logger.log('WebSocket connection closed');
            });

            ws.on('error', (error) => {
                logger.error('WebSocket error:', error);
            });
        });
    }

    private async handleMessage(ws: WebSocket & { callSid?: string; groupId?: number }, message: TwilioMessage) {
        logger.log('Received message type:', message.type);

        switch (message.type) {
            case 'setup':
                await this.handleSetup(ws, message);
                break;
            case 'prompt':
                await this.handlePrompt(ws, message);
                break;
            case 'interrupt':
                logger.log('Handling interruption for call:', message.callSid);
                break;
            default:
                logger.warn('Unknown message type:', message.type);
        }
    }

    private async handleSetup(ws: WebSocket & { callSid?: string; groupId?: number }, message: TwilioMessage) {
        const callSid = message.callSid;
        if (!callSid) {
            logger.error('No callSid in setup message');
            return;
        }

        logger.log('Malayalam setup for call:', callSid);

        // Get groupId from call_history using callSid
        let groupId: number | null = null;
        try {
            const callHistory = await prisma.call_history.findFirst({
                where: { call_sid: callSid },
                include: { call_session: true },
            });

            if (callHistory && callHistory.call_session) {
                groupId = callHistory.call_session.group_id;
                ws.groupId = groupId; // Store groupId on WebSocket for future use
                logger.log('Found groupId for call:', callSid, 'groupId:', groupId);
            } else {
                logger.warn('No call_history found for callSid:', callSid);
            }
        } catch (error) {
            logger.error('Error fetching groupId for callSid:', callSid, error);
        }

        // Fetch workflow for this call using the groupId
        const workflow = await getWorkflowSteps(groupId);

        // Generate a rich Malayalam system prompt for this call using ai-agent service
        const systemPrompt = createSystemPrompt(workflow, { id: callSid }, null);

        // Initialize chat session using ai-agent service
        initializeChatSession(callSid, systemPrompt);

        // Send setup confirmation
        ws.send(JSON.stringify({ type: 'setup', status: 'ready' }));
        logger.log('Malayalam setup completed for call:', callSid, 'with groupId:', groupId);
    }

    private async handlePrompt(ws: WebSocket & { callSid?: string; groupId?: number }, message: TwilioMessage) {
        const voicePrompt = message.voicePrompt || '';
        const callSid = message.callSid;

        if (!callSid) {
            logger.error('No callSid in prompt message');
            return;
        }

        logger.log('Processing Malayalam prompt:', voicePrompt);

        try {
            // 1. Fetch call_history and workflow
            const callHistory = await prisma.call_history.findFirst({
                where: { call_sid: callSid },
            });
            if (!callHistory || !callHistory.current_step) {
                throw new Error('No call history or current step found');
            }
            // Parse current_step if it's a string
            const currentStepObj =
                typeof callHistory.current_step === 'string' ? JSON.parse(callHistory.current_step) : callHistory.current_step;
            const { workflow_id, step_id } = currentStepObj;
            const workflowRow = await prisma.workflows.findUnique({ where: { id: workflow_id } });
            // Parse steps if it's a string
            let steps = workflowRow?.steps || [];
            if (typeof steps === 'string') {
                steps = JSON.parse(steps);
            }
            // Cast steps to WorkflowStep[]
            const stepsArr = Array.isArray(steps) ? (steps as unknown as import('../types/call.types').WorkflowStep[]) : [];
            const currentStep = stepsArr.find((s) => s.id === step_id);

            // 2. Determine next step based on answer and branching
            let nextStepId = null;
            if (currentStep && currentStep.answerType === 'yes_no' && currentStep.branch) {
                // Normalize answer for branching
                const normalized = voicePrompt.trim().toLowerCase();
                nextStepId = currentStep.branch[normalized] || null;
            } else if (Array.isArray(stepsArr)) {
                // For text/number, go to the next step in order
                const idx = stepsArr.findIndex((s) => s.id === step_id);
                nextStepId = stepsArr[idx + 1]?.id || null;
            }

            // 3. Update current_step in DB
            await prisma.call_history.update({
                where: { id: callHistory.id },
                data: {
                    current_step: {
                        workflow_id,
                        step_id: nextStepId,
                        last_answer: voicePrompt,
                    },
                },
            });

            // 4. Check if next step is 'end' and answer the last question before hangup
            const nextStep = stepsArr.find((s) => s.id === nextStepId);
            if (nextStep && nextStep.answerType === 'end') {
                console.log('endning');

                // Send the last question to the AI and user
                const aiPrompt = `
You are a helpful, friendly Malayalam AI assistant. The user may answer in English ,  Malayalam or Manglish . Always respond in natural, conversational Malayalam.
IMPORTANT: Do NOT use any emojis in your response. No emojis at all. Your response must be in natural, conversational Malayalam, but without any emojis.
Here is the workflow for this call:
${JSON.stringify(stepsArr, null, 2)}

You are currently on step: ${nextStepId}
The user's last answer was: ${voicePrompt}

Instructions:
- This is the last step. Thank the user warmly and end the conversation.
- Do not ask any more questions.
- Always be warm, encouraging, and conversational.
- Accept both English and Malayalam answers for Yes/No and map them to the correct branch.
`;
                const responseText = await sendMessageToGemini(callSid, aiPrompt);
                // Send the final response to the client
                await ws.send(
                    JSON.stringify({
                        type: 'text',
                        token: responseText,
                        last: true,
                    }),
                );
                // End the Twilio call
                if (callSid) {
                    try {
                        await client.calls(callSid).update({ status: 'completed' });
                        // Update call_history status
                        await prisma.call_history.update({
                            where: { id: callHistory.id },
                            data: {
                                status: CallStatusEnum.ACCEPTED,
                                ended_at: new Date(),
                                updated_at: new Date(),
                            },
                        });
                    } catch (err) {
                        logger.error('Failed to end Twilio call:', err);
                    }
                }
                // Emit socket event to web client (if needed)
                const io = ws._socket?.server?.io || ws.io || null;
                if (io) {
                    io.emit('callStatusUpdate', {
                        sessionId: callHistory.session_id,
                        status: CallStatusEnum.ACCEPTED,
                        currentIndex: null,
                        totalCalls: null,
                        currentContact: null,
                        attempt: 0,
                    });
                }
                return;
            }

            // 5. Build AI prompt for next question
            const aiPrompt = `
            IMPORTANT: Do NOT use any emojis in your response. No emojis at all. Your response must be in natural, conversational Malayalam, but without any emojis.
You are a helpful, friendly Malayalam AI assistant. The user may answer in English or Malayalam. Always respond in natural, conversational Malayalam.

Here is the workflow for this call:
${JSON.stringify(stepsArr, null, 2)}

You are currently on step: ${nextStepId}
The user's last answer was: ${voicePrompt}

Instructions:
- Ask the next question from the workflow, following the branching logic.
- Do not skip or invent questions.
- If the answer is Yes/No, use the branch to pick the next step. Accept both English and Malayalam and Manglish answers for Yes/No and map them to the correct branch.
- If the answer is text/number, record it and move to the next step.
- Always be warm, encouraging, and conversational.
- If the workflow ends, thank the user and end the conversation.
- Do not use emojis. Do not add emojis in any message.
- no emoji in the entire conversation 

Now, ask the next question.
`;

            // 6. Use ai-agent service to send message and get response
            const responseText = await sendMessageToGemini(callSid, aiPrompt);

            // Send the complete response back to Twilio
            await ws.send(
                JSON.stringify({
                    type: 'text',
                    token: responseText,
                    last: true,
                }),
            );
        } catch (error) {
            logger.error('Error processing Malayalam prompt:', error);

            await ws.send(
                JSON.stringify({
                    type: 'text',
                    token: 'ക്ഷമിക്കണം, ഒരു പിശക് സംഭവിച്ചു. ദയവായി വീണ്ടും ശ്രമിക്കുക.',
                    last: true,
                }),
            );
        }
    }

    public cleanup() {
        this.wss.close();
        logger.log('Malayalam WebSocket server closed');
    }
}
