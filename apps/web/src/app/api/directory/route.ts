import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';
  const category = searchParams.get('category') || '';

  const response = new NextResponse();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        response.cookies.set(name, value, options);
      },
      remove(name: string, options: Record<string, unknown>) {
        response.cookies.set(name, '', { ...options, maxAge: 0 });
      },
    },
  });

  let dbQuery = supabase
    .from('directory_listings')
    .select('*')
    .eq('is_published', true);

  if (category) {
    dbQuery = dbQuery.eq('category', category);
  }

  if (query) {
    dbQuery = dbQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%,address.ilike.%${query}%`);
  }

  // Order: Premium listings first, then by rating desc, then by review count desc, then name asc
  const { data, error } = await dbQuery
    .order('tier', { ascending: false })
    .order('rating', { ascending: false, nullsFirst: false })
    .order('user_ratings_total', { ascending: false, nullsFirst: false })
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ listings: data || [] });
}
