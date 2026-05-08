import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// POST /api/admin/auth — sign in (or auto-create) admin using env var credentials
export async function POST(req: NextRequest) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return NextResponse.json(
      { error: 'ADMIN_EMAIL and ADMIN_PASSWORD are not configured in environment variables' },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({ email: '', password: '' }));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  if (email !== adminEmail.trim().toLowerCase() || password !== adminPassword) {
    return NextResponse.json({ error: 'Incorrect admin credentials' }, { status: 401 });
  }

  const supabase = await createClient();

  // Try signing in first
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });

  if (!signInError && signInData.user) {
    // Ensure profile row exists with admin role
    const adminClient = createAdminClient();
    await adminClient.from('users').upsert(
      { id: signInData.user.id, email: adminEmail, full_name: 'Admin', role: 'admin' },
      { onConflict: 'id', ignoreDuplicates: false },
    );
    return NextResponse.json({ ok: true });
  }

  // Sign-in failed — auto-create the admin account
  const adminClient = createAdminClient();
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? 'Failed to create admin account' },
      { status: 500 },
    );
  }

  await adminClient.from('users').insert({
    id: created.user.id,
    email: adminEmail,
    full_name: 'Admin',
    role: 'admin',
  });

  // Now sign in
  const { error: secondSignInError } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });

  if (secondSignInError) {
    return NextResponse.json({ error: secondSignInError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
