import type { Metadata } from 'next';
import Link from 'next/link';
import { Brand } from '@/components/Logo';
import { ArrowLeftIcon } from '@/components/icons';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Examspace collects, uses, and protects your data.',
};

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: '1. Information we collect',
    body: (
      <>
        <p>
          When you create an Examspace account we collect your email address, your full name (optional),
          and the school and department you study in. We also store the questions, comments, and uploaded
          files you contribute, along with your practice attempts so you can review them later.
        </p>
        <p>
          For payments and withdrawals we work with Paystack. We never store your card or bank credentials
          on our servers — only the bank account name and number you choose to save for payouts.
        </p>
      </>
    ),
  },
  {
    title: '2. How we use your information',
    body: (
      <>
        <p>
          Your information is used to give you access to the question bank, to track contributions for
          revenue sharing, to grade your practice exams, and to communicate important account or payment
          events with you. We do not sell your personal data to third parties.
        </p>
      </>
    ),
  },
  {
    title: '3. AI processing',
    body: (
      <>
        <p>
          Some Examspace features (extracting questions from uploaded papers, grading theory answers,
          generating explanations) send the relevant text or image to a third-party AI provider. The
          provider processes the content only to return a result and does not use it to train models on
          your behalf.
        </p>
      </>
    ),
  },
  {
    title: '4. Cookies and analytics',
    body: (
      <p>
        We use a small number of strictly necessary cookies to keep you signed in. We may use privacy-
        respecting analytics to understand which pages are popular; this never includes personally
        identifying details.
      </p>
    ),
  },
  {
    title: '5. Your rights',
    body: (
      <p>
        You can request a copy of your data, ask us to correct it, or ask us to delete your account at any
        time by emailing the address below. We will respond within a reasonable period.
      </p>
    ),
  },
  {
    title: '6. Contact',
    body: (
      <p>
        Questions about this policy? Email{' '}
        <a href="mailto:spendbox@gmail.com" className="text-green-600 hover:text-green-700 font-medium">
          spendbox@gmail.com
        </a>
        .
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeftIcon size={14} /> Home
          </Link>
          <Brand size="sm" />
        </div>
      </nav>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <header className="mb-10">
          <p className="text-xs font-medium uppercase tracking-wide text-green-600">Legal</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            How we collect, use, and protect the information you give us. Last updated 9 May 2026.
          </p>
        </header>

        <div className="space-y-8">
          {SECTIONS.map((s) => (
            <section
              key={s.title}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 p-5 sm:p-6"
            >
              <h2 className="font-semibold text-zinc-900 dark:text-white">{s.title}</h2>
              <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-3">
                {s.body}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-10 text-xs text-zinc-400 text-center">
          See also our{' '}
          <Link href="/terms" className="text-green-600 hover:text-green-700">
            Terms of Service
          </Link>
          .
        </p>
      </article>
    </div>
  );
}
