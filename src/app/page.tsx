import { BookIcon, CheckIcon, CoinIcon, SearchIcon, SparklesIcon, WalletIcon } from '@/components/icons';
import { Brand } from '@/components/Logo';
import { createClient } from '@/lib/supabase/server';

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
            <a href="#features" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-zinc-900 dark:hover:text-white transition-colors">How it works</a>
            <a href="#earn" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Earn</a>
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
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-950/60 border border-green-200/70 dark:border-green-900 text-green-700 dark:text-green-400 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
          Built for Nigerian university students
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-zinc-900 dark:text-white leading-[1.1] tracking-tight max-w-3xl mx-auto">
          Study smarter with a{" "}
          <span className="text-green-600">crowdsourced</span>{" "}
          exam question bank
        </h1>
        <p className="mt-5 sm:mt-6 text-base sm:text-lg text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
          Access thousands of past questions by school, department, and course.
          Upload your exam papers, contribute questions, and earn real money.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={isLoggedIn ? '/dashboard' : '/register'}
            className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-3 rounded-lg transition-colors text-sm shadow-sm"
          >
            {isLoggedIn ? 'Open dashboard' : 'Start for free'}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
          <a
            href="/questions"
            className="inline-flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 font-medium px-6 py-3 rounded-lg transition-colors text-sm"
          >
            Browse questions
          </a>
        </div>

        {/* Stats */}
        <div className="mt-14 sm:mt-16 grid grid-cols-3 gap-4 sm:gap-6 max-w-lg mx-auto">
          {[
            { value: "50K+", label: "Questions" },
            { value: "200+", label: "Courses" },
            { value: "₦2M+", label: "Paid out" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">{stat.value}</div>
              <div className="text-xs text-zinc-400 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-zinc-50 dark:bg-zinc-900/50 border-y border-zinc-100 dark:border-zinc-800 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white text-center mb-10 sm:mb-12 tracking-tight">
            Everything you need to ace your exams
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[
              { Icon: BookIcon, title: "Structured question bank", desc: "Browse questions filtered by school, department, course, and year. Never search through PDFs again." },
              { Icon: SparklesIcon, title: "AI-powered extraction", desc: "Upload a past question paper — our AI extracts and structures every question automatically." },
              { Icon: CoinIcon, title: "Earn from contributions", desc: "Every question you upload or contribute earns you a share of the monthly revenue pool." },
              { Icon: SearchIcon, title: "Full-text search", desc: "Search across thousands of questions instantly. Find exactly what you're studying." },
              { Icon: WalletIcon, title: "Instant withdrawals", desc: "Withdraw your earnings directly to any Nigerian bank account via Paystack." },
              { Icon: CheckIcon, title: "Quality moderation", desc: "Every question is reviewed before going live. No spam, no duplicates, no noise." },
            ].map(({ Icon, title, desc }) => (
              <div
                key={title}
                className="bg-white dark:bg-zinc-900 rounded-xl p-5 sm:p-6 border border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700 transition-colors"
              >
                <span className="inline-flex w-10 h-10 rounded-lg bg-green-50 dark:bg-green-950/60 text-green-600 dark:text-green-400 items-center justify-center mb-3">
                  <Icon size={18} />
                </span>
                <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">{title}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white text-center mb-10 sm:mb-12 tracking-tight">
            How it works
          </h2>
          <div className="grid sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {[
              { step: "1", title: "Create an account", desc: "Sign up free with your university email and set your school and department." },
              { step: "2", title: "Upload or contribute", desc: "Upload a past question PDF or manually add questions to your course's bank." },
              { step: "3", title: "Earn as others study", desc: "Each view of your questions earns you a share of the platform's revenue pool." },
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

      {/* Earn CTA */}
      <section id="earn" className="bg-green-600 py-14 sm:py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 tracking-tight">
            Turn your past questions into income
          </h2>
          <p className="text-green-100 mb-7 sm:mb-8 leading-relaxed text-sm sm:text-base">
            Contributors earn monthly from a shared revenue pool — distributed based on
            how many questions you've added and how often they're viewed.
          </p>
          <a
            href="/register"
            className="inline-flex items-center justify-center bg-white text-green-700 hover:bg-green-50 font-semibold px-6 py-3 rounded-lg transition-colors text-sm shadow-sm"
          >
            Start contributing today
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-100 dark:border-zinc-800 py-8 sm:py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Brand size="sm" />
          <p className="text-xs text-zinc-400 text-center">
            © {new Date().getFullYear()} Examspace. Built for Nigerian students.
          </p>
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <a href="/api/health" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Status</a>
            <a href="mailto:support@examspace.xyz" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
