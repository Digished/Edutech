import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// POST /api/admin/seed — one-time admin account creation using env vars
// Protected: only works if ADMIN_EMAIL and ADMIN_PASSWORD are set
export async function POST() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return NextResponse.json(
      { error: 'ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment variables' },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Check if this admin already exists
  const { data: existing } = await supabase
    .from('users')
    .select('id, role')
    .eq('email', adminEmail)
    .single();

  if (existing) {
    if (existing.role === 'admin') {
      return NextResponse.json({ message: 'Admin account already exists', id: existing.id });
    }
    // Promote existing user to admin
    await supabase.from('users').update({ role: 'admin' }).eq('id', existing.id);
    return NextResponse.json({ message: 'Existing user promoted to admin', id: existing.id });
  }

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? 'Failed to create auth user' }, { status: 500 });
  }

  // Insert profile with admin role
  const { error: profileError } = await supabase.from('users').insert({
    id: authData.user.id,
    email: adminEmail,
    full_name: 'Admin',
    role: 'admin',
  });

  if (profileError) {
    // Rollback auth user
    await supabase.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Admin account created successfully', id: authData.user.id });
}
