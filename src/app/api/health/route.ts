import { NextResponse } from 'next/server';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hasPaystack = !!process.env.PAYSTACK_SECRET_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  return NextResponse.json({
    status: 'ok',
    env: {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ?? 'MISSING',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: hasAnonKey ? 'SET' : 'MISSING',
      SUPABASE_SERVICE_ROLE_KEY: hasServiceKey ? 'SET' : 'MISSING',
      PAYSTACK_SECRET_KEY: hasPaystack ? 'SET' : 'MISSING',
      OPENAI_API_KEY: hasOpenAI ? 'SET' : 'MISSING',
    },
  });
}
