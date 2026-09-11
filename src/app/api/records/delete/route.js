import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bkbjuerluzdpsxiidlzh.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_9qebA-YUW3myzX8_3w-nDA_6VhgqBeU';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    let body = {};
    try {
      body = await req.json();
    } catch (e) {}

    const { type, id, trackingCode } = body;

    if (!type || (!id && !trackingCode)) {
      return NextResponse.json({ error: 'Missing type, id, or trackingCode' }, { status: 400 });
    }

    // Connect with Service Role (Bypasses RLS) if available, otherwise Anon Key
    const dbClient = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
      : createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

    if (type === 'hazard') {
      if (id) {
        await dbClient.from('road_hazards').delete().eq('id', id);
      }
      return NextResponse.json({ success: true, deletedType: 'hazard', id });
    }

    if (type === 'shipment') {
      if (id) {
        await dbClient.from('shipments').delete().eq('id', id);
      }
      if (trackingCode) {
        await dbClient.from('shipments').delete().eq('tracking_code', trackingCode);
      }
      return NextResponse.json({ success: true, deletedType: 'shipment', id, trackingCode });
    }

    return NextResponse.json({ error: 'Invalid record type' }, { status: 400 });
  } catch (err) {
    console.error('Delete record API error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
