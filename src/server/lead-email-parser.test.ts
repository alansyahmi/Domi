import { describe, expect, it } from "vitest";
import { extractEmailAddress, htmlToText, detectSource, parseLeadEmail } from "./lead-email-parser";

describe("extractEmailAddress", () => {
  it("pulls the address out of a display-name header", () => {
    expect(extractEmailAddress('"Jane Doe" <jane.doe@example.com>')).toBe("jane.doe@example.com");
  });

  it("handles a bare address and lowercases it", () => {
    expect(extractEmailAddress("JANE@EXAMPLE.COM")).toBe("jane@example.com");
  });

  it("returns empty string for junk", () => {
    expect(extractEmailAddress("not an email")).toBe("");
    expect(extractEmailAddress(null)).toBe("");
  });
});

describe("htmlToText", () => {
  it("strips tags and decodes entities", () => {
    const text = htmlToText("<p>Hi&nbsp;<b>there</b></p><div>Budget &gt; RM500k</div>");
    expect(text).toContain("Hi there");
    expect(text).toContain("Budget > RM500k");
    expect(text).not.toContain("<");
  });
});

describe("detectSource", () => {
  it("identifies PropertyGuru from the sender", () => {
    expect(detectSource({ from: "noreply@propertyguru.com.my", subject: "x", body: "" })).toBe("PropertyGuru");
  });

  it("identifies iProperty", () => {
    expect(detectSource({ from: "x@a.com", subject: "Lead from iProperty", body: "" })).toBe("iProperty");
  });

  it("falls back to Email Forward", () => {
    expect(detectSource({ from: "a@b.com", subject: "hi", body: "hello" })).toBe("Email Forward");
  });
});

describe("parseLeadEmail", () => {
  it("parses a labelled PropertyGuru enquiry", () => {
    const lead = parseLeadEmail({
      to: '"Leads" <inbound+ab12cd@leads.signatis.app>',
      from: "PropertyGuru <noreply@propertyguru.com.my>",
      subject: "New enquiry for Mont Kiara Condo",
      text: [
        "You have a new enquiry.",
        "Name: Ahmad Faizal",
        "Email: ahmad.faizal@gmail.com",
        "Phone: +60 12-345 6789",
        "Budget: RM 900,000",
        "Message: Hi, I'm very interested in viewing this unit this weekend.",
      ].join("\n"),
    });

    expect(lead).not.toBeNull();
    expect(lead!.name).toBe("Ahmad Faizal");
    expect(lead!.email).toBe("ahmad.faizal@gmail.com");
    expect(lead!.phone).toBe("+60 12-345 6789");
    expect(lead!.source).toBe("PropertyGuru");
    expect(lead!.budget).toBe("RM 900,000");
    expect(lead!.propertyInterest).toContain("Mont Kiara");
    expect(lead!.message).toContain("interested in viewing");
  });

  it("ignores the ingestion address when scanning for the lead email", () => {
    const lead = parseLeadEmail({
      to: "inbound+ab12cd@leads.signatis.app",
      from: "noreply@iproperty.com.my",
      subject: "New lead",
      text: "Reply to inbound+ab12cd@leads.signatis.app\nPhone: 0123456789\nbuyer@hotmail.com wants info",
    });
    expect(lead!.email).toBe("buyer@hotmail.com");
  });

  it("falls back to HTML body when no text is present", () => {
    const lead = parseLeadEmail({
      to: "inbound+ab12cd@leads.signatis.app",
      from: "EdgeProp <alerts@edgeprop.my>",
      subject: "Enquiry",
      html: "<div>Name: Siti Aminah</div><div>Mobile: 016-789 1234</div>",
    });
    expect(lead!.source).toBe("EdgeProp");
    expect(lead!.name).toBe("Siti Aminah");
    expect(lead!.phone).toContain("016");
  });

  it("returns null when there is no email or phone", () => {
    const lead = parseLeadEmail({
      to: "inbound+ab12cd@leads.signatis.app",
      from: "system@portal.com",
      subject: "Newsletter",
      text: "Check out our latest market report online.",
    });
    expect(lead).toBeNull();
  });

  it("derives a name from the email local-part as a last resort", () => {
    const lead = parseLeadEmail({
      to: "inbound+ab12cd@leads.signatis.app",
      from: "portal@portal.com",
      subject: "Lead",
      text: "Contact: john.smith@gmail.com",
    });
    expect(lead!.name.toLowerCase()).toContain("john");
  });
});
