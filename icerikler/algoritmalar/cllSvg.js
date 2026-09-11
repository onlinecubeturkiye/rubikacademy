// CLL diagram generator for 2x2.
function cllSvg(pattern, mode, size) {
  var Y = "#f6c719", GRAY = "#4b515c";
  // NOTE: F and B were swapped in the original map — verified against reference
  // diagrams pixel-by-pixel: F is blue, B is green in this notation.
  var C = { U: Y, F: "#2c6fe6", B: "#179e4f", R: "#d12d28", L: "#ff7a1a", D: "#eef2f3" };
  function color(ch) { return mode === "oll" ? (ch === "U" ? Y : GRAY) : (C[ch] || GRAY); }
  var S = 28, W = 7, o = W, T = 2 * S + 2 * W;
  var r = [];

  // 1. 4 corners of the 2x2 face — TL, TR, BL, BR in raw index order (this part was
  // always correct; verified against reference).
  for (var i = 0; i < 4; i++) {
    var col = i % 2;
    var row = Math.floor(i / 2);
    r.push([o + col * S, o + row * S, S, S, 1.5, pattern[i]]);
  }

  // 2. 4 surrounding side strips — indices verified against 4 independent reference
  // diagrams (AS1, S1, S2, AS4), pixel-sampled directly.
  // Top strip uses pattern[8],[9]; Bottom strip uses pattern[4],[5];
  // Right strip uses pattern[6],[7] (unchanged); Left strip uses pattern[10],[11].
  r.push([o, 0, S, W, 1, pattern[8]]);        // Top-Left strip part
  r.push([o + S, 0, S, W, 1, pattern[9]]);    // Top-Right strip part

  r.push([o + 2 * S, o, W, S, 1, pattern[6]]);    // Right-Top strip part
  r.push([o + 2 * S, o + S, W, S, 1, pattern[7]]);// Right-Bottom strip part

  r.push([o + S, o + 2 * S, S, W, 1, pattern[5]]);// Bottom-Right strip part
  r.push([o, o + 2 * S, S, W, 1, pattern[4]]);    // Bottom-Left strip part

  r.push([0, o, W, S, 1, pattern[10]]);       // Left-Top strip part
  r.push([0, o + S, W, S, 1, pattern[11]]);   // Left-Bottom strip part

  return '<svg viewBox="0 0 ' + T + ' ' + T + '" width="' + size + '" height="' + size + '" aria-hidden="true">' +
    r.map(function (a) {
      return '<rect x="' + a[0] + '" y="' + a[1] + '" width="' + a[2] + '" height="' + a[3] + '" rx="' + a[4] + '" fill="' + color(a[5]) + '" stroke="#14171c" stroke-width="0.9"/>';
    }).join("") + "</svg>";
}
