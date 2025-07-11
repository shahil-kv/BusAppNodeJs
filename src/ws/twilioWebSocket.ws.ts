// Twilio WebSocket Handler for ConversationRelay - Malayalam Focus
import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { createSystemPrompt, initializeChatSession, sendMessageToGemini } from '../services/ai-agent.service';
import { getWorkflowStepsByGroupId } from '../services/workflow.service';
import { env } from '../config/env';
import { PrismaClient } from '@prisma/client';


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

// Helper to build AI prompt for Gemini
function buildAIPrompt({ isEndStep, stepsArr, nextStepId, voicePrompt, currentStep }) {
    if (isEndStep) {
        return `IMPORTANT: Do NOT use any emojis in your response. No emojis at all. Your response must be in natural, conversational Malayalam, but without any emojis.

You are a helpful, friendly Malayalam AI assistant. The user may answer in English, Malayalam or Manglish. Always respond in natural, conversational Malayalam.

Here is the workflow for this call:
${JSON.stringify(stepsArr, null, 2)}

You are currently on step: ${nextStepId}
The user's last answer was: "${voicePrompt}"

Instructions:
- This is the last step. Thank the user warmly and end the conversation.
- Do not ask any more questions.
- Always be warm, encouraging, and conversational.
- Accept both English and Malayalam answers for Yes/No and map them to the correct branch.`;
    } else {
        return `IMPORTANT: Do NOT use any emojis in your response. No emojis at all. Your response must be in natural, conversational Malayalam, but without any emojis.

You are a helpful, friendly Malayalam AI assistant. The user may answer in English or Malayalam. Always respond in natural, conversational Malayalam.

Here is the workflow for this call:
${JSON.stringify(stepsArr, null, 2)}

You are currently on step: ${nextStepId}
Current question: ${currentStep?.question || 'No specific question'}
The user's last answer was: "${voicePrompt}"

**SIMPLE INSTRUCTIONS:**
1. If the user asked a question (any question), answer it first, then ask the next workflow question
2. If the user answered the workflow question, acknowledge briefly and ask the next workflow question
3. Always be warm and conversational in Malayalam
4. Don't ignore any user input - answer everything they ask
5. Keep the conversation flowing naturally

Example responses:
- If user asks: "എന്തുകൊണ്ടാണ് ഇത് ചോദിക്കുന്നത്?" → "അത് നല്ല ചോദ്യമാണ്. [answer]. ഇനി [next workflow question]"
- If user answers: "അതെ" → "ശരി, ഇനി [next workflow question]"

Remember: Answer their question, then ask the next workflow question. Simple and natural.`;
    }
}

// Helper to send a text response to the client
function sendTextResponse(ws: WebSocket, text: string, last = true) {
    ws.send(
        JSON.stringify({
            type: 'text',
            token: text,
            last,
        }),
    );
}

export class TwilioWebSocketHandler {
    private wss: WebSocket.Server;

    constructor(server) {
        this.wss = new WebSocket.Server({ server, path: '/ws' });
        this.setupWebSocket();
        logger.log('WebSocket server setup completed');
    }

    private setupWebSocket() {
        this.wss.on('connection', (ws: WebSocket & { callSid?: string; groupId?: number }) => {
            logger.log('New WebSocket connection');

            ws.on('message', async (data: Buffer) => {
                try {
                    const message: TwilioMessage = JSON.parse(data.toString());
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
                logger.log('Unknown message type:', message.type);
        }
    }

    private async handleSetup(ws: WebSocket & { callSid?: string; groupId?: number }, message: TwilioMessage) {
        const callSid = message.callSid;
        if (!callSid) {
            logger.error('No callSid in setup message');
            return;
        }

        // Get groupId from call_history using callSid
        let groupId: number | null = null;
        try {
            const callHistory = await prisma.call_history.findFirst({
                where: { call_sid: callSid },
                include: { call_session: true },
            });

            if (callHistory && callHistory.call_session) {
                groupId = callHistory.call_session.group_id;
                ws.groupId = groupId;
            }
        } catch (error) {
            logger.error('Error fetching groupId for callSid:', callSid, error);
        }

        // Fetch workflow for this call using the groupId
        const workflow = await getWorkflowStepsByGroupId(groupId);

        // Generate a rich Malayalam system prompt for this call using ai-agent service
        const systemPrompt = createSystemPrompt(workflow);

        // Initialize chat session using ai-agent service
        initializeChatSession(callSid, systemPrompt);

        // Send setup confirmation
        ws.send(JSON.stringify({ type: 'setup', status: 'ready' }));
        logger.log('Setup completed for call:', callSid);
    }

    private async handlePrompt(ws: WebSocket & { callSid?: string; groupId?: number }, message: TwilioMessage) {
        const voicePrompt = message.voicePrompt || '';
        const callSid = message.callSid;

        if (!callSid) {
            logger.error('No callSid in prompt message');
            return;
        }

        logger.log('👤 User:', voicePrompt);

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
            if (!workflowRow) {
                throw new Error('Workflow not found');
            }

            // Parse steps if it's a string
            let steps = workflowRow?.steps || [];
            if (typeof steps === 'string') {
                steps = JSON.parse(steps);
            }

            // Cast steps to WorkflowStep[]
            const stepsArr = Array.isArray(steps) ? (steps as unknown as import('../types/call.types').WorkflowStep[]) : [];
            const currentStep = stepsArr.find((s) => s.id === step_id);

            if (!currentStep) {
                throw new Error('Current step not found in workflow');
            }

            // 2. Determine next step based on answer and branching
            let nextStepId = null;

            logger.log(`🔍 Current step: ${currentStep.id}, Answer type: ${currentStep.answerType}, Has branch: ${!!currentStep.branch}`);

            if (currentStep.answerType === 'yes_no' && currentStep.branch) {
                logger.log(`🎯 Processing YES/NO question: "${currentStep.question}"`);
                logger.log(`🎯 User response: "${voicePrompt}"`);
                logger.log(`🎯 Available branches: ${JSON.stringify(currentStep.branch)}`);

                // Use AI to determine intent instead of hardcoded mapping
                const normalized = voicePrompt.trim().toLowerCase();

                // Use AI to determine if the answer is positive (yes) or negative (no)
                const intentPrompt = `Analyze this Malayalam response and determine if it's a positive (yes) or negative (no) answer. Only respond with "yes" or "no".

User response: "${voicePrompt}"

Context: The question was: "${currentStep.question}"

Response (only yes or no):`;

                try {
                    logger.log(`🤖 Sending to AI for intent analysis: "${voicePrompt}"`);
                    const intentResponse = await sendMessageToGemini(callSid, intentPrompt);
                    const aiIntent = intentResponse.trim().toLowerCase();
                    logger.log(`🤖 AI intent response: "${aiIntent}"`);

                    // Check if AI response contains yes/no
                    let mappedAnswer = null;
                    if (aiIntent.includes('yes') || aiIntent.includes('positive')) {
                        mappedAnswer = 'yes';
                        logger.log(`✅ AI mapped to: YES`);
                    } else if (aiIntent.includes('no') || aiIntent.includes('negative')) {
                        mappedAnswer = 'no';
                        logger.log(`❌ AI mapped to: NO`);
                    } else {
                        logger.log(`⚠️ AI response unclear: "${aiIntent}", using fallback logic`);
                        // Fallback: try to guess from the original response
                        const positiveWords = ['ആണ്', 'അതെ', 'ശരി', 'താല്പര്യമുണ്ട്', 'ഉണ്ട്', 'അതാണ്', 'ശരിയാണ്'];
                        const negativeWords = ['അല്ല', 'ഇല്ല', 'വേണ്ട', 'അല്ലാ', 'താല്പര്യമില്ല', 'ഇല്ലാ', 'thalperym ind', 'thalperym illa', 'thalpery illa', 'thalpery ind'];

                        const isPositive = positiveWords.some(word => normalized.includes(word));
                        const isNegative = negativeWords.some(word => normalized.includes(word));

                        logger.log(`🔍 Fallback analysis - Positive words found: ${isPositive}, Negative words found: ${isNegative}`);

                        if (isPositive && !isNegative) {
                            mappedAnswer = 'yes';
                            logger.log(`✅ Fallback mapped to: YES`);
                        } else if (isNegative && !isPositive) {
                            mappedAnswer = 'no';
                            logger.log(`❌ Fallback mapped to: NO`);
                        } else {
                            // Default to first branch if unclear
                            mappedAnswer = Object.keys(currentStep.branch)[0];
                            logger.log(`⚠️ Default mapped to: ${mappedAnswer}`);
                        }
                    }

                    if (currentStep.branch[mappedAnswer]) {
                        nextStepId = currentStep.branch[mappedAnswer];
                        logger.log(`🎯 Next step ID: ${nextStepId} (from branch: ${mappedAnswer})`);
                    } else {
                        // Default to first branch if no match found
                        const firstBranchKey = Object.keys(currentStep.branch)[0];
                        nextStepId = currentStep.branch[firstBranchKey];
                        logger.log(`⚠️ No branch match, defaulting to: ${nextStepId}`);
                    }

                } catch (error) {
                    logger.error('❌ Error determining intent with AI:', error);
                    // Fallback to simple mapping
                    const positiveWords = ['ആണ്', 'അതെ', 'ശരി', 'താല്പര്യമുണ്ട്', 'ഉണ്ട്', 'അതാണ്', 'ശരിയാണ്'];
                    const negativeWords = ['അല്ല', 'ഇല്ല', 'വേണ്ട', 'അല്ലാ', 'താല്പര്യമില്ല', 'ഇല്ലാ', 'thalperym ind', 'thalperym illa', 'thalpery illa', 'thalpery ind'];

                    const isPositive = positiveWords.some(word => normalized.includes(word));
                    const isNegative = negativeWords.some(word => normalized.includes(word));

                    logger.log(`🔍 Error fallback analysis - Positive: ${isPositive}, Negative: ${isNegative}`);

                    let fallbackAnswer = 'yes'; // Default to positive
                    if (isNegative && !isPositive) {
                        fallbackAnswer = 'no';
                    }

                    nextStepId = currentStep.branch[fallbackAnswer] || currentStep.branch[Object.keys(currentStep.branch)[0]];
                    logger.log(`🎯 Error fallback next step: ${nextStepId}`);
                }

            } else if (Array.isArray(stepsArr)) {
                logger.log(`📝 Processing TEXT/NUMBER question: "${currentStep.question}"`);
                // For text/number, go to the next step in order
                const idx = stepsArr.findIndex((s) => s.id === step_id);
                nextStepId = stepsArr[idx + 1]?.id || null;
                logger.log(`📝 Next step ID: ${nextStepId} (sequential)`);
            }

            // 3. Update current_step in DB
            if (nextStepId) {
                logger.log(`💾 Updating database - Call ID: ${callHistory.id}, New step: ${nextStepId}`);
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
                logger.log(`✅ Database updated successfully`);
            }

            // 4. Check if next step is 'end' and answer the last question before hangup
            const nextStep = stepsArr.find((s) => s.id === nextStepId);

            // Safety check: if nextStep is null, find the end step
            if (!nextStep && nextStepId) {
                const endStep = stepsArr.find(s => s.answerType === 'end');
                if (endStep) {
                    nextStepId = endStep.id;
                    await prisma.call_history.update({
                        where: { id: callHistory.id },
                        data: {
                            current_step: {
                                workflow_id,
                                step_id: endStep.id,
                                last_answer: voicePrompt,
                            },
                        },
                    });
                }
            }

            const finalNextStep = stepsArr.find((s) => s.id === nextStepId);
            const isEndStep = !!(finalNextStep && finalNextStep.answerType === 'end');

            logger.log(`🎯 Final step analysis - Step ID: ${nextStepId}, Answer Type: ${finalNextStep?.answerType}, Is End Step: ${isEndStep}`);

            // 5. Generate AI response
            logger.log(`🤖 Generating AI response for user input: "${voicePrompt}"`);

            const aiPrompt = buildAIPrompt({
                isEndStep,
                stepsArr,
                nextStepId,
                voicePrompt,
                currentStep,
            });

            logger.log(`🤖 AI Prompt preview: ${aiPrompt.substring(0, 200)}...`);

            const responseText = await sendMessageToGemini(callSid, aiPrompt);
            logger.log('🤖 AI:', responseText);

            sendTextResponse(ws, responseText, true);

            // 6. Handle end step
            if (isEndStep) {
                // TODO: Implement call cut logic here
                // - Calculate appropriate wait time based on message length
                // - End the call gracefully after message playback
                // - Update call status in database
                // - Emit socket events for web client updates

                logger.log('✅ End step reached - call cut logic to be implemented');
                logger.log('🎉 Workflow completed successfully!');
                return;
            }

            logger.log('🔄 Step completed, waiting for next user input...');
        } catch (error) {
            logger.error('Error processing prompt:', error);
            sendTextResponse(ws, 'ക്ഷമിക്കണം, ഒരു പിശക് സംഭവിച്ചു. ദയവായി വീണ്ടും ശ്രമിക്കുക.', true);
        }
    }

    public cleanup() {
        this.wss.close();
        logger.log('WebSocket server closed');
    }
}
