import Link from 'next/link';
import {
  BookIcon,
  CheckIcon,
  CoinIcon,
  FlaskIcon,
  LockIcon,
  PenIcon,
  SearchIcon,
  SparklesIcon,
  UploadIcon,
  WalletIcon,
} from '@/components/icons';
import { Brand } from '@/components/Logo';
import {
  AIIllustration,
  EarnIllustration,
  ModerationIllustration,
  PracticeIllustration,
  QuestionBankIllustration,
  SearchIllustration,
  UploadIllustration,
  WithdrawalsIllustration,
} from '@/components/AnimatedIllustrations';
import { createClient } from '@/lib/supabase/server';

type LearningWay = {
  Illustration: (props: { className?: string }) => React.ReactElement;
  eyebrow: string;
  title: string;
  desc: string;
  bullets: { Icon: (p: { size?: number; className?: string }) => React.ReactElement; text: string }[];
};

const LEARNING_WAYS: LearningWay[] = [
  {
    Illustration: AIIllustration,
    eyebrow: 'AI study assistant',
    title: 'Get instant explanations and theory grading',
    desc:
      'Stuck on a question? Tap "explain" and our AI walks you through the concept. Theory answers are graded against the model answer with feedback you can actually learn from.',
    bullets: [
      { Icon: SparklesIcon, text: 'AI explanations for every question' },
      { Icon: CheckIcon, text: 'Automated grading for theory questions' },
      { Icon: PenIcon, text: 'Suggested model answers when contributors are unsure' },
    ],
  },
  {
    Illustration: QuestionBankIllustration,
    eyebrow: 'Question bank',
    title: 'Browse a structured catalogue of past questions',
    desc:
      'Filter by university, department, course, and year. Every question goes through moderation, so duplicates and noise are filtered out before they reach you.',
    bullets: [
      { Icon: BookIcon, text: 'Organised by school, department, and course' },
      { Icon: CheckIcon, text: 'Verified answers and explanations' },
      { Icon: SparklesIcon, text: 'New questions added by contributors weekly' },
    ],
  },
  {
    Illustration: PracticeIllustration,
    eyebrow: 'Practice exams',
    title: 'Sit timed mock exams and track your progress',
    desc:
      'Build a custom practice session by course, length, and question type. Pause anytime — your progress is saved. Review every past attempt with full explanations.',
    bullets: [
      { Icon: FlaskIcon, text: 'Mock exams that match your real paper' },
      { Icon: CheckIcon, text: 'See where you went wrong, with worked solutions' },
      { Icon: SparklesIcon, text: 'History view to track improvement over time' },
    ],
  },
  {
    Illustration: SearchIllustration,
    eyebrow: 'Full-text search',
    title: 'Find any past question in seconds',
    desc:
      'Type a topic, formula, or even part of a question. Search runs across the whole bank instantly so you spend time studying, not scrolling through PDFs.',
    bullets: [
      { Icon: SearchIcon, text: 'Search across thousands of questions' },
      { Icon: BookIcon, text: 'Filter by course, year, or question type' },
      { Icon: CheckIcon, text: 'Jump straight to the explanation' },
    ],
  },
];

type ContributorWay = {
  Illustration: (props: { className?: string }) => React.ReactElement;
  eyebrow: string;
  title: string;
  desc: string;
  bullets: { Icon: (p: { size?: number; className?: string }) => React.ReactElement; text: string }[];
};

const CONTRIBUTOR_WAYS: ContributorWay[] = [
  {
    Illustration: UploadIllustration,
    eyebrow: 'AI extraction',
    title: 'Upload a paper, we do the typing',
    desc:
      'Drop in a PDF or photo of a past exam paper. Our AI extracts the questions, options, and answers — you just review and confirm before they go live.',
    bullets: [
      { Icon: UploadIcon, text: 'PDFs and image scans both supported' },
      { Icon: SparklesIcon, text: 'AI handles the structure for you' },
      { Icon: PenIcon, text: 'Edit, delete, or merge before publishing' },
    ],
  },
  {
    Illustration: EarnIllustration,
    eyebrow: 'Earn for every batch',
    title: 'Earn for every 100 approved questions',
    desc:
      'For every 100 questions of yours that get approved, your wallet is credited with a fixed amount. No formulas, no waiting on monthly cycles — just upload, get approved, get paid.',
    bullets: [
      { Icon: CoinIcon, text: 'Fixed payout per 100 approved questions' },
      { Icon: CheckIcon, text: 'Credits land in your wallet automatically' },
      { Icon: SparklesIcon, text: 'See your progress to the next payout' },
    ],
  },
  {
    Illustration: WithdrawalsIllustration,
    eyebrow: 'Wallet',
    title: 'Withdraw to any Nigerian bank account',
    desc:
      'Connect a bank account once and withdraw your earnings on demand via Paystack. Fees are clear up front, with no hidden cuts.',
    bullets: [
      { Icon: WalletIcon, text: 'Direct payouts via Paystack' },
      { Icon: CoinIcon, text: 'Track every transaction in your wallet' },
      { Icon: CheckIcon, text: 'Clear, predictable fees' },
    ],
  },
  {
    Illustration: ModerationIllustration,
    eyebrow: 'Quality first',
    title: 'Your name stays on work you can be proud of',
    desc:
      'Every contribution goes through moderation before it earns. That keeps the bank trustworthy for students and protects the value of your share.',
    bullets: [
      { Icon: CheckIcon, text: 'Reviewed before going live' },
      { Icon: LockIcon, text: 'Anonymity options when you prefer' },
      { Icon: SparklesIcon, text: 'Promotion to contributor after approved work' },
    ],
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 font-sans">
      {/* Nav */}
      <nav className="sticky top-0 z-30 border-b border-zinc-100 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <Brand size="md" />
          <div className="hidden md:flex items-center gap-6 text-sm text-zinc-500 dark:text-zinc-400">
            <a href="#learn" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Learn</a>
            <a href="#contribute" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Contribute</a>
            <a href="#how-it-works" className="hover:text-zinc-900 dark:hover:text-white transition-colors">How it works</a>
            <a href="#faq" className="hover:text-zinc-900 dark:hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <a
                href="/dashboard"
                className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors font-medium"
              >
                Dashboard
              </a>
            ) : (
              <>
                <a
                  href="/login"
                  className="hidden sm:inline-flex text-sm text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors px-3 py-2"
                >
                  Log in
                </a>
                <a
                  href="/register"
                  className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors font-medium"
                >
                  Get started
                </a>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(34,197,94,0.18)_0%,transparent_70%)]"
        />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-white/70 dark:bg-zinc-900/70 backdrop-blur border border-green-200/70 dark:border-green-900 text-green-700 dark:text-green-400 text-xs font-medium px-3 py-1.5 rounded-full mb-6 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            Built for Nigerian university students
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-zinc-900 dark:text-white leading-[1.05] tracking-tight max-w-3xl mx-auto">
            Study smarter with{' '}
            <span className="text-green-600">AI-powered</span> past questions
          </h1>
          <p className="mt-5 sm:mt-6 text-base sm:text-lg text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Browse, search, and practice from a crowdsourced question bank — with instant AI
            explanations, theory grading, and timed mock exams. Or contribute and earn from every
            question you add.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={isLoggedIn ? '/dashboard' : '/register'}
              className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-3 rounded-lg transition-colors text-sm shadow-sm"
            >
              {isLoggedIn ? 'Open dashboard' : 'Start studying free'}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
            <a
              href="#contribute"
              className="inline-flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 font-medium px-6 py-3 rounded-lg transition-colors text-sm"
            >
              Earn as a contributor
            </a>
          </div>

          {/* Stats */}
          <div className="mt-14 sm:mt-16 grid grid-cols-3 gap-4 sm:gap-6 max-w-lg mx-auto">
            {[
              { value: '50K+', label: 'Questions' },
              { value: '200+', label: 'Courses' },
              { value: '₦2M+', label: 'Paid out' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">{stat.value}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For students */}
      <section
        id="learn"
        className="bg-zinc-50 dark:bg-zinc-900/40 border-y border-zinc-100 dark:border-zinc-800 py-16 sm:py-24"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/60 border border-green-200/70 dark:border-green-900 px-3 py-1 rounded-full">
              For students
            </div>
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white tracking-tight leading-tight">
              Four ways to learn — all in one place
            </h2>
            <p className="mt-3 text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Whether you&apos;re cramming the night before or revising over weeks, Examspace adapts to
              the way you study.
            </p>
          </div>

          <div className="mt-12 sm:mt-16 space-y-12 sm:space-y-20">
            {LEARNING_WAYS.map((way, i) => {
              const flip = i % 2 === 1;
              return (
                <div
                  key={way.title}
                  className={`grid lg:grid-cols-2 gap-8 sm:gap-12 items-center ${
                    flip ? 'lg:[&>*:first-child]:order-2' : ''
                  }`}
                >
                  <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6 shadow-sm">
                    <way.Illustration className="w-full h-auto" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
                      {way.eyebrow}
                    </p>
                    <h3 className="mt-2 text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight leading-snug">
                      {way.title}
                    </h3>
                    <p className="mt-3 text-zinc-500 dark:text-zinc-400 leading-relaxed">{way.desc}</p>
                    <ul className="mt-5 space-y-2.5">
                      {way.bullets.map((b) => (
                        <li key={b.text} className="flex items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                          <span className="mt-0.5 inline-flex w-6 h-6 rounded-md bg-green-50 dark:bg-green-950/60 text-green-600 dark:text-green-400 items-center justify-center shrink-0">
                            <b.Icon size={12} />
                          </span>
                          <span>{b.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-14 sm:mt-16 flex justify-center">
            <a
              href={isLoggedIn ? '/dashboard' : '/register'}
              className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-3 rounded-lg transition-colors text-sm shadow-sm"
            >
              {isLoggedIn ? 'Continue studying' : 'Start studying free'}
            </a>
          </div>
        </div>
      </section>

      {/* For contributors */}
      <section id="contribute" className="py-16 sm:py-24 bg-white dark:bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-200/70 dark:border-amber-900 px-3 py-1 rounded-full">
              For contributors
            </div>
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white tracking-tight leading-tight">
              Turn your past papers into income
            </h2>
            <p className="mt-3 text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Anyone can contribute. Upload questions, fix errors, or write better explanations — every
              100 approved questions credits your wallet automatically.
            </p>
          </div>

          <div className="mt-12 grid sm:grid-cols-2 gap-5 sm:gap-6">
            {CONTRIBUTOR_WAYS.map((way) => (
              <div
                key={way.title}
                className="group bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-5 sm:p-6 hover:border-green-300 dark:hover:border-green-800 transition-colors"
              >
                <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 mb-4 overflow-hidden">
                  <way.Illustration className="w-full h-auto" />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-green-600">
                  {way.eyebrow}
                </p>
                <h3 className="mt-1.5 text-lg sm:text-xl font-semibold text-zinc-900 dark:text-white tracking-tight">
                  {way.title}
                </h3>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {way.desc}
                </p>
                <ul className="mt-4 space-y-2">
                  {way.bullets.map((b) => (
                    <li key={b.text} className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                      <span className="mt-0.5 inline-flex w-5 h-5 rounded bg-green-50 dark:bg-green-950/60 text-green-600 dark:text-green-400 items-center justify-center shrink-0">
                        <b.Icon size={10} />
                      </span>
                      <span>{b.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Earn CTA */}
          <div className="mt-14 sm:mt-16 rounded-2xl bg-green-600 text-white px-6 py-10 sm:p-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 shadow-sm">
            <div>
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">Ready to earn?</h3>
              <p className="mt-2 text-green-100 text-sm sm:text-base max-w-xl leading-relaxed">
                Sign up free, upload your first paper, and watch your contribution score grow. Withdrawals
                land in your bank via Paystack.
              </p>
            </div>
            <a
              href="/register"
              className="inline-flex items-center justify-center bg-white text-green-700 hover:bg-green-50 font-semibold px-6 py-3 rounded-lg transition-colors text-sm shrink-0 shadow-sm"
            >
              Start contributing
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="bg-zinc-50 dark:bg-zinc-900/40 border-y border-zinc-100 dark:border-zinc-800 py-16 sm:py-20"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-xl mx-auto mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">
              How Examspace works
            </h2>
            <p className="mt-2 text-sm sm:text-base text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Three steps to start studying — or to start earning.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {[
              {
                step: '1',
                title: 'Create an account',
                desc: 'Sign up with your university email and pick the school and department you study in.',
              },
              {
                step: '2',
                title: 'Unlock or contribute',
                desc:
                  'Subscribe to your department to study, or start contributing — your first uploads are free to publish.',
              },
              {
                step: '3',
                title: 'Study and earn',
                desc:
                  'Practice with AI explanations and earn as your questions are studied by other students.',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-10 h-10 rounded-full bg-green-600 text-white font-bold text-sm flex items-center justify-center mx-auto mb-4 shadow-sm">
                  {item.step}
                </div>
                <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight text-center mb-10">
            Frequently asked questions
          </h2>
          <div className="space-y-3">
            {[
              {
                q: 'How does the AI grading work?',
                a: 'For theory questions, our AI compares your answer with the model answer and a rubric, then gives a score and feedback. You can flag a grade if you disagree — moderators review flagged grades.',
              },
              {
                q: 'Do I need to pay to start?',
                a: 'You can sign up, browse course names, and contribute for free. To browse and practice questions you subscribe per department — bundle multiple in one checkout.',
              },
              {
                q: 'How are contributors paid?',
                a: 'For every 100 of your questions that get approved, your wallet is credited with a fixed amount that admins can change at any time. The credit lands in your wallet automatically — withdraw to any Nigerian bank account once you’re above the minimum.',
              },
              {
                q: 'What if I find a wrong answer?',
                a: 'Use the flag button on any question. Moderators review every flag, and corrections you submit count towards your next 100-question payout.',
              },
            ].map((item) => (
              <details
                key={item.q}
                className="group bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 px-5 py-4 open:border-green-200 dark:open:border-green-900 transition-colors"
              >
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 text-sm font-medium text-zinc-900 dark:text-white">
                  {item.q}
                  <span className="text-zinc-400 group-open:rotate-45 transition-transform text-lg leading-none">+</span>
                </summary>
                <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-100 dark:border-zinc-800 py-10 sm:py-12 bg-white dark:bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <Brand size="sm" />
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-xs">
                Crowdsourced exam question bank built for Nigerian university students.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                <li><a href="#learn" className="hover:text-green-600 transition-colors">For students</a></li>
                <li><a href="#contribute" className="hover:text-green-600 transition-colors">For contributors</a></li>
                <li><a href="#how-it-works" className="hover:text-green-600 transition-colors">How it works</a></li>
                <li><a href="/questions" className="hover:text-green-600 transition-colors">Browse questions</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">Account</h4>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                <li><a href="/register" className="hover:text-green-600 transition-colors">Create account</a></li>
                <li><a href="/login" className="hover:text-green-600 transition-colors">Log in</a></li>
                <li><a href="/dashboard" className="hover:text-green-600 transition-colors">Dashboard</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                <li><Link href="/privacy" className="hover:text-green-600 transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-green-600 transition-colors">Terms of Service</Link></li>
                <li>
                  <a href="mailto:spendbox@gmail.com" className="hover:text-green-600 transition-colors">
                    Contact support
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-zinc-400">
              © {new Date().getFullYear()} Examspace · examspace.xyz
            </p>
            <p className="text-xs text-zinc-400">
              Questions? <a href="mailto:spendbox@gmail.com" className="text-green-600 hover:text-green-700">spendbox@gmail.com</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
