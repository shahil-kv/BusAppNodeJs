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
export function createSystemPrompt(workflow: WorkflowStep[], session: any, group: any): string {
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

        // Enhanced Malayalam response processing
        let processedResponse = responseText;

        // Check if response contains English and convert to Malayalam
        const englishPattern = /[a-zA-Z]/;
        const hasEnglish = englishPattern.test(responseText);

        if (hasEnglish) {
            logger.warn('Converting English response to Malayalam');

            // Enhanced Malayalam conversion based on context
            const lowerMessage = message.toLowerCase();
            const lowerResponse = responseText.toLowerCase();

            if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('നമസ്കാരം')) {
                processedResponse = 'നമസ്കാരം! ഞങ്ങളുടെ വിദ്യാഭ്യാസ പ്രോഗ്രാമുകളിൽ ചേരാൻ താല്പര്യമുണ്ടോ?';
            } else if (lowerMessage.includes('course') || lowerMessage.includes('program') || lowerMessage.includes('കോഴ്സ്')) {
                processedResponse = 'ഞങ്ങൾക്ക് ടെക്നോളജി, ഹെൽത്ത്‌കെയർ, ബിസിനസ് എന്നീ മേഖലകളിൽ മികച്ച കോഴ്സുകൾ ഉണ്ട്. ഏത് മേഖലയിലാണ് നിങ്ങൾക്ക് താല്പര്യം?';
            } else if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('വില')) {
                processedResponse = 'ഞങ്ങളുടെ കോഴ്സുകൾ ₹20,000 മുതൽ ₹35,000 വരെ ചിലവാകും. EMI ഓപ്ഷനുകളും ലഭ്യമാണ്. കൂടുതൽ വിവരങ്ങൾക്ക് ഞങ്ങളുടെ കൗൺസിലറുമായി സംസാരിക്കാം.';
            } else if (lowerMessage.includes('technology') || lowerMessage.includes('tech') || lowerMessage.includes('ടെക്')) {
                processedResponse = 'ഞങ്ങൾക്ക് ഫുൾ സ്റ്റാക്ക് ഡെവലപ്മെന്റ്, സോഫ്റ്റ്വെയർ എഞ്ചിനീയറിംഗ് എന്നീ ടെക് കോഴ്സുകൾ ഉണ്ട്. ഏതാണ് നിങ്ങൾക്ക് താല്പര്യം?';
            } else if (lowerMessage.includes('healthcare') || lowerMessage.includes('health') || lowerMessage.includes('ഹെൽത്ത്')) {
                processedResponse = 'ഞങ്ങൾക്ക് നഴ്സിംഗ് അസിസ്റ്റന്റ്, മെഡിക്കൽ കോഡിംഗ് എന്നീ ഹെൽത്ത്‌കെയർ കോഴ്സുകൾ ഉണ്ട്. ഏതാണ് നിങ്ങൾക്ക് താല്പര്യം?';
            } else if (lowerMessage.includes('business') || lowerMessage.includes('ബിസിനസ്')) {
                processedResponse = 'ഞങ്ങൾക്ക് ബിസിനസ് മാനേജ്മെന്റ്, ഡിജിറ്റൽ മാർക്കറ്റിംഗ് എന്നീ ബിസിനസ് കോഴ്സുകൾ ഉണ്ട്. ഏതാണ് നിങ്ങൾക്ക് താല്പര്യം?';
            } else if (lowerMessage.includes('yes') || lowerMessage.includes('അതെ') || lowerMessage.includes('ഉണ്ട്')) {
                processedResponse = 'മികച്ചത്! നിങ്ങളുടെ വിവരങ്ങൾ എടുക്കാൻ തുടങ്ങാം. നിങ്ങളുടെ പേര് എന്താണ്?';
            } else if (lowerMessage.includes('no') || lowerMessage.includes('ഇല്ല') || lowerMessage.includes('അല്ല')) {
                processedResponse = 'പ്രശ്നമില്ല! ഞങ്ങൾക്ക് മറ്റ് പല കോഴ്സുകളും ഉണ്ട്. ഞങ്ങളുടെ കൗൺസിലറുമായി സംസാരിക്കാൻ താല്പര്യമുണ്ടോ?';
            } else {
                processedResponse = 'നിങ്ങളുടെ ചോദ്യത്തിന് ഉത്തരം നൽകാൻ എനിക്ക് സന്തോഷമുണ്ട്. ഞങ്ങളുടെ വിദ്യാഭ്യാസ പ്രോഗ്രാമുകളെക്കുറിച്ച് കൂടുതൽ അറിയാൻ താല്പര്യമുണ്ടോ?';
            }
        }

        // Ensure conversation continues naturally in Malayalam
        if (!processedResponse.includes('?') && !processedResponse.includes('എന്ന്') && !processedResponse.includes('ആണ്') && !processedResponse.includes('നന്ദി')) {
            processedResponse += ' നിങ്ങൾക്ക് കൂടുതൽ ചോദ്യങ്ങൾ ഉണ്ടോ?';
        }

        return processedResponse;
    } catch (error) {
        logger.error('Error sending message to Gemini:', error);
        throw error;
    }
}

logger.success('Malayalam AI Agent Service initialized'); 