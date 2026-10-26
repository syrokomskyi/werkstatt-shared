/*
<MODULE_CONTRACT>
<purpose>Canonical dist/client HTML path ⇄ route path mapping shared by the site
check dist-diff scoping (werkstatt-site) and engine-side post-deploy sample
derivation. Pure string transforms — no IO.</purpose>
<non-goals>
  <item>Does not enumerate dist — callers supply dist-relative paths or routes.</item>
  <item>Does not hash or fingerprint — hashing lives in the dist-diff cache helpers.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1399: extracted from werkstatt-site/src/checks/mobile-layout-route-scope.ts — the engine's post-deploy fidelity-sample derivation needs the same canonical mapping; mobile-layout-route-scope re-exports to keep site import sites stable.</item>
  <item>RFC-1399: bound post-deploy dev mission.check to a 20-URL fidelity sample on matching same-artifact certify evidence</item>
</CHANGE_SUMMARY>
*/

/**
 * Map a dist/client-relative HTML file path to its route path.
 * Mirrors the derivation in mobile-layout-check discoverHtmlRoutes:
 * "/de/index.html" → "/de/", "/index.html" → "/", "/de/preis.html" → "/de/preis".
 */
export function routeFromHtmlPath(relativePath: string): string {
  if (relativePath === "/index.html") return "/";
  if (relativePath.endsWith("/index.html")) {
    return relativePath.slice(0, -"index.html".length);
  }
  if (relativePath.endsWith(".html")) return relativePath.slice(0, -".html".length);
  return relativePath;
}

/**
 * Inverse of routeFromHtmlPath — map a route back to its dist/client-relative
 * HTML file path: "/" → "/index.html", "/de/" → "/de/index.html",
 * "/de/preis" → "/de/preis.html" (RFC-1285 redirect-stub counting).
 */
export function htmlPathFromRoute(route: string): string {
  if (route === "/") return "/index.html";
  if (route.endsWith("/")) return `${route}index.html`;
  return `${route}.html`;
}
