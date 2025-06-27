// Intelligent AI Agent for Call System
// Replaces Dialogflow with Gemini-based intent classification and workflow management
import { GoogleGenerativeAI } from '@google/generative-ai';
import { queryPineconeWithCache } from '../utils/pinecone.utils';
import { generateMalayalamAnswer } from './gemini.service';

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });

export interface AIAgentResponse {
    action: 'workflow' | 'document' | 'clarification' | 'end' | 'interruption' | 'emotional';
    confidence: number;
    nextStep?: any;
    shouldEnd?: boolean;
    documentAnswer?: string;
    clarificationMessage?: string;
    reasoning: string;
    // New fields for enhanced handling
    mixedIntent?: boolean;
    primaryAction?: string;
    secondaryAction?: string;
    emotionalState?: 'angry' | 'confused' | 'happy' | 'neutral';
    interruptionType?: 'question' | 'objection' | 'request';
}

export interface WorkflowContext {
    currentStep: any;
    workflow: any[];
    sessionId: string;
    userResponse: string;
    // Enhanced context
    callDuration?: number;
    previousResponses?: string[];
    userEmotionalState?: string;
}

// Enhanced system prompt for intelligent call agent
const createSystemPrompt = (workflowContext: WorkflowContext) => `
You are an intelligent AI call agent for sales and marketing calls. Your role is to understand user responses and guide them through workflows while providing helpful information.

CURRENT CONTEXT:
- Current Workflow Step: ${JSON.stringify(workflowContext.currentStep)}
- Available Workflow Steps: ${JSON.stringify(workflowContext.workflow)}
- User Response: "${workflowContext.userResponse}"
- Session ID: ${workflowContext.sessionId}
- Call Duration: ${workflowContext.callDuration || 0} seconds
- Previous Responses: ${JSON.stringify(workflowContext.previousResponses || [])}

ENHANCED WORKFLOW RULES:
1. If user gives simple affirmative responses (yes, okay, sure, അതെ, ഉണ്ട്, വേണം), proceed to next workflow step
2. If user asks questions or seeks information, provide document-based answers first, then continue workflow
3. If user response is unclear, ask for clarification
4. If workflow is complete, end the call politely
5. If user shows mixed intent (yes + question), handle both parts appropriately
6. If user is emotional (angry, confused), address emotions first, then continue
7. If user interrupts with objections, handle objections before continuing
8. If user speaks in mixed language (English + Malayalam), understand both parts

RESPONSE TYPES:
- "workflow": User wants to proceed with workflow (simple yes/no responses)
- "document": User is asking for information/details (questions, concerns, clarifications)
- "clarification": User response is unclear, need to ask for clarification
- "end": Workflow is complete, end the call
- "interruption": User interrupted with objection or urgent question
- "emotional": User showing strong emotional state that needs addressing

MALAYALAM LANGUAGE PATTERNS:
- Affirmative: അതെ, ഉണ്ട്, വേണം, ശരി, ഓക്കെ, ഹോ
- Negative: ഇല്ല, വേണ്ട, ഇല്ലാ, അല്ല
- Questions: എന്ത്, എവിടെ, എപ്പോൾ, എങ്ങനെ, എന്തുകൊണ്ട്, ആര്
- Emotions: ക്ഷമിക്കണം (sorry), എനിക്ക് ബുദ്ധിമുട്ടാണ് (I'm confused), എനിക്ക് ദേഷ്യമാണ് (I'm angry)
- Mixed responses: "അതെ പക്ഷേ എന്ത്" (Yes but what), "ശരി എന്നാൽ എവിടെ" (Okay then where)

EXAMPLES:
- "Yes" → workflow action
- "അതെ" → workflow action  
- "Where is this happening?" → document action
- "എവിടെയാണ് ഇത് നടക്കുന്നത്?" → document action
- "അതെ പക്ഷേ എവിടെയാണ്?" → mixed intent (workflow + document)
- "എനിക്ക് ബുദ്ധിമുട്ടാണ്" → emotional action
- "ക്ഷമിക്കണം എനിക്ക് സമയമില്ല" → interruption action
- "Hmm" → clarification action
- "ഹും" → clarification action

Return JSON response in this exact format:
{
  "action": "workflow|document|clarification|end|interruption|emotional",
  "confidence": 0.95,
  "reasoning": "Brief explanation of decision",
  "nextStep": {workflow step object} // only for workflow action
  "shouldEnd": true/false // only for workflow action
  "documentAnswer": "Answer to provide" // only for document action
  "clarificationMessage": "Message to ask for clarification" // only for clarification action
  "mixedIntent": true/false // if user has multiple intents
  "primaryAction": "main action to take"
  "secondaryAction": "secondary action if mixed intent"
  "emotionalState": "angry|confused|happy|neutral" // only for emotional action
  "interruptionType": "question|objection|request" // only for interruption action
}
`;

export async function analyzeUserResponse(workflowContext: WorkflowContext): Promise<AIAgentResponse> {
    try {
        console.log('=== AI Agent Analysis Started ===');
        console.log('User Response:', workflowContext.userResponse);
        console.log('Current Step:', workflowContext.currentStep);

        const systemPrompt = createSystemPrompt(workflowContext);

        const result = await model.generateContent(systemPrompt);

        const responseText = result.response.text();
        console.log('Raw AI Agent Response:', responseText);

        // Clean and parse the response
        const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
        const parsedResponse = JSON.parse(cleanedResponse);

        console.log('Parsed AI Agent Response:', parsedResponse);

        return {
            action: parsedResponse.action,
            confidence: parsedResponse.confidence || 0.8,
            reasoning: parsedResponse.reasoning || 'AI analysis completed',
            nextStep: parsedResponse.nextStep,
            shouldEnd: parsedResponse.shouldEnd,
            documentAnswer: parsedResponse.documentAnswer,
            clarificationMessage: parsedResponse.clarificationMessage,
            mixedIntent: parsedResponse.mixedIntent,
            primaryAction: parsedResponse.primaryAction,
            secondaryAction: parsedResponse.secondaryAction,
            emotionalState: parsedResponse.emotionalState,
            interruptionType: parsedResponse.interruptionType
        };

    } catch (error) {
        console.error('Error in AI Agent analysis:', error);

        // Enhanced fallback logic with better Malayalam support
        const response = workflowContext.userResponse.toLowerCase().trim();

        // Enhanced keyword detection
        const yesKeywords = ['yes', 'yeah', 'yep', 'sure', 'okay', 'ok', 'അതെ', 'ഉണ്ട്', 'വേണം', 'ശരി', 'ഓക്കെ', 'ഹോ'];
        const noKeywords = ['no', 'nope', 'not', 'ഇല്ല', 'ellaa', 'വേണ്ട', 'അല്ല', 'ഇല്ലാ'];
        const questionKeywords = ['what', 'where', 'when', 'how', 'why', 'who', 'എന്ത്', 'എവിടെ', 'എപ്പോൾ', 'എങ്ങനെ', 'എന്തുകൊണ്ട്', 'ആര്'];
        const emotionalKeywords = ['ക്ഷമിക്കണം', 'ബുദ്ധിമുട്ടാണ്', 'ദേഷ്യമാണ്', 'സമയമില്ല', 'വേഗം', 'sorry', 'confused', 'angry', 'busy'];
        const interruptionKeywords = ['ഇപ്പോൾ', 'ഇന്ന്', 'ഇല്ല', 'വേണ്ട', 'now', 'today', 'stop', 'wait'];

        const isYesResponse = yesKeywords.some(keyword => response.includes(keyword));
        const isNoResponse = noKeywords.some(keyword => response.includes(keyword));
        const isQuestion = questionKeywords.some(keyword => response.includes(keyword)) || response.includes('?');
        const isEmotional = emotionalKeywords.some(keyword => response.includes(keyword));
        const isInterruption = interruptionKeywords.some(keyword => response.includes(keyword));

        // Check for mixed intent (yes/no + question)
        const hasYesNo = isYesResponse || isNoResponse;
        const hasQuestion = isQuestion;
        const mixedIntent = hasYesNo && hasQuestion;

        if (isEmotional) {
            return {
                action: 'emotional',
                confidence: 0.8,
                reasoning: 'Fallback: Detected emotional keywords',
                emotionalState: response.includes('ദേഷ്യമാണ്') || response.includes('angry') ? 'angry' : 'confused'
            };
        } else if (isInterruption) {
            return {
                action: 'interruption',
                confidence: 0.7,
                reasoning: 'Fallback: Detected interruption keywords',
                interruptionType: isQuestion ? 'question' : 'objection'
            };
        } else if (mixedIntent) {
            return {
                action: 'workflow',
                confidence: 0.7,
                reasoning: 'Fallback: Mixed intent detected, prioritizing workflow',
                mixedIntent: true,
                primaryAction: 'workflow',
                secondaryAction: 'document',
                nextStep: null,
                shouldEnd: false
            };
        } else if (isQuestion) {
            return {
                action: 'document',
                confidence: 0.7,
                reasoning: 'Fallback: Detected question keywords',
                documentAnswer: null
            };
        } else if (isYesResponse || isNoResponse) {
            return {
                action: 'workflow',
                confidence: 0.8,
                reasoning: 'Fallback: Detected yes/no response',
                nextStep: null,
                shouldEnd: false
            };
        } else {
            return {
                action: 'clarification',
                confidence: 0.6,
                reasoning: 'Fallback: Unclear response',
                clarificationMessage: 'ദയവായി നിങ്ങളുടെ മറുപടി വ്യക്തമാക്കാമോ?'
            };
        }
    }
}

export async function handleDocumentQuery(userResponse: string): Promise<string> {
    try {
        console.log('=== Document Query Handler ===');
        console.log('Query:', userResponse);

        // Query Pinecone for relevant context
        const context = await queryPineconeWithCache(userResponse, 3);
        console.log('Pinecone Context Retrieved');

        // Generate answer using Gemini
        const answer = await generateMalayalamAnswer(userResponse, context);
        console.log('Generated Answer:', answer);

        // Fallback if no answer
        const finalAnswer = answer && answer.trim() !== ''
            ? answer
            : 'ക്ഷമിക്കണം, അതിനുള്ള വിവരം എനിക്ക് ലഭ്യമല്ല.';

        return finalAnswer;

    } catch (error) {
        console.error('Error in document query handler:', error);
        return 'ക്ഷമിക്കണം, ഇപ്പോൾ വിവരം നൽകാൻ കഴിയില്ല. ദയവായി വീണ്ടും ചോദിക്കൂ.';
    }
}

export async function getNextWorkflowStep(currentStep: any, userResponse: string, workflow: any[]): Promise<{ nextStep: any, shouldEnd: boolean }> {
    try {
        console.log('=== Workflow Step Handler ===');
        console.log('Current Step:', currentStep);
        console.log('User Response:', userResponse);

        const response = userResponse.toLowerCase().trim();
        const yesKeywords = ['yes', 'yeah', 'yep', 'sure', 'okay', 'ok', 'അതെ', 'ഉണ്ട്', 'വേണം'];
        const noKeywords = ['no', 'nope', 'not', 'ഇല്ല', 'ellaa', 'വേണ്ട'];

        const isYesResponse = yesKeywords.some(keyword => response.includes(keyword));
        const isNoResponse = noKeywords.some(keyword => response.includes(keyword));

        let nextStepId: number | string | undefined;

        // Handle special case for step 2 (timing question)
        if (currentStep.step_id === 2) {
            if (response.includes('this week') || response.includes('ഈ ആഴ്ച')) {
                nextStepId = currentStep.yes_next;
            } else if (response.includes('next week') || response.includes('അടുത്ത ആഴ്ച')) {
                nextStepId = currentStep.no_next;
            } else {
                nextStepId = isYesResponse ? currentStep.yes_next : currentStep.no_next;
            }
        } else {
            nextStepId = isYesResponse ? currentStep.yes_next : currentStep.no_next;
        }

        const nextStep = workflow.find(s => s.step_id === nextStepId);
        const shouldEnd = !nextStep || (nextStep.yes_next === null && nextStep.no_next === null);

        console.log('Next Step Result:', { nextStep, shouldEnd });

        return { nextStep: nextStep || null, shouldEnd };

    } catch (error) {
        console.error('Error in workflow step handler:', error);
        return { nextStep: null, shouldEnd: true };
    }
} 