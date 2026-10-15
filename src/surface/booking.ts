/*
<MODULE_CONTRACT>
<purpose>RFC-1289: booking mode vocabulary for surface bookingRequirements —
closed enum so a mode is a stable key, never a display label. Localized labels
live in the site label tables (bake-helpers SurfaceLabels.bookingModes).</purpose>
<non-goals>
  <item>Do not carry UI copy — labels are localized per site language in
  werkstatt-site's surface-expand label tables.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1289: initial — bookingRequirements[].mode was an unvalidated free
  string; enum keys rendered raw as card titles (DIST-LEAK-09 class).</item>
  <item>RFC-1289</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

/** RFC-1289: closed vocabulary for bookingRequirements[].mode. */
export const bookingModeSchema = z.enum([
  "consultationFirst",
  "directBooking",
  "phoneBooking",
  "bookingRequest",
]);

export type BookingMode = z.infer<typeof bookingModeSchema>;
