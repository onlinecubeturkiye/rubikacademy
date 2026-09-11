// Ortega PBL diagram generator for 2x2. 
// Renders 2 separate color blocks for each side strip to match true 2x2 side stickers.
function ortegaSvg(pattern, mode, size) {
  var Y = "#f6c719", GRAY = "#4b515c";
  var C = { U: Y, F: "#179e4f", R: "#ff7a1a", B: "#2c6fe6", L: "#d12d28", D: "#eef2f3" };
  function color(ch) { return mode === "oll" ? (ch === "U" ? Y : GRAY) : (C[ch] || GRAY); }
  
  var S = 24, G = 2, W = 8, o = W + G, T = o + 2 * (S + G) + W;
  var halfS = S / 2;
  var r = [];
  
  // 1. 4 corners of the 2x2 face
  for (var i = 0; i < 4; i++) {
    var col = i % 2;
    var row = Math.floor(i / 2);
    r.push([o + col * (S + G), o + row * (S + G), S, S, 2, pattern[i]]);
  }
  
  // 2. Surrounding side strips split into 2 blocks each (total 8 side elements)
  // Pattern mapping for sides: indexes 4,5,6,7 are split into halves (e.g., 4-> [4a, 4b])
  // Front strip (bottom)
  r.push([o, o + 2 * (S + G), halfS, W, 1, pattern[4]]);
  r.push([o + halfS + G, o + 2 * (S + G), halfS, W, 1, pattern[4.5] || pattern[4]]);
  
  // Right strip
  r.push([o + 3 * (S + G) - G, o, W, halfS, 1, pattern[5]]);
  r.push([o + 3 * (S + G) - G, o + halfS + G, W, halfS, 1, pattern[5.5] || pattern[5]]);
  
  // Back strip (top)
  r.push([o, 0, halfS, W, 1, pattern[6]]);
  r.push([o + halfS + G, 0, halfS, W, 1, pattern[6.5] || pattern[6]]);
  
  // Left strip
  r.push([0, o, W, halfS, 1, pattern[7]]);
  r.push([0, o + halfS + G, W, halfS, 1, pattern[7.5] || pattern[7]]);

  return '<svg viewBox="0 0 ' + T + ' ' + T + '" width="' + size + '" height="' + size + '" aria-hidden="true">' +
    r.map(function (a) {
      return '<rect x="' + a[0] + '" y="' + a[1] + '" width="' + a[2] + '" height="' + a[3] +
        '" rx="' + a[4] + '" fill="' + color(a[5]) + '" stroke="#14171c" stroke-width="0.9"/>';
    }).join("") + "</svg>";
}
