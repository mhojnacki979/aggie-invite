/**
 * The Supabase project behind score check-in (`aggie-checkin`). Both values are public by design: they
 * ship in the browser bundle, and Row Level Security is what keeps anyone but the signed-in crew from
 * reading or changing checkmarks. The service-role key never belongs here.
 */
export const CHECKIN_SUPABASE_URL = 'https://josfssiwxtskqbtfeerz.supabase.co'
export const CHECKIN_SUPABASE_KEY = 'sb_publishable_STXMx6c--bQRhjZVg59hjA_WxqpE-WJ'
