// Narration alignment: TM.cue('s03', '2007年') = the moment the characters "2007年" start being spoken (seconds, local to the segment, lt).
// TM.end('s03', '2007年') = the moment those characters finish. TM.dur('s03') = segment length; TM.vo('s03') = [narration start, narration end] (local seconds).
// The key must be a substring of that segment's subtitle text exactly as written (first occurrence); a wrong key logs console.error and fails the render.
window.TM = (() => {
  const seg = id => { const s = TIMING.seg[id]; if (!s) throw new Error('TIMING has no segment ' + id); return s; };
  function find(id, key, which) {
    const s = seg(id), i = s.text.indexOf(key);
    if (i < 0) { console.error(`TM: segment ${id}'s subtitle text has no "${key}"`); return 0; }
    const j = which === 'end' ? i + key.length - 1 : i;
    return which === 'end' ? s.charEnd[j] : s.charStart[j];
  }
  return {
    cue: (id, key) => find(id, key, 'start'),
    end: (id, key) => find(id, key, 'end'),
    dur: id => seg(id).dur,
    vo: id => [seg(id).voStart, seg(id).voEnd],
    text: id => seg(id).text,
  };
})();
