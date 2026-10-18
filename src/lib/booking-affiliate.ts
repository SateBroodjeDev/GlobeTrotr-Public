export type BookingAffiliateCategory = "stays" | "flights" | "cars";

// Supplied CJ referral links. Keep them unchanged: no personal sub-IDs or
// unverified deep-link parameters. The original offer URL remains in trip data.
export const BOOKING_AFFILIATE_LINKS: Record<BookingAffiliateCategory, string> = {
  stays: "https://www.jdoqocy.com/click-101889600-17323150?sid=",
  flights: "https://www.jdoqocy.com/click-101889600-17323151?sid=",
  cars: "https://www.jdoqocy.com/click-101889600-17323152?sid=",
};

// Stable partner fields supplied by the owner. Never copy a visitor's sid,
// click ID or cjevent into links for other visitors. This is a Booking partner
// destination, not proof of CJ conversion attribution.
export function bookingHotelPartnerUrl(destination: string): string {
  try {
    const url = new URL(destination);
    if (url.protocol !== "https:" || !/(^|\.)booking\.com$/i.test(url.hostname) || url.username || url.password || url.port) return destination;
    url.searchParams.delete("sid");
    url.searchParams.delete("cjevent");
    url.searchParams.delete("clkid");
    url.searchParams.set("aid", "818285");
    url.searchParams.set("label", "affnetcj-17323150_pub-8080872_site-101889600_pname-GlobeTrotr");
    url.searchParams.set("utm_source", "affnetcj");
    url.searchParams.set("utm_medium", "bannerindex");
    url.searchParams.set("utm_campaign", "nl");
    url.searchParams.set("utm_term", "index-17323150");
    return url.toString();
  } catch {
    return destination;
  }
}
