import { GoogleGenAI, Type, Schema } from "@google/genai";
import { getRuntimeEnv } from "./runtime-env";

export interface ParsedLead {
  name: string;
  email: string;
  phone: string;
  propertyInterest: string;
  budget: string;
  source: string;
  inquiryMessage: string;
}

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description: "The name of the lead. If missing, use 'Unknown'.",
    },
    email: {
      type: Type.STRING,
      description: "The email address of the lead. If missing, use empty string.",
    },
    phone: {
      type: Type.STRING,
      description: "The phone number of the lead. If missing, use empty string.",
    },
    propertyInterest: {
      type: Type.STRING,
      description: "The property they are inquiring about (e.g. 'Mont Kiara Condo', '123 Main St'). If missing, use 'General Inquiry'.",
    },
    budget: {
      type: Type.STRING,
      description: "The stated budget if available (e.g. 'RM 850k', '$500,000'). If none stated, use 'Not specified'.",
    },
    source: {
      type: Type.STRING,
      description: "Where this lead originated from based on the email context (e.g. 'PropertyGuru', 'iProperty', 'Direct Email').",
    },
    inquiryMessage: {
      type: Type.STRING,
      description: "The raw message or comment written by the lead. If none, summarize the intent.",
    },
  },
  required: ["name", "email", "phone", "propertyInterest", "budget", "source", "inquiryMessage"],
};

export async function parseEmailForLead(emailBody: string): Promise<ParsedLead> {
  const env = getRuntimeEnv();
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    You are an expert real estate lead parser.
    Extract the lead information from the following raw email body.
    Ensure you capture the source of the lead (e.g., PropertyGuru, Zillow, Direct) and any specific message they left.
    
    Email Body:
    -----------------
    ${emailBody}
    -----------------
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.1,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Failed to parse email: No response from Gemini.");
  }

  try {
    const parsed = JSON.parse(text) as ParsedLead;
    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse Gemini JSON output: ${text}`);
  }
}
