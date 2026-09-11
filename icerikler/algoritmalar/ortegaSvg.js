// Ortega PBL diagram generator for 2x2. Do not edit.
// Renders a 2x2 face properly without center gaps, matching standard PBL layouts.
function ortegaSvg(pattern, mode, size) {
  var Y = "#f6c719", GRAY = "#4b515c";
  var C = { U: Y, F: "#179e4f", R: "#ff7a1a", B: "#2c6fe6", L: "#d12d28", D: "#eef2f3" };
  function color(ch) { return mode === "oll" ? (ch === "U" ? Y : GRAY) : (C[ch] || GRAY); }
  
  // 2x2 layout without center gap: 2 blocks per row/col
  var S = 28, G = 1, W = 6, o = W + G, T = o + 2 * S + G + W;
  var r = [];
  
  // 4 corners of the 2x2 face (Compact, touching each other like a real 2x2 face)
  for (var i = 0; i < 4; i++) {
    var x = o + (i % 2) * S;
    var y = o + Math.floor(i / 2) * S;
    r.push([x, y, S, S, 2, pattern[i]]);
  }
  
  // 4 surrounding side strips matching the 2x2 face edges
  r.push([o, o + 2 * S, 2 * S, W, 1, pattern[4]]); // Front strip
  r.push([o + 2 * S, o, W, 2 * S, 1, pattern[5] || pattern[4]]); // Right strip
  r.push([o, 0, 2 * S, W, 1, pattern[6] || pattern[4]]);        // Back strip
  r.push([0, o, W, 2 * S, 1, pattern[7] || pattern[5]]);        // Left strip

  return '<svg viewBox="0 0 ' + T + ' ' + T + '" width="' + size + '" height="' + size + '" aria-hidden="true">' +
    r.map(function (a) {
      return '<rect x="' + a[0] + '" y="' + a[1] + '" width="' + a[2] + '" height="' + a[3] +
        '" rx="' + a[4] + '" fill="' + color(a[5]) + '" stroke="#14171c" stroke-width="0.9"/>';
    }).join("") + "</svg>";
}
