// Simplified AI Agent Service for Twilio ConversationRelay
// Only handles normal prompt creation for Gemini AI (not system prompt)
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

// Store active chat sessions
const sessions = new Map();

export interface WorkflowStep {
    id: number;
    question: string;
    malayalam: string;
    yes_next: number | string;
    no_next: number | string;
}

// Create normal prompt with entire workflow for Gemini
// IMPORTANT: This is a NORMAL PROMPT (not system prompt) that changes for every call based on groupId
// The entire workflow is given to Gemini as a prompt, so Gemini will naturally ask these questions in Malayalam
export function createSystemPrompt(workflow: WorkflowStep[], session: any, group: any): string {
    logger.log('Creating workflow prompt for session:', session?.id);

    // Give the workflow as a natural English context (if any)
    const workflowText = workflow
        .map((step) => step.question)
        .join('\n\n');

    const normalPrompt = `You are a helpful, friendly, and human-like English-speaking AI assistant.\n\nGuidelines:\n- Always respond in clear, natural, conversational English.\n- Be friendly, empathetic, and engaging.\n- Answer any question the user asks, whether or not it is in the workflow.\n- If the workflow is provided, use it as context for the conversation, but you can answer anything.\n\nWORKFLOW QUESTIONS (for context):\n${workflowText}\n\nStart the conversation naturally and helpfully.`;

    logger.log('Workflow prompt created, length:', normalPrompt.length);
    return normalPrompt;
}

// Initialize Gemini chat session
export function initializeChatSession(sessionKey: string, systemPrompt: string) {
    logger.log('Initializing chat session for:', sessionKey);

    try {
        const chat = model.startChat({
            history: [],
            generationConfig: {
                temperature: 0.1,
                topK: 1,
                topP: 0.1,
                maxOutputTokens: 1024,
                candidateCount: 1,
            },
        });

        // Set the normal prompt (this will guide Gemini to ask the workflow questions)
        chat.sendMessage(systemPrompt);

        sessions.set(sessionKey, chat);
        logger.log('Chat session created successfully');
        return chat;
    } catch (error) {
        logger.error('Error initializing chat session:', error);
        throw error;
    }
}

// Get chat session
export function getChatSession(sessionKey: string) {
    return sessions.get(sessionKey);
}

// Remove chat session
export function removeChatSession(sessionKey: string) {
    const deleted = sessions.delete(sessionKey);
    logger.log('Chat session removed:', sessionKey);
}

// Send message to Gemini and get response
export async function sendMessageToGemini(sessionKey: string, message: string): Promise<string> {
    logger.log('Sending to Gemini:', message.substring(0, 50) + '...');

    try {
        const chat = sessions.get(sessionKey);
        if (!chat) {
            throw new Error(`No chat session found for key: ${sessionKey}`);
        }

        const result = await chat.sendMessage(message);
        const responseText = result.response.text();

        logger.log('Gemini response:', responseText.substring(0, 50) + '...');

        // Post-process to ensure Malayalam response
        let processedResponse = responseText;

        // Check if response is in English and convert to Malayalam
        const englishWords = ['hello', 'hi', 'how', 'what', 'when', 'where', 'why', 'who', 'can', 'will', 'would', 'could', 'should', 'may', 'might', 'yes', 'no', 'okay', 'ok', 'sure', 'thank', 'thanks', 'good', 'bad', 'nice', 'great', 'fine', 'well', 'help', 'assist', 'support', 'course', 'program', 'education', 'training', 'technology', 'healthcare', 'business'];
        const hasEnglishWords = englishWords.some(word => responseText.toLowerCase().includes(word));

        if (hasEnglishWords || responseText.match(/[a-zA-Z]/)) {
            logger.warn('Converting English response to Malayalam');

            // Force Malayalam response based on context
            if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
                processedResponse = 'നമസ്കാരം! ഞങ്ങളുടെ വിദ്യാഭ്യാസ പ്രോഗ്രാമുകളിൽ ചേരാൻ താല്പര്യമുണ്ടോ?';
            } else if (message.toLowerCase().includes('course') || message.toLowerCase().includes('program')) {
                processedResponse = 'ഞങ്ങൾക്ക് ടെക്നോളജി, ഹെൽത്ത്‌കെയർ, ബിസിനസ് എന്നീ മേഖലകളിൽ മികച്ച കോഴ്സുകൾ ഉണ്ട്. ഏത് മേഖലയിലാണ് നിങ്ങൾക്ക് താല്പര്യം?';
            } else if (message.toLowerCase().includes('price') || message.toLowerCase().includes('cost')) {
                processedResponse = 'ഞങ്ങളുടെ കോഴ്സുകൾ ₹20,000 മുതൽ ₹35,000 വരെ ചിലവാകും. EMI ഓപ്ഷനുകളും ലഭ്യമാണ്. കൂടുതൽ വിവരങ്ങൾക്ക് ഞങ്ങളുടെ കൗൺസിലറുമായി സംസാരിക്കാം.';
            } else {
                processedResponse = 'നിങ്ങളുടെ ചോദ്യത്തിന് ഉത്തരം നൽകാൻ എനിക്ക് സന്തോഷമുണ്ട്. ഞങ്ങളുടെ വിദ്യാഭ്യാസ പ്രോഗ്രാമുകളെക്കുറിച്ച് കൂടുതൽ അറിയാൻ താല്പര്യമുണ്ടോ?';
            }
        }

        // Ensure conversation continues
        if (!processedResponse.includes('?') && !processedResponse.includes('എന്ന്') && !processedResponse.includes('ആണ്')) {
            processedResponse += ' നിങ്ങൾക്ക് കൂടുതൽ ചോദ്യങ്ങൾ ഉണ്ടോ?';
        }

        return processedResponse;
    } catch (error) {
        logger.error('Error sending message to Gemini:', error);
        throw error;
    }
}

logger.success('AI Agent Service initialized'); 