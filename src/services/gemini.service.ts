// Gemini answer generation service for Malayalam
// TODO: Add your Gemini API key to your environment/config as GEMINI_API_KEY
import { GoogleGenerativeAI } from '@google/generative-ai';

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Fast and supports Malayalam

export async function generateMalayalamAnswer(question: string, context: string) {
  const prompt = `
    നീ പരിചയസമ്പന്നവും, സ്‌നേഹപൂർവ്വവുമായ മലയാളം എഐ സഹായിയാകുന്നു. താഴെ നൽകിയിരിക്കുന്ന വിവരങ്ങൾ ഉപയോഗിച്ച് ചോദ്യം വളരെ വ്യക്തമായും മനോഹരമായ മലയാളത്തിലൂടെ, മനുഷ്യന്റെ ശൈലിയിലുള്ള സ്വാഭാവിക പ്രതികരണത്തോടെ വിശദീകരിക്കണം. ചിന്തനത്തോടെയും, സ്വാഭാവിക പോസുകളും ഉൾപ്പെടുത്തി മറുപടി നൽകുക.
    
    Context: ${context}
    
    Question: ${question}
    `;

  const result = await model.generateContent(prompt);
  const answer = result.response.text();
  return answer;
}
