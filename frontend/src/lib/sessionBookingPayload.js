/** Build session booking payload for enrollment API from cart lines or URL params. */
export function sessionBookingsFromCartItems(items = []) {
  const rows = [];
  const seen = new Set();
  for (const item of items) {
    if (item?.type !== 'session') continue;
    const booking_date = String(item.selectedDate || '').trim().slice(0, 10);
    const booking_time = String(item.selectedTime || '').trim();
    if (!booking_date && !booking_time) continue;
    const key = `${item.programId || item.sessionId}|${booking_date}|${booking_time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      session_id: String(item.programId || item.sessionId || '').trim(),
      session_title: String(item.programTitle || '').trim(),
      booking_date,
      booking_time,
    });
  }
  return rows;
}

export function primarySessionBookingFromCart(items = []) {
  const rows = sessionBookingsFromCartItems(items);
  if (!rows.length) return { session_booking_date: '', session_booking_time: '', session_bookings: [] };
  const first = rows[0];
  return {
    session_booking_date: first.booking_date || '',
    session_booking_time: first.booking_time || '',
    session_bookings: rows,
  };
}

export function cartItemBookingFields(item) {
  if (!item || item.type !== 'session') return {};
  const booking_date = String(item.selectedDate || '').trim().slice(0, 10);
  const booking_time = String(item.selectedTime || '').trim();
  if (!booking_date && !booking_time) return {};
  return { booking_date, booking_time };
}

/** Booking payload from SessionDetailPage ?date= & ?slot= query params. */
export function sessionBookingFromParams({ date, slot, sessionId, sessionTitle }) {
  const booking_date = String(date || '').trim().slice(0, 10);
  const booking_time = String(slot || '').trim();
  if (!booking_date && !booking_time) {
    return { session_booking_date: '', session_booking_time: '', session_bookings: [] };
  }
  return {
    session_booking_date: booking_date,
    session_booking_time: booking_time,
    session_bookings: [{
      session_id: String(sessionId || '').trim(),
      session_title: String(sessionTitle || '').trim(),
      booking_date,
      booking_time,
    }],
  };
}

export function mapCartItemForApi(item, { tierIndexFn } = {}) {
  const tier_index = tierIndexFn ? tierIndexFn(item) : (item.tierIndex ?? 0);
  return {
    program_id: item.programId,
    tier_index,
    participants_count: Math.max(1, item.participants?.length || 1),
    ...cartItemBookingFields(item),
  };
}
