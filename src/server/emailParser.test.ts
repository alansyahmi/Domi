import { describe, it, expect, vi } from 'vitest';
import { parseEmailForLead } from './emailParser';

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class {
      models = {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            name: "John Doe",
            email: "john@example.com",
            phone: "0123456789",
            propertyInterest: "Mont Kiara Condo",
            budget: "RM 800k",
            source: "PropertyGuru",
            inquiryMessage: "I am interested to view this unit."
          })
        })
      };
    },
    Type: { OBJECT: "OBJECT", STRING: "STRING" },
    Schema: {}
  };
});

vi.mock('./runtime-env', () => {
  return {
    getRuntimeEnv: () => ({ GEMINI_API_KEY: "test-key" })
  };
});

describe('emailParser', () => {
  it('should parse an email and return a structured lead', async () => {
    const rawEmail = `
      From: PropertyGuru <leads@propertyguru.com.my>
      Subject: New Enquiry for Mont Kiara Condo
      
      You have a new enquiry from John Doe.
      Email: john@example.com
      Phone: 0123456789
      Message: I am interested to view this unit.
    `;

    const result = await parseEmailForLead(rawEmail);
    
    expect(result.name).toBe("John Doe");
    expect(result.email).toBe("john@example.com");
    expect(result.propertyInterest).toBe("Mont Kiara Condo");
    expect(result.source).toBe("PropertyGuru");
    expect(result.inquiryMessage).toBe("I am interested to view this unit.");
  });
});
