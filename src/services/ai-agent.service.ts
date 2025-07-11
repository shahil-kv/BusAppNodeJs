// Simplified AI Agent Service for Twilio ConversationRelay
// Fully Malayalam-focused conversational AI
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { WorkflowStep } from '../types/call.types';

const gemini = new GoogleGenerativeAI(env.GEMINI_API_KEY);
const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

// Store active chat sessions
const sessions = new Map();

export function createSystemPrompt(workflow: WorkflowStep[]): string {
    const workflowContext = workflow.map((step, index) => `${index + 1}. ${step.malayalam || step.question}`).join('\n\n');

    return `
    Important :  Do not use emojis. Do not add emojis in any message.
   - no emoji in the entire conversation 
   Important: നിങ്ങൾ മലയാളത്തിൽ സംസാരിക്കുന്ന ഒരു സഹായകവും സ്നേഹപൂർവവുമായ AI അസിസ്റ്റന്റ് ആണു.

**നിനക്ക് ചെയ്യേണ്ടതെന്താണെന്ന് വിശദമായി പറയാം:**

**പ്രധാന നിർദ്ദേശങ്ങൾ:**
- ഇത് ഒരു natural conversation ആണ് — യഥാർത്ഥ മനുഷ്യൻ സംസാരിക്കുന്നതുപോലെ സംസാരിക്കുക
- ഉപയോക്താവ് എന്ത് ചോദിച്ചാലും ആദ്യം അതിന് ഉത്തരം നൽകുക (workflow ചോദ്യമല്ലെങ്കിലും)
- ഉത്തരം നൽകിയ ശേഷം സ്വാഭാവികമായി workflow-ലേക്ക് തിരികെ പോകുക
- ഒരിക്കലും ഉപയോക്താവിന്റെ ചോദ്യങ്ങൾ ignore ചെയ്യരുത്
- എല്ലാ ചോദ്യങ്ങൾക്കും ഉത്തരം നൽകുക, പക്ഷേ workflow-നെ ഓർക്കുക

**Workflow ചോദ്യങ്ങൾക്കുള്ള നിർദ്ദേശങ്ങൾ:**
- താഴെ നൽകിയിരിക്കുന്ന workflow ക്രമത്തിൽ ഓരോ ചോദ്യവും malayalam-ൽ വളരെ സ്വാഭാവികമായി ഉപയോക്താവിനോട് ചോദിക്കുക.
- ഓരോ ചോദ്യത്തിനും അവൻ/അവൾ നൽകിയ മറുപടി ശ്രദ്ധാപൂർവം കേട്ട് അതിന്റെ അർത്ഥം മനസ്സിലാക്കുക.
- ഉപയോക്താവിന്റെ ഉത്തരം അനുസരിച്ച് workflow-ലുള്ള branch-ുകൾ (Yes/No/Text/Number) ഫലപ്രദമായി നയിക്കുക.

**General Questions ചെയ്യുമ്പോൾ:**
- ഉപയോക്താവ് workflow-ലെ ചോദ്യമല്ലാത്ത എന്തെങ്കിലും ചോദിച്ചാൽ, ആദ്യം അതിന് സഹായകരമായ ഉത്തരം നൽകുക
- ഉത്തരം നൽകിയ ശേഷം സ്വാഭാവികമായി workflow-ലെ അടുത്ത ചോദ്യത്തിലേക്ക് തിരികെ പോകുക
- ഉദാഹരണം: "അത് നല്ല ചോദ്യമാണ്. [ഉത്തരം]. ഇനി നമുക്ക് അടുത്തതായി..."

**Conversation Style:**
- ജൈവികവും മൃദുവുമായ ഭാഷ ഉപയോഗിക്കുക
- ഉപയോക്താവ് കുറച്ച് hesitate ചെയ്‌താൽ താങ്ങുവെച്ച് പ്രതികരിക്കുക, സ്നേഹപൂർവം encourage ചെയ്യുക
- overly formal അല്ലാത്ത, conversational Malayalam ഉപയോഗിക്കുക — വീട്ടിലിരിക്കുന്നു പോലെ
- ചെറിയ ചിരികളും, കൗതുകം ഉണർത്തുന്ന natural expressions ഉം ചേർക്കാം
- Conversation നിർത്താതെ കൊണ്ട് പോകാൻ, transitional phrases ഉപയോഗിക്കുക

**Yes/No/Text/Number ചോദ്യങ്ങൾക്കുള്ള നിർദ്ദേശങ്ങൾ:**
- ഉപയോക്താവിന്റെ മറുപടി Malayalam, Manglish (Malayalam in English script), അല്ലെങ്കിൽ English ആകാം
- സംഖ്യകൾ (age, budget, etc.) Malayalam-ലോ English-ലോ നൽകിയാൽ സ്വീകരിക്കുക
- Yes/No ചോദ്യങ്ങൾക്ക്, Malayalam-ലോ English-ലോ Manglish-ലോ ഉള്ള ഉത്തരം സ്വീകരിക്കുക
- The user may answer in English or Malayalam. Always respond in natural, conversational Malayalam.

**Workflow ചോദ്യങ്ങൾ:**
${workflowContext}

`.trim();
}
// Initialize Gemini chat session with Malayalam focus
export function initializeChatSession(sessionKey: string, systemPrompt: string) {

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
        return chat;
    } catch (error) {
        logger.error('Error initializing Malayalam chat session:', error);
        throw error;
    }
}


// Send message to Gemini and get Malayalam response
export async function sendMessageToGemini(sessionKey: string, message: string, onToken?: (token: string, isLast: boolean) => Promise<void> | void): Promise<string> {

    try {
        const chat = sessions.get(sessionKey);
        if (!chat) {
            throw new Error(`No chat session found for key: ${sessionKey}`);
        }
        // Use Gemini streaming API if callback is provided
        if (onToken) {
            const aiStart = Date.now();
            logger.log(`[TIMING] [AI] [Gemini] Streaming AI start: ${aiStart}`);
            const stream = await chat.sendMessageStream(message);
            let lastToken = '';
            for await (const chunk of stream.stream) {
                const token = chunk.text();
                lastToken += token;
                await onToken(token, false);
            }
            await onToken('', true); // signal end of stream
            const aiEnd = Date.now();
            logger.log(`[TIMING] [AI] [Gemini] Streaming AI end: ${aiEnd}, duration: ${aiEnd - aiStart}ms`);
            return lastToken;
        } else {
            const aiStart = Date.now();
            logger.log(`[TIMING] [AI] [Gemini] Non-streaming AI start: ${aiStart}`);
            const result = await chat.sendMessage(message);
            const responseText = result.response.text();
            const aiEnd = Date.now();
            logger.log(`[TIMING] [AI] [Gemini] Non-streaming AI end: ${aiEnd}, duration: ${aiEnd - aiStart}ms`);
            return responseText;
        }
    } catch (error) {
        logger.error('Error sending message to Gemini:', error);
        throw error;
    }
}

