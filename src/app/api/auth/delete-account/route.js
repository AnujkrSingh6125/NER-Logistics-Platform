import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader ? authHeader.replace('Bearer ', '').trim() : null;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bkbjuerluzdpsxiidlzh.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_9qebA-YUW3myzX8_3w-nDA_6VhgqBeU';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    let body = {};
    try {
      body = await req.json();
    } catch (e) {}

    const requestedUserId = body.userId;

    // 1. Authenticate the caller
    let authenticatedUserId = null;

    if (token) {
      const userAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });
      const { data: { user }, error: userError } = await userAuthClient.auth.getUser(token);
      if (user && !userError) {
        authenticatedUserId = user.id;
      }
    }

    const targetUserId = authenticatedUserId || requestedUserId;

    if (!targetUserId) {
      return NextResponse.json({ error: 'Unauthorized or missing userId' }, { status: 401 });
    }

    // 2. Select client for database operations
    const dbClient = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
      : createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false },
          global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
        });

    // 3. Purge shipments (live convoys / journeys)
    try {
      await dbClient.from('shipments').delete().eq('driver_id', targetUserId);
    } catch (e) {
      console.warn('Shipment driver_id purge note:', e);
    }
    try {
      await dbClient.from('shipments').delete().eq('assigned_driver_id', targetUserId);
    } catch (e) {
      console.warn('Shipment assigned_driver_id purge note:', e);
    }

    // 4. Purge road hazards
    try {
      await dbClient.from('road_hazards').delete().eq('reported_by', targetUserId);
    } catch (e) {
      console.warn('Hazard reported_by purge note:', e);
    }
    try {
      await dbClient.from('road_hazards').delete().eq('reported_by_id', targetUserId);
    } catch (e) {
      console.warn('Hazard reported_by_id purge note:', e);
    }

    // 5. Purge driver profile
    try {
      await dbClient.from('driver_profiles').delete().eq('id', targetUserId);
    } catch (e) {
      console.warn('Profile purge note:', e);
    }

    // 6. Invoke DB RPC function delete_user_account() if created in Postgres
    try {
      await dbClient.rpc('delete_user_account');
    } catch (rpcErr) {
      console.warn('RPC delete_user_account note:', rpcErr);
    }

    // 7. If service role key is present, delete auth.users record via Admin API
    let authUserDeleted = false;
    if (serviceRoleKey) {
      try {
        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { error: adminDelError } = await adminClient.auth.admin.deleteUser(targetUserId);
        if (!adminDelError) {
          authUserDeleted = true;
        } else {
          console.warn('Admin deleteUser note:', adminDelError);
        }
      } catch (adminErr) {
        console.warn('Admin auth deletion note:', adminErr);
      }
    }

    return NextResponse.json({
      success: true,
      purged: {
        userId: targetUserId,
        tables: ['shipments', 'road_hazards', 'driver_profiles'],
        authUserDeleted,
      },
    });
  } catch (error) {
    console.error('Delete account API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
