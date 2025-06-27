// Dialogflow CX intent classification service
// TODO: Add your Dialogflow CX project ID, agent ID, location, and API key to your environment/config
import { SessionsClient } from '@google-cloud/dialogflow-cx';

const projectId = process.env.DIALOGFLOW_PROJECT_ID; // TODO
const agentId = process.env.DIALOGFLOW_AGENT_ID; // TODO
const location = process.env.DIALOGFLOW_LOCATION || 'global'; // TODO
const languageCode = 'en-in'; // Malayalam

const client = new SessionsClient({
  apiEndpoint: `${location}-dialogflow.googleapis.com`,
});

export async function classifyIntent(text: string, sessionId: string) {
  try {
    // Validate required environment variables
    if (!projectId || !agentId) {
      throw new Error(
        'Missing required environment variables: DIALOGFLOW_PROJECT_ID and DIALOGFLOW_AGENT_ID',
      );
    }

    console.log('=== Dialogflow Configuration ===');
    console.log('Project ID:', projectId);
    console.log('Agent ID:', agentId);
    console.log('Location:', location);
    console.log('Language Code:', languageCode);
    console.log('Session ID:', sessionId);
    console.log('Input Text:', text);

    // Construct the session path
    const sessionPath = client.projectLocationAgentSessionPath(
      projectId,
      location,
      agentId,
      sessionId,
    );

    console.log('Session Path:', sessionPath);

    // Prepare the request
    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: 'Yes', // Use the actual input text, not hardcoded
        },
        languageCode: 'en',
      },
      // Optional: Add query parameters if needed
      queryParams: {
        // timeZone: 'Asia/Kolkata', // Uncomment if you need timezone
        // currentPage: 'projects/PROJECT_ID/locations/LOCATION/agents/AGENT_ID/flows/FLOW_ID/pages/PAGE_ID', // Uncomment if you need to specify current page
      },
    };

    console.log('=== Request Details ===');
    console.log(JSON.stringify(request, null, 2));

    // Make the API call
    console.log('Calling detectIntent...');
    const [response] = await client.detectIntent(request);

    console.log('=== Response Details ===');
    console.log('Full Response:', JSON.stringify(response, null, 2));

    // Extract and log key information
    const queryResult = response.queryResult;
    if (queryResult) {
      console.log('Intent Display Name:', queryResult.intent?.displayName);
      console.log('Intent Detection Confidence:', queryResult.intentDetectionConfidence);
      console.log('Match Type:', queryResult.match?.matchType);
      console.log('Current Page:', queryResult.currentPage?.displayName);
      console.log('Parameters:', queryResult.parameters);
      console.log('Response Messages:', queryResult.responseMessages);
    }

    // Return structured response
    return {
      success: true,
      intent: queryResult?.intent?.displayName || 'Default Welcome Intent',
      confidence: queryResult?.intentDetectionConfidence || 0,
      matchType: queryResult?.match?.matchType,
      parameters: queryResult?.parameters,
      responseText:
        queryResult?.responseMessages?.[0]?.text?.text?.[0] ||
        queryResult?.responseMessages?.[0]?.payload ||
        '',
      currentPage: queryResult?.currentPage?.displayName,
      languageCode: queryResult?.languageCode,
      rawResponse: response, // Include full response for debugging
    };
  } catch (error) {
    console.error('=== Dialogflow Error ===');
    console.error('Error details:', error);

    // More detailed error handling
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }

    return {
      success: false,
      error: true,
      message: 'Failed to classify intent',
      details: error instanceof Error ? error.message : String(error),
      errorType: error?.constructor?.name || 'Unknown',
    };
  }
}
