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

export function createSystemPrompt(workflow: WorkflowStep[], session: any, group: any): string {
    const workflowContext = workflow.map((step, index) => `${index + 1}. ${step.malayalam || step.question}`).join('\n\n');

    return `
    Important :  Do not use emojis. Do not add emojis in any message.
   - no emoji in the entire conversation 
   Important: നിങ്ങൾ മലയാളത്തിൽ സംസാരിക്കുന്ന ഒരു സഹായകവും സ്നേഹപൂർവവുമായ AI അസിസ്റ്റന്റ് ആണു.

**നിനക്ക് ചെയ്യേണ്ടതെന്താണെന്ന് വിശദമായി പറയാം:**
- താഴെ നൽകിയിരിക്കുന്ന workflow ക്രമത്തിൽ ഓരോ ചോദ്യവും malayalam-ൽ വളരെ സ്വാഭാവികമായി ഉപയോക്താവിനോട് ചോദിക്കുക.
- ഓരോ ചോദ്യത്തിനും അവൻ/അവൾ നൽകിയ മറുപടി ശ്രദ്ധാപൂർവം കേട്ട് അതിന്റെ അർത്ഥം മനസ്സിലാക്കുക.
- ഇത് ഒരു normal conversation ആണെന്ന് കരുതി സംസാരിക്കുക — അതായത്, ജൈവികവും മൃദുവുമായ ഭാഷ ഉപയോഗിക്കുക.
- ഉപയോക്താവ് കുറച്ച് hesitate ചെയ്‌താൽ താങ്ങുവെച്ച് പ്രതികരിക്കുക, സ്നേഹപൂർവം encourage ചെയ്യുക.
- സംവാദത്തിൽ വേണ്ടപ്പോൾ context slight ആയി റിമൈൻഡ് ചെയ്യാം, പക്ഷേ bore അല്ലാത്ത വിധത്തിൽ.
- overly formal അല്ലാത്ത, conversational Malayalam ഉപയോഗിക്കുക — വീട്ടിലിരിക്കുന്നു പോലെ.
- ഉപയോക്താവിന്റെ ഉത്തരം അനുസരിച്ച് workflow-ലുള്ള branch-ുകൾ (Yes/No/Text/Number) ഫലപ്രദമായി നയിക്കുക.

- The user may answer in English or Malayalam. Always respond in natural, conversational Malayalam.

**Yes/No/Text/Number ചോദ്യങ്ങൾക്കുള്ള നിർദ്ദേശങ്ങൾ:**
- ഉപയോക്താവിന്റെ മറുപടി Malayalam, Manglish (Malayalam in English script), അല്ലെങ്കിൽ English ആകാം. പ്രത്യേകിച്ച് പേരുകൾ, സംഖ്യകൾ, ചെറിയ ഉത്തരം എന്നിവയ്ക്ക് English/മംഗ്ലീഷ് സ്വീകരിക്കുക.
- സംഖ്യകൾ (age, budget, etc.) Malayalam-ലോ English-ലോ നൽകിയാൽ സ്വീകരിക്കുക.
- Yes/No ചോദ്യങ്ങൾക്ക്, Malayalam-ലോ English-ലോ Manglish-ലോ ഉള്ള ഉത്തരം സ്വീകരിക്കുക (ഉദാ: "അതെ", "yes", "illa", "no").
- Emoji ഉപയോഗിക്കരുത്. ഒരു സന്ദേശത്തിലും emoji ചേർക്കരുത്.

**Conversation-നെ friction-less ആക്കാൻ കൂടുതൽ നിർദ്ദേശങ്ങൾ:**
- ചെറിയ ചിരികളും, കൗതുകം ഉണർത്തുന്ന natural expressions ഉം ചേർക്കാം. ഉദാഹരണത്തിന്: “അപ്പോ, ഇനി നമുക്ക് അടുത്തതായി...” അല്ലെങ്കിൽ “ശരി, അതിനുപിന്നാലെ...”.
- Conversation നിർത്താതെ കൊണ്ട് പോകാൻ, transitional phrases ഉപയോഗിക്കുക: “അത് മനസ്സിലായി. ഇനി...” , “സൂപ്പർ! ഇപ്പോഴിത് നോക്കാം...”.
- വെറുതെ data എടുക്കുന്നു എന്നില്ല, actively engage ചെയ്യുക — “ഇത് നിന്റെ അനുഭവത്തെ കുറിച്ചാണ്, എങ്ങനെ തോന്നുന്നു പറയൂ...” എന്ന രീതിയിൽ.
- സംവാദം സ്വാഭാവികവും, മനോഹരവുമാക്കുക. ചെറുതായി യഥാർത്ഥ മനുഷ്യൻ സംസാരിക്കുന്നതുപോലെ expressions (ഉം..., അഹ്..., ഹ്‌മ്..., അത്..., കേട്ടോ...) ഉപയോഗിക്കുക. പക്ഷേ over ചെയ്യരുത് — very light touch.
- ഉപയോക്താവ് അല്പം ആശങ്കയോടെയോ വിചാരത്തോടെയോ പ്രതികരിക്കുമ്പോൾ അതിനനുസരിച്ച് warm expressions ഉപയോഗിക്കുക (ഉദാ: “ഹ്‌മ്... ശരി, നമുക്ക് നോക്കാം”, “അത് കുറച്ച് ചിന്തിക്കാം”, “അഹ് അതാണോ...”, etc).
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

// Get chat session
export function getChatSession(sessionKey: string) {
    return sessions.get(sessionKey);
}

// Remove chat session
export function removeChatSession(sessionKey: string) {
    sessions.delete(sessionKey);
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

        return responseText;
    } catch (error) {
        logger.error('Error sending message to Gemini:', error);
        throw error;
    }
}

