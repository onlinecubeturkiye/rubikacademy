// Square-1 diagram: top layer above, bottom layer below. The / slice is drawn as a vertical red line.
// pattern = 24 slots x 3 letters (slots 0-11 = top layer, 12-23 = bottom layer):
//   [kind, face color, side color]   kind: e = edge, c = corner (first half), d = corner (second half)
//   face color: Y (top color) / W (bottom color) / X (gray) / K, E (shape only: corner, edge)   side color: R G O B / X
// Top slot k covers 15+30k .. 45+30k degrees clockwise from the front (seen from above);
// bottom slot j covers 15-30(j+1) .. 15-30j. The slice runs front-back at +15 degrees.
// Top layer seen from above (front at the bottom); bottom layer seen from below as if the puzzle were tipped forward (front at the top).
// opts.topOnly: only the top layer (square thumbnail). opts.horizontal: layers side by side.
function sq1Svg(pattern, size, opts) {
  opts = opts || {};
  var FACE = { Y: "#f8c81c", W: "#ffffff", X: "#c3c8d1", K: "#e4e8ef", E: "#9aa3b2" };
  var SIDE = { R: "#e5262d", G: "#1fa34a", O: "#ff8a1f", B: "#2563eb", X: "#8d95a3" };
  var LINE = "#1b1d23", R = 36, BAND = 5.2, out = [];
  var rE = R / Math.cos(Math.PI / 12), rC = R * Math.SQRT2;
  function f(n) { return n.toFixed(2); }
  function pts(a) { return a.map(function (p) { return f(p[0]) + "," + f(p[1]); }).join(" "); }
  function poly(a, fill, sw) { out.push('<polygon points="' + pts(a) + '" fill="' + fill + '" stroke="' + LINE + '" stroke-width="' + (sw || 0.9) + '" stroke-linejoin="round"/>'); }
  function layer(off, cx, cy, bottom) {
    // ekranda: kesik dikey (açı - 15); üst katman üstten (ön aşağıda), alt katman küp öne devrilmiş gibi alttan (ön yukarıda)
    function P(deg, r) { var a = (deg - 15) * Math.PI / 180, s = bottom ? -1 : 1; return [cx - Math.sin(a) * r, cy + s * Math.cos(a) * r]; }
    function inner(p) { var k = (R - BAND) / R; return [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]; }
    for (var s = 0; s < 12; s++) {
      var k = pattern[(off + s) * 3], fc = pattern[(off + s) * 3 + 1], sc = pattern[(off + s) * 3 + 2];
      if (k === "d") continue; // köşe ilk yarısıyla birlikte çizilir
      var a0 = !bottom ? 15 + 30 * s : 15 - 30 * (s + 1) - (k === "c" ? 30 : 0), span = k === "c" ? 60 : 30;
      var p1 = P(a0, rE), p2 = P(a0 + span, rE), face = FACE[fc] || FACE.X;
      if (k === "e") {
        poly([[cx, cy], p1, p2], face);
        poly([p1, p2, inner(p2), inner(p1)], SIDE[sc] || SIDE.X, 0.7);
      } else {
        var tip = P(a0 + 30, rC), sc2 = pattern[(off + ((s + 1) % 12)) * 3 + 2];
        poly([[cx, cy], p1, tip, p2], face);
        // üstte ilk yarı a0..a0+30; altta (açı slot ile azalır) ilk yarı sonraki açı aralığı
        var c1 = !bottom ? sc : sc2, c2 = !bottom ? sc2 : sc;
        poly([p1, tip, inner(tip), inner(p1)], SIDE[c1] || SIDE.X, 0.7);
        poly([tip, p2, inner(p2), inner(tip)], SIDE[c2] || SIDE.X, 0.7);
      }
    }
    // / kesiği: dikey düz kırmızı çizgi
    out.push('<line x1="' + f(cx) + '" y1="' + f(cy - rC - 3) + '" x2="' + f(cx) + '" y2="' + f(cy + rC + 3) + '" stroke="#e11d2a" stroke-width="2.2" stroke-linecap="round"/>');
  }
  var B = 50, cell = 100;
  if (opts.topOnly) {
    layer(0, B, B, false);
    return '<svg viewBox="0 0 100 100" width="' + size + '" height="' + size + '" aria-hidden="true">' + out.join("") + "</svg>";
  }
  if (opts.horizontal) {
    layer(0, B, B, false); layer(12, B + cell, B, true);
    return '<svg viewBox="0 0 200 100" width="' + size * 2 + '" height="' + size + '" aria-hidden="true">' + out.join("") + "</svg>";
  }
  layer(0, B, B, false); layer(12, B, B + cell, true);
  return '<svg viewBox="0 0 100 200" width="' + size + '" height="' + size * 2 + '" aria-hidden="true">' + out.join("") + "</svg>";
}
