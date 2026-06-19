const fs = require("fs");
const { PDFParse } = require("pdf-parse");
const src = "C:/Users/irfan/Downloads/Billion Dollar Investor Presentation.pdf";

(async () => {
  const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(src)) });
  const result = await parser.getText();
  const text = result.text.replace(/\n{3,}/g, "\n\n");
  fs.writeFileSync("C:/Users/irfan/.antigravity/Domi/pitch-deck/pdf-text.txt", text);
  console.log("PAGES:", result.total || result.pages?.length || "?");
  console.log("CHARS:", text.length);
  console.log("===FIRST 7000===");
  console.log(text.slice(0, 7000));
  await parser.destroy();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
