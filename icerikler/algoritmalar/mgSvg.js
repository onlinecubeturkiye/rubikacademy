// Megaminx last-layer diagram (top view). Do not edit.
// pattern = 26 letters:
//   0      center
//   1-5    top edge stickers  (sides F, L, BL, BR, R)
//   6-10   top corner stickers (F/L, L/BL, BL/BR, BR/R, R/F)
//   11-25  side strips, 3 per side in the same side order:
//          [corner on the left, edge, corner on the right] (going clockwise around the top)
// letters: U F L l(=BL) r(=BR) R, X = gray (does not matter in this step)
// mode "oll": top color (U) highlighted, everything else gray. mode "pll": full colors.
// Colors match the 3D player (cubing.js megaminx: white top, green front).
function mgSvg(pattern, mode, size) {
  var C = { U: "#f4f4f4", F: "#14a83b", L: "#8a2be2", l: "#f4d40b", r: "#2457e6", R: "#e3262c" };
  var Y = "#f6c719", GRAY = "#4b515c";
  function col(ch) { if (mode === "oll") return ch === "U" ? Y : GRAY; return ch === "X" ? GRAY : (C[ch] || GRAY); }
  var R0 = 40, kq = 0.42, W = 8.5, cx = 50, cy = 52;
  function pt(r, deg) { var a = deg * Math.PI / 180; return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; }
  // corner j vertex angle (math, y up): 234 - 72j
  var V = [], Q = [];
  for (var j = 0; j < 5; j++) { V.push(pt(R0, 234 - 72 * j)); Q.push(pt(R0 * kq, 234 - 72 * j)); }
  function m(j) { return (j % 5 + 5) % 5; }
  function inter(p1, p2, p3, p4) {
    var d = (p1[0] - p2[0]) * (p3[1] - p4[1]) - (p1[1] - p2[1]) * (p3[0] - p4[0]);
    var a = p1[0] * p2[1] - p1[1] * p2[0], b = p3[0] * p4[1] - p3[1] * p4[0];
    return [(a * (p3[0] - p4[0]) - (p1[0] - p2[0]) * b) / d, (a * (p3[1] - p4[1]) - (p1[1] - p2[1]) * b) / d];
  }
  // edge k runs from V[k-1] to V[k]; line k passes through Q[k-1], Q[k]
  var P1 = [], P2 = [];
  for (var k = 0; k < 5; k++) {
    P1.push(inter(V[m(k - 1)], V[k], Q[m(k - 2)], Q[m(k - 1)])); // near V[k-1]
    P2.push(inter(V[m(k - 1)], V[k], Q[k], Q[m(k + 1)]));       // near V[k]
  }
  var polys = [];
  function add(pts, ch, sw) { polys.push('<polygon points="' + pts.map(function (p) { return p[0].toFixed(2) + "," + p[1].toFixed(2); }).join(" ") + '" fill="' + col(ch) + '" stroke="#14171c" stroke-width="' + (sw || 0.9) + '" stroke-linejoin="round"/>'); }
  add(Q, pattern[0]);
  for (k = 0; k < 5; k++) add([P1[k], P2[k], Q[k], Q[m(k - 1)]], pattern[1 + k]);
  for (j = 0; j < 5; j++) add([P2[j], V[j], P1[m(j + 1)], Q[j]], pattern[6 + j]);
  // side strips: outward along the edge normal
  for (k = 0; k < 5; k++) {
    var a = V[m(k - 1)], b = V[k], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy);
    var nx = dy / L, ny = -dx / L; // outward (polygon is clockwise on screen)
    if ((a[0] + b[0]) / 2 + nx - cx < (a[0] + b[0]) / 2 - cx && Math.abs(nx) > 0.01) { nx = -nx; ny = -ny; }
    var mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if ((mid[0] - cx) * nx + (mid[1] - cy) * ny < 0) { nx = -nx; ny = -ny; }
    var g = 1.6, sh = 0.9; // gap from face, shrink at ends
    function o(p, t) { return [p[0] + nx * (g + t * W) + (t ? 0 : 0), p[1] + ny * (g + t * W)]; }
    var ux = dx / L, uy = dy / L;
    var a2 = [a[0] + ux * sh, a[1] + uy * sh], b2 = [b[0] - ux * sh, b[1] - uy * sh];
    var segs = [[a2, P1[k]], [P1[k], P2[k]], [P2[k], b2]];
    for (var s = 0; s < 3; s++) {
      var p0 = segs[s][0], p1 = segs[s][1];
      add([o(p0, 0), o(p1, 0), o(p1, 1), o(p0, 1)], pattern[11 + 3 * k + s], 0.8);
    }
  }
  return '<svg viewBox="0 0 100 100" width="' + size + '" height="' + size + '" aria-hidden="true">' + polys.join("") + "</svg>";
}
