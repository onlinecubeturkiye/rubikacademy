// Square-1 diagram: top layer and bottom layer, both seen from above. Do not edit.
// pattern = 24 slots x 3 letters (slots 0-11 = top layer, 12-23 = bottom layer):
//   [kind, face color, side color]   kind: e = edge, c = corner (first half), d = corner (second half)
//   face color: Y (top color) / W (bottom color) / X (gray) / K, E (shape only: corner, edge)   side color: R G O B / X
// Top slot k covers 15+30k .. 45+30k degrees clockwise from the front (seen from above);
// bottom slot j covers 15-30(j+1) .. 15-30j degrees. The slice runs front-back at +15 degrees.
function sq1Svg(pattern, size, opts) {
  opts = opts || {};
  var FACE = { Y: "#f6c719", W: "#f4f4f4", X: "#4b515c", K: "#d9dee7", E: "#7d8799" }; // K/E: köşe/kenar (sadece şekil)
  var SIDE = { R: "#e3262c", G: "#16a34a", O: "#ff7a1a", B: "#2c6fe6", X: "#4b515c" };
  var Rr = 30, W = 6.5, out = [];
  function dir(deg) { var a = deg * Math.PI / 180; return [-Math.sin(a), Math.cos(a)]; }
  function P(cx, cy, deg, r) { var d = dir(deg); return [cx + d[0] * r, cy + d[1] * r]; }
  function poly(pts, fill, sw) {
    out.push('<polygon points="' + pts.map(function (p) { return p[0].toFixed(2) + "," + p[1].toFixed(2); }).join(" ") + '" fill="' + fill + '" stroke="#14171c" stroke-width="' + (sw || 0.8) + '" stroke-linejoin="round"/>');
  }
  var rE = Rr / Math.cos(Math.PI / 12), rC = Rr * Math.SQRT2;
  function band(a, b, cx, cy, color) {
    // outer sticker along segment a-b, pushed outward from the center
    var mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy, L = Math.sqrt(mx * mx + my * my), nx = mx / L, ny = my / L;
    var g = 1.2, sh = 0.08;
    var a2 = [a[0] + (b[0] - a[0]) * sh, a[1] + (b[1] - a[1]) * sh], b2 = [b[0] + (a[0] - b[0]) * sh, b[1] + (a[1] - b[1]) * sh];
    poly([[a2[0] + nx * g, a2[1] + ny * g], [b2[0] + nx * g, b2[1] + ny * g], [b2[0] + nx * (g + W), b2[1] + ny * (g + W)], [a2[0] + nx * (g + W), a2[1] + ny * (g + W)]], SIDE[color] || SIDE.X, 0.7);
  }
  function layer(off, cx, cy, bottom) {
    for (var s = 0; s < 12; s++) {
      var k = pattern[(off + s) * 3], fc = pattern[(off + s) * 3 + 1], sc = pattern[(off + s) * 3 + 2];
      if (k === "d") continue; // drawn with its first half
      var a0, span = k === "c" ? 60 : 30;
      // angular start of this slot (clockwise from front)
      if (!bottom) a0 = 15 + 30 * s; else a0 = 15 - 30 * (s + 1) - (k === "c" ? 30 : 0);
      var p1 = P(cx, cy, a0, rE), p2 = P(cx, cy, a0 + span, rE);
      if (k === "e") {
        poly([[cx, cy], p1, p2], FACE[fc] || FACE.X);
        band(p1, p2, cx, cy, sc);
      } else {
        var ap = P(cx, cy, a0 + 30, rC);
        poly([[cx, cy], p1, ap, p2], FACE[fc] || FACE.X);
        var sc2 = pattern[(off + ((s + 1) % 12)) * 3 + 2];
        // top: first half spans a0..a0+30; bottom (angles decrease with slot index): first half is the later angle range
        if (!bottom) { band(p1, ap, cx, cy, sc); band(ap, p2, cx, cy, sc2); }
        else { band(ap, p2, cx, cy, sc); band(p1, ap, cx, cy, sc2); }
      }
    }
  }
  // corner second halves that wrap around (slot 0 = "d") are drawn from slot 11
  var gap = 92, h = 92;
  layer(0, 46, 46, false);
  layer(12, 46 + gap, 46, true);
  // slice line (front-back, 15 degrees)
  [[46, false], [46 + gap, true]].forEach(function (c) {
    var p = P(c[0], 46, 15, rC + 4), q = P(c[0], 46, 195, rC + 4);
    out.push('<line x1="' + p[0].toFixed(2) + '" y1="' + p[1].toFixed(2) + '" x2="' + q[0].toFixed(2) + '" y2="' + q[1].toFixed(2) + '" stroke="#e11d48" stroke-width="1.1" stroke-dasharray="2.5 2" opacity="0.85"/>');
  });
  var w = size * 2, hh = size;
  return '<svg viewBox="0 0 ' + (gap + h) + " " + h + '" width="' + w + '" height="' + hh + '" aria-hidden="true">' + out.join("") + "</svg>";
}
