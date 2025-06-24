import { NextStepResponse, WorkflowStep } from '../types/call.types';

// Default workflow
const defaultWorkflows = {
  group1: [
    {
      step_id: 1,
      question: 'Hello! Are you interested in data science? Please say yes or no.',
      malayalam: 'നിനക്ക് ഡാറ്റാ സയൻസ് താല്പര്യമുണ്ടോ? അതെ അല്ലെങ്കിൽ ഇല്ല എന്ന് പറയൂ।',
      yes_next: 2,
      no_next: 3,
    },
    {
      step_id: 2,
      question: 'Great! When would you like to start? This week or next week?',
      malayalam: 'നല്ലത്! എപ്പോൾ തുടങ്ങണം? ഈ ആഴ്ച അതോ അടുത്ത ആഴ്ച?',
      yes_next: 4,
      no_next: 5,
    },
    {
      step_id: 3,
      question: 'Thank you for your time. Have a great day!',
      malayalam: 'നിങ്ങളുടെ സമയത്തിന് നന്ദി. നല്ല ദിവസം!',
      yes_next: null,
      no_next: null,
    },
    {
      step_id: 4,
      question: 'Perfect! We will contact you this week. Thank you!',
      malayalam: 'മികച്ചത്! ഞങ്ങൾ ഈ ആഴ്ച നിങ്ങളെ ബന്ധപ്പെടും. നന്ദി!',
      yes_next: null,
      no_next: null,
    },
    {
      step_id: 5,
      question: 'No problem! We will contact you next week. Thank you!',
      malayalam: 'കുഴപ്പമില്ല! ഞങ്ങൾ അടുത്ത ആഴ്ച നിങ്ങളെ ബന്ധപ്പെടും. നന്ദി!',
      yes_next: null,
      no_next: null,
    },
  ],
};

// System prompt for Gemini
const malayalamPhrases = {
  yes: ['അതെ', 'ഉണ്ട്', 'വേണം'],
  no: ['ഇല്ല', 'ellaa', 'വേണ്ട', 'താല്പര്യമില്ല'],
  thisWeek: ['ഈ ആഴ്ച'],
  nextWeek: ['അടുത്ത ആഴ്ച'],
};

const systemPrompt = `
  You are a conversational AI agent for a call system. Your role is to guide users through a predefined workflow while understanding natural language responses in English and Malayalam. The workflow is as follows:
  
  Workflow Steps:
  ${JSON.stringify(defaultWorkflows.group1, null, 2)}
  
  Common Malayalam phrases:
  Yes: ${malayalamPhrases.yes.join(', ')}
  No: ${malayalamPhrases.no.join(', ')}
  This week: ${malayalamPhrases.thisWeek.join(', ')}
  Next week: ${malayalamPhrases.nextWeek.join(', ')}
  
  Instructions:
  - Ask questions based on the workflow steps, starting from step_id 1.
  - Understand user responses in English (e.g., "yes", "no", "this week") and Malayalam (e.g., "അതെ" for yes, "ഇല്ല" or "ellaa" for no).
  - If the response is unclear, politely ask for clarification in the user's language (e.g., "Could you please say yes or no clearly?" or "ദയവായി വ്യക്തമായി അതെ അല്ലെങ്കിൽ ഇല്ല എന്ന് പറയൂ।").
  - Respond naturally, like a human, in Malayalam or English based on user input.
  - Keep responses concise and conversational.
  - Move to the next step based on the user's response (yes_next or no_next).
  - If no next step exists, end the conversation politely with "Thank you for your time. Have a great day!" or its Malayalam equivalent.
  - Return responses in JSON format: { nextStep: WorkflowStep | null, shouldEnd: boolean }.
  `;

// Helper to fetch workflow steps from DB or fallback
async function getWorkflowSteps(group): Promise<WorkflowStep[]> {
  if (group?.workflows?.steps) {
    try {
      const steps = Array.isArray(group.workflows.steps)
        ? group.workflows.steps
        : JSON.parse(group.workflows.steps);
      return steps.map((step) => ({
        step_id: step.step_id || step.id,
        question: step.question,
        malayalam: step.malayalam,
        yes_next: step.yes_next || step.branch?.yes,
        no_next: step.no_next || step.branch?.no,
      }));
    } catch (e) {
      console.error('Failed to parse workflow steps from DB:', e);
    }
  }
  return defaultWorkflows['group1'];
}

// Helper to clean response text
function cleanResponseText(text: string): string {
  // Remove markdown code block markers, backticks, and trim whitespace
  return text
    .replace(/^```(?:json)?\n?/, '') // Remove opening ```json or ```
    .replace(/\n?```$/, '') // Remove closing ```
    .replace(/`/g, '') // Remove stray backticks
    .replace(/\n\s*\n/g, '\n') // Collapse multiple newlines
    .trim();
}

async function generateNextStep(
  currentStep: WorkflowStep,
  userResponse: string,
  workflow: WorkflowStep[],
): Promise<NextStepResponse> {
  try {
    const prompt = `
${systemPrompt}

Current Step: ${JSON.stringify(currentStep)}
User Response: ${userResponse}
Workflow: ${JSON.stringify(workflow)}
Determine the next step based on the user's response. Return a JSON object with { nextStep, shouldEnd }.
`;

    // Dynamic import for Google GenAI (ES Module)
    const { GoogleGenAI } = await import('@google/genai');
    const genAI = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || 'your-gemini-api-key',
    });

    const response = await genAI.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    let text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    console.log('Raw Gemini response:', text);
    text = cleanResponseText(text);
    console.log('Cleaned Gemini response:', text);

    if (!text) {
      throw new Error('Empty response from Gemini API');
    }

    let result;
    try {
      result = JSON.parse(text);
    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON:', text, parseError);
      throw parseError;
    }

    // Validate result structure
    if (typeof result !== 'object' || result === null || !('shouldEnd' in result)) {
      console.error('Invalid Gemini response structure:', result);
      throw new Error('Invalid response structure from Gemini API');
    }

    console.log('Parsed Gemini result:', result);
    return result as NextStepResponse;
  } catch (error) {
    console.error('Error with Gemini API:', error);
    // Fallback to keyword-based logic
    const response = userResponse.toLowerCase().trim();
    let nextStepId: number | string | undefined;
    const yesKeywords = [
      'yes',
      'yeah',
      'yep',
      'sure',
      'okay',
      'ok',
      ...malayalamPhrases.yes,
    ];
    const noKeywords = ['no', 'nope', 'not', ...malayalamPhrases.no];

    const isYesResponse = yesKeywords.some((keyword) => response.includes(keyword));
    const isNoResponse = noKeywords.some((keyword) => response.includes(keyword));

    if (currentStep.step_id === 2) {
      if (
        malayalamPhrases.thisWeek.some((kw) => response.includes(kw.toLowerCase())) ||
        response.includes('this week')
      ) {
        nextStepId = currentStep.yes_next; // Step 4
      } else if (
        malayalamPhrases.nextWeek.some((kw) => response.includes(kw.toLowerCase())) ||
        response.includes('next week')
      ) {
        nextStepId = currentStep.no_next; // Step 5
      } else {
        nextStepId = undefined; // Unclear response
      }
    } else {
      nextStepId = isYesResponse
        ? currentStep.yes_next
        : isNoResponse
        ? currentStep.no_next
        : undefined;
    }

    if (!nextStepId) {
      const clarificationStep: WorkflowStep = {
        step_id: `${currentStep.step_id}_clarify`,
        question: "I didn't understand your response. Please say yes or no clearly.",
        malayalam:
          'നിങ്ങളുടെ ഉത്തരം മനസ്സിലായില്ല. ദയവായി വ്യക്തമായി അതെ അല്ലെങ്കിൽ ഇല്ല എന്ന് പറയൂ।',
        yes_next: currentStep.yes_next,
        no_next: currentStep.no_next,
      };
      console.log('Returning clarification step:', clarificationStep);
      return { nextStep: clarificationStep, shouldEnd: false };
    }

    const nextStep = workflow.find((s) => s.step_id === nextStepId);
    // Check if the next step is terminal (no further branches)
    const shouldEnd =
      !nextStep || (nextStep.yes_next === null && nextStep.no_next === null);
    console.log('Fallback result:', { nextStep, shouldEnd });
    return { nextStep: nextStep || null, shouldEnd };
  }
}

export { generateNextStep, getWorkflowSteps };
