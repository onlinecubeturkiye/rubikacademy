// Last-layer diagram for OLL / PLL cases. Do not edit.
// pattern = 21 letters from oll-pll.json:
//   0-8   top face, row by row
//   9-11  front strip   12-14 right strip
//   15-17 back strip    18-20 left strip
// mode "oll": yellow / gray only. mode "pll": full colors.
// Colors match a real cube held yellow top, green front (right = orange, left = red).
function llSvg(pattern, mode, size) {
  var Y = "#f6c719", GRAY = "#4b515c";
  var C = { U: Y, F: "#179e4f", R: "#ff7a1a", B: "#2c6fe6", L: "#d12d28", D: "#eef2f3" };
  function color(ch) { return mode === "oll" ? (ch === "U" ? Y : GRAY) : (C[ch] || GRAY); }
  var S = 24, G = 2, W = 8, o = W + G, T = o + 3 * (S + G) + W;
  var r = [];
  for (var i = 0; i < 9; i++) r.push([o + (i % 3) * (S + G), o + Math.floor(i / 3) * (S + G), S, S, 2, pattern[i]]);
  for (var j = 0; j < 3; j++) {
    var p = o + j * (S + G);
    r.push([p, o + 3 * (S + G), S, W, 1, pattern[9 + j]]);  // front
    r.push([o + 3 * (S + G), p, W, S, 1, pattern[12 + j]]); // right
    r.push([p, 0, S, W, 1, pattern[15 + j]]);               // back
    r.push([0, p, W, S, 1, pattern[18 + j]]);               // left
  }
  return '<svg viewBox="0 0 ' + T + ' ' + T + '" width="' + size + '" height="' + size + '" aria-hidden="true">' +
    r.map(function (a) {
      return '<rect x="' + a[0] + '" y="' + a[1] + '" width="' + a[2] + '" height="' + a[3] +
        '" rx="' + a[4] + '" fill="' + color(a[5]) + '" stroke="#14171c" stroke-width="0.9"/>';
    }).join("") + "</svg>";
}
