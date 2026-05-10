import type { Metadata } from 'next';
import Link from 'next/link';
import { Brand } from '@/components/Logo';
import { ArrowLeftIcon } from '@/components/icons';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The rules for using Examspace as a student or contributor.',
};

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: '1. Your account',
    body: (
      <p>
        You must be at least 16 years old to use Examspace. You are responsible for keeping your password
        secure and for the activity that happens under your account.
      </p>
    ),
  },
  {
    title: '2. Subscriptions and access',
    body: (
      <>
        <p>
          Some content is unlocked through a paid subscription per university and department. Subscriptions
          renew on the term you select (monthly, quarterly, or yearly) and can be cancelled at any time
          from your dashboard. Payments are processed by Paystack.
        </p>
        <p>
          Refunds are not provided for time already used; if you believe a charge was made in error, contact
          us within 7 days at the email below.
        </p>
      </>
    ),
  },
  {
    title: '3. Contributions and contributor rewards',
    body: (
      <>
        <p>
          When you upload past papers or contribute questions you grant Examspace a non-exclusive licence to
          host, display, and share that content with other users on the platform. You confirm that you have
          the right to share what you upload and that the material does not infringe anyone else&apos;s
          rights.
        </p>
        <p>
          For every 100 of your questions that are approved and not removed, your Examspace wallet is
          credited with the contributor reward shown on the wallet page. The reward amount can change
          from time to time; new buckets are credited at whatever the current rate is. Funds can be
          withdrawn to a Nigerian bank account once you reach the minimum shown on your wallet page.
        </p>
      </>
    ),
  },
  {
    title: '4. Acceptable use',
    body: (
      <>
        <p>You agree not to:</p>
        <ul className="list-disc ml-5 space-y-1.5">
          <li>upload content that is plagiarised, defamatory, illegal, or hateful;</li>
          <li>use automated tools to scrape the platform or extract bulk data;</li>
          <li>resell access to your account or share login credentials;</li>
          <li>attempt to interfere with the platform&apos;s security or availability.</li>
        </ul>
        <p>
          We may remove content and suspend accounts that break these rules, with refunds at our
          discretion.
        </p>
      </>
    ),
  },
  {
    title: '5. AI-generated content',
    body: (
      <p>
        AI-generated explanations and grades are provided as a study aid and may occasionally be wrong. You
        are encouraged to flag mistakes; the official answer remains the one verified by moderators.
      </p>
    ),
  },
  {
    title: '6. Disclaimers',
    body: (
      <p>
        Examspace is provided &quot;as is&quot;. We do our best to keep the service running and accurate but
        we don&apos;t guarantee that it will always be available or free of errors. To the extent permitted
        by law, we are not liable for indirect or consequential losses arising from your use of the
        platform.
      </p>
    ),
  },
  {
    title: '7. Changes to these terms',
    body: (
      <p>
        We may update these terms occasionally. If we make a material change we will notify you by email or
        through the dashboard. Continued use of the platform after a change means you accept the updated
        terms.
      </p>
    ),
  },
  {
    title: '8. Contact',
    body: (
      <p>
        Questions, takedown requests, or anything else? Email{' '}
        <a href="mailto:spendbox@gmail.com" className="text-green-600 hover:text-green-700 font-medium">
          spendbox@gmail.com
        </a>
        .
      </p>
    ),
  },
];

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            The rules for using Examspace as a student or contributor. Last updated 9 May 2026.
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
          <Link href="/privacy" className="text-green-600 hover:text-green-700">
            Privacy Policy
          </Link>
          .
        </p>
      </article>
    </div>
  );
}
