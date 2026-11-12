// Which existing artist a new submission belongs to (owner, 2026-11-12): the same email AND the same name.
// One email may send works for several artists (an organiser or a friend sending on their behalf); a
// different name is a different artist. Names are compared without case, extra spaces or zero-width marks.
export const normName = (s) => String(s || '').normalize('NFC').replace(/[​-‍﻿]/g, '')
  .replace(/\s+/g, ' ').trim().toLowerCase();

// candidates: artists of this exhibition with the submitted email -> the matching one, or null
export function matchArtist(candidates, name) {
  const n = normName(name);
  return (candidates || []).find((a) => normName(a.name_th) === n) || null;
}
