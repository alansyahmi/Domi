import { BookOpen, ChevronDown, FileCheck2, Gavel, Headphones, Scale, Send, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FormEvent, useState } from "react";
import type { Agent, SupportRequest } from "../types";

const legalDocuments: Array<{ title: string; text: string; icon: LucideIcon }> = [
  { title: "PDPA Compliance", text: "Data protection guidelines and privacy protocols.", icon: ShieldCheck },
  { title: "Terms of Service", text: "Rules and guidelines for platform usage.", icon: BookOpen },
  { title: "Privacy Policy", text: "How agent and client data are secured.", icon: ShieldCheck },
  { title: "Data Processing Addendum", text: "Specifics on third-party data handling.", icon: Gavel },
];

const faqs = [
  {
    question: "How is the Lead Binary Score calculated?",
    answer: "Domi combines email opens, report clicks, report views, and inquiry sentiment into a transparent rule-based score.",
  },
  {
    question: "Can I export my client data?",
    answer: "Yes. Lead and report data are scoped to your agent account and can be exported from the lead pipeline.",
  },
  {
    question: "How do I report a system inaccuracy?",
    answer: "Submit a support request with the affected lead or report title so the data can be reviewed.",
  },
];

export default function LegalSupportPage({
  agent,
  onSubmitSupport,
}: {
  agent: Agent;
  onSubmitSupport: (input: Pick<SupportRequest, "name" | "category" | "subject" | "message">) => Promise<void>;
}) {
  const [openFaq, setOpenFaq] = useState(0);
  const [form, setForm] = useState({
    name: agent.fullName,
    category: "Technical Issue",
    subject: "",
    message: "",
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSubmitSupport(form);
    setForm({ ...form, subject: "", message: "" });
  }

  return (
    <main className="page">
      <h1 className="section-title">Legal & Support Center</h1>
      <p className="mt-4 max-w-3xl text-xl text-slate-700">
        Access compliance documentation, find answers to common questions, or reach out to support.
      </p>

      <div className="mt-10 grid grid-cols-1 xl:grid-cols-[minmax(0,1.8fr)_minmax(22rem,0.9fr)] gap-8">
        <section className="card p-7">
          <div className="flex items-center gap-4 border-b border-slate-200 pb-5">
            <FileCheck2 size={34} aria-hidden="true" />
            <h2 className="m-0 text-3xl font-extrabold">Compliance & Legal Documents</h2>
          </div>
          <div className="mt-7 grid grid-cols-1 md:grid-cols-2 gap-5">
            {legalDocuments.map(({ title, text, icon: Icon }) => (
              <article key={title} className="rounded-md border border-slate-200 bg-slate-50 p-5 flex gap-4">
                <Icon size={24} aria-hidden="true" />
                <div>
                  <h3 className="m-0 font-extrabold">{title}</h3>
                  <p className="m-0 mt-1 text-slate-700">{text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="card bg-[#1a2b3c] p-8 text-white">
          <div className="flex gap-5">
            <Scale size={40} className="text-[#ffd45a]" aria-hidden="true" />
            <h2 className="m-0 text-3xl font-extrabold">Amanah Principles</h2>
          </div>
          <p className="mt-8 text-lg leading-8 text-slate-200">
            Domi prioritizes transparent data collection, binary decision clarity, no dark patterns, and user autonomy.
          </p>
          <ul className="mt-8 grid gap-5 p-0 list-none font-bold">
            {["Transparent Data Collection", "Binary Decision Clarity", "No Dark Patterns", "User Autonomy First"].map(
              (item) => (
                <li key={item} className="flex items-center gap-3">
                  <ShieldCheck size={20} className="text-emerald-400" aria-hidden="true" />
                  {item}
                </li>
              ),
            )}
          </ul>
        </aside>
      </div>

      <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-8">
        <section className="card p-7">
          <div className="flex items-center gap-4 border-b border-slate-200 pb-5">
            <BookOpen size={32} aria-hidden="true" />
            <h2 className="m-0 text-3xl font-extrabold">Frequently Asked Questions</h2>
          </div>
          <div className="mt-7 grid gap-4">
            {faqs.map((faq, index) => (
              <article key={faq.question} className="rounded-md border border-slate-200 bg-slate-50">
                <button
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left font-extrabold"
                  onClick={() => setOpenFaq(openFaq === index ? -1 : index)}
                >
                  {faq.question}
                  <ChevronDown size={22} aria-hidden="true" />
                </button>
                {openFaq === index ? <p className="m-0 px-5 pb-5 text-slate-700">{faq.answer}</p> : null}
              </article>
            ))}
          </div>
        </section>

        <form className="card p-7" onSubmit={(event) => void submit(event)}>
          <div className="flex items-center gap-4 border-b border-slate-200 pb-5">
            <Headphones size={32} aria-hidden="true" />
            <h2 className="m-0 text-3xl font-extrabold">Contact Support</h2>
          </div>
          <div className="mt-7 grid grid-cols-1 md:grid-cols-2 gap-5">
            <label className="form-field">
              <span className="form-label">Name</span>
              <input
                className="input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label className="form-field">
              <span className="form-label">Issue Category</span>
              <select
                className="select"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              >
                <option>Technical Issue</option>
                <option>Billing</option>
                <option>Data Accuracy</option>
                <option>Compliance</option>
              </select>
            </label>
            <label className="form-field md:col-span-2">
              <span className="form-label">Subject</span>
              <input
                className="input"
                value={form.subject}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
                placeholder="Brief summary of your issue"
              />
            </label>
            <label className="form-field md:col-span-2">
              <span className="form-label">Message</span>
              <textarea
                className="textarea"
                value={form.message}
                onChange={(event) => setForm({ ...form, message: event.target.value })}
                placeholder="Provide details..."
              />
            </label>
          </div>
          <div className="mt-7 flex justify-end">
            <button className="primary-button" type="submit">
              <Send size={19} aria-hidden="true" />
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
