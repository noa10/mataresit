/**
 * Brand asset paths, in one place.
 *
 * The v4 mark replaced a bitmap that was referenced from six places, and every
 * one of them had to be found by hand when the asset was retired. These are
 * the paths that survive a rename: keep them here and import them, rather
 * than writing the literal again.
 *
 * The paths are root-relative because they are served from `public/`. Callers
 * that hand the path to an external scraper (Open Graph, Twitter cards,
 * schema.org) have to make it absolute first — those resolve the URL against
 * their own origin, not the page's.
 */

/**
 * The social card for link previews: 1200x630, the 1.91:1 shape Facebook,
 * Twitter and LinkedIn render a card at. A square tile is cropped to about
 * half its height there, which cuts the tear off the top of the mark and the
 * flat base off the bottom.
 */
export const BRAND_SOCIAL_CARD = '/mataresit-social-1200x630.png';
export const BRAND_SOCIAL_CARD_WIDTH = 1200;
export const BRAND_SOCIAL_CARD_HEIGHT = 630;

/**
 * The mark on a transparent ground, for schema.org `logo`. A logo is rendered
 * as a mark, not as a plate, so this slot takes the transparent asset rather
 * than the social card.
 */
export const BRAND_LOGO = '/mataresit-512.png';

/**
 * The notification icon and badge. The icon is the mark on a transparent
 * ground, not the opaque tile: Android renders a notification icon as a white
 * silhouette taken from its alpha channel, so a plate would come back as a
 * solid white square. The badge is monochrome white for the same reason.
 *
 * `public/sw-push.js` and the Deno edge functions carry their own copies —
 * neither runs in the app's module graph.
 */
export const BRAND_NOTIFICATION_ICON = '/mataresit-192.png';
export const BRAND_NOTIFICATION_BADGE = '/mataresit-badge.png';
