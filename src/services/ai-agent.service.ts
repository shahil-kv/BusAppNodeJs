// Simplified AI Agent Service for Twilio ConversationRelay
// Fully Malayalam-focused conversational AI
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';
import { env } from '../config/env';

const gemini = new GoogleGenerativeAI(env.GEMINI_API_KEY);
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

// Create Malayalam-focused system prompt with entire workflow for Gemini
// This is a NORMAL PROMPT that changes for every call based on groupId
// The entire workflow is given to Gemini as a prompt, so Gemini will naturally ask these questions in Malayalam
export function createSystemPrompt(
    workflow: WorkflowStep[],
    session: any,
    group: any,
): string {
    logger.log('Creating Malayalam workflow prompt for session:', session?.id);

    // Create a comprehensive Malayalam workflow context
    const workflowContext = workflow
        .map((step, index) => `${index + 1}. ${step.malayalam}`)
        .join('\n\n');

    const malayalamPrompt = `നിങ്ങൾ ഒരു സഹായകരവും സൗഹൃദവുമായ മലയാളം സംസാരിക്കുന്ന AI അസിസ്റ്റന്റ് ആണ്.

നിങ്ങൾ പാലിക്കേണ്ട നിയമങ്ങൾ:
- എല്ലാ ഉത്തരങ്ങളും മലയാളത്തിൽ നൽകുക
- സൗഹൃദവും സഹായകരവുമായ രീതിയിൽ സംസാരിക്കുക
- ഉപയോക്താവിന്റെ ചോദ്യങ്ങൾക്ക് ഉത്തരം നൽകുക
- ചിത്തശാന്തിയോടെയും ക്ഷമയോടെയും സംസാരിക്കുക
- ക്ഷമയോടെയും ശാന്തതയോടെയും സംവദിക്കുക.
- വിദ്യാഭ്യാസ പ്രോഗ്രാമുകളെക്കുറിച്ച് വിവരങ്ങൾ നൽകുക

വിദ്യാഭ്യാസ പ്രോഗ്രാം ചോദ്യങ്ങൾ (ഉപയോഗിക്കാവുന്നത്):
${workflowContext}

നിങ്ങൾ ഈ ചോദ്യങ്ങൾ ഉപയോഗിച്ച് സംഭാഷണം നയിക്കാവുന്നതാണ്. എന്നാൽ ഉപയോക്താവിന്റെ ഏത് ചോദ്യത്തിനും ഉത്തരം നൽകാവുന്നതാണ്.

സംഭാഷണം ആരംഭിക്കുക.`;

    logger.log('Malayalam workflow prompt created, length:', malayalamPrompt.length);
    return malayalamPrompt;
}

// Initialize Gemini chat session with Malayalam focus
export function initializeChatSession(sessionKey: string, systemPrompt: string) {
    logger.log('Initializing Malayalam chat session for:', sessionKey);

    try {
        const chat = model.startChat({
            history: [],
            generationConfig: {
                temperature: 0.3,
                topK: 1,
                topP: 0.9,
                maxOutputTokens: 1024,
                candidateCount: 1,
            },
        });

        // Set the Malayalam prompt (this will guide Gemini to respond in Malayalam)
        chat.sendMessage(systemPrompt);

        sessions.set(sessionKey, chat);
        logger.log('Malayalam chat session created successfully');
        return chat;
    } catch (error) {
        logger.error('Error initializing Malayalam chat session:', error);
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

// Send message to Gemini and get Malayalam response
export async function sendMessageToGemini(
    sessionKey: string,
    message: string,
): Promise<string> {
    logger.log('Sending to Gemini:', message.substring(0, 50) + '...');

    try {
        const chat = sessions.get(sessionKey);
        if (!chat) {
            throw new Error(`No chat session found for key: ${sessionKey}`);
        }

        const result = await chat.sendMessage(message);
        const responseText = result.response.text();

        logger.log('Gemini response:', responseText.substring(0, 50) + '...');

        // Optionally, ensure response is in Malayalam (basic check)
        // If you want to enforce Malayalam, you can check for English characters and log a warning
        const englishPattern = /[a-zA-Z]/;
        if (englishPattern.test(responseText)) {
            logger.warn('Gemini response may not be in Malayalam.');
        }

        // Return Gemini's response as-is (no mapping, no hardcoded logic)
        return responseText;
    } catch (error) {
        logger.error('Error sending message to Gemini:', error);
        throw error;
    }
}

logger.success('Malayalam AI Agent Service initialized');
