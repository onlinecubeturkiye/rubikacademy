// CLL diagram generator for 2x2.
function cllSvg(pattern, mode, size) {
var Y = "#f6c719", GRAY = "#4b515c";
var C = { U: Y, F: "#179e4f", R: "#ff7a1a", B: "#2c6fe6", L: "#d12d28", D: "#eef2f3" };
function color(ch) { return mode === "oll" ? (ch === "U" ? Y : GRAY) : (C[ch] || GRAY); }
var S = 28, W = 7, o = W, T = 2 * S + 2 * W;
var r = [];

// 1. 4 corners of the 2x2 face
for (var i = 0; i < 4; i++) {
var col = i % 2;
var row = Math.floor(i / 2);
r.push([o + col * S, o + row * S, S, S, 1.5, pattern[i]]);
}

// 2. 4 surrounding side strips (Top, Right, Bottom, Left)
r.push([o, 0, S, W, 1, pattern[4]]);        // Top strip
r.push([o + 2 * S, o, W, S, 1, pattern[5]]);  // Right strip
r.push([o, o + 2 * S, S, W, 1, pattern[6]]);  // Bottom strip
r.push([0, o, W, S, 1, pattern[7]]);        // Left strip

return '<svg viewBox="0 0 ' + T + ' ' + T + '" width="' + size + '" height="' + size + '" aria-hidden="true">' +
r.map(function (a) {
return '<rect x="' + a[0] + '" y="' + a[1] + '" width="' + a[2] + '" height="' + a[3] + '" rx="' + a[4] + '" fill="' + color(a[5]) + '" stroke="#14171c" stroke-width="0.9"/>';
}).join("") + "</svg>";
}
