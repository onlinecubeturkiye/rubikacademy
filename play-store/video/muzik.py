# Videonun müziğini sıfırdan sentezler (özgün, telifsiz): 120 BPM, C–G–Am–F, enerjik elektronik pop.
# Kullanım: python3 muzik.py <süre_sn> <çıktı.wav>
import sys, wave, numpy as np
SR = 44100; BPM = 120; BEAT = 60 / BPM; BAR = 4 * BEAT
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 36.0
OUT = sys.argv[2] if len(sys.argv) > 2 else "muzik.wav"
N = int(DUR * SR) + SR
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)
def hz(m): return 440 * 2 ** ((m - 69) / 12)
def add(buf, t, sig, gain=1.0, pan=0.0):
    i = int(t * SR); j = min(N, i + len(sig))
    if i >= N: return
    L[i:j] += sig[: j - i] * gain * (1 - max(0, pan)); R[i:j] += sig[: j - i] * gain * (1 + min(0, pan))
def saw(f, d, harm=12, det=0.0):
    t = np.arange(int(d * SR)) / SR; s = np.zeros_like(t)
    for k in range(1, harm + 1):
        if f * k > 15000: break
        s += np.sin(2 * np.pi * f * k * t * (1 + det)) / k
    return s * 0.6
def env(n, a=0.005, dec=0.3, sus=0.0, rel=0.05):
    t = np.arange(n) / SR; e = np.minimum(1, t / max(a, 1e-4)) * (sus + (1 - sus) * np.exp(-t / dec))
    r = int(rel * SR)
    if r and n > r: e[-r:] *= np.linspace(1, 0, r)
    return e
def kick(): 
    d = 0.42; t = np.arange(int(d * SR)) / SR
    f = 48 + 110 * np.exp(-t * 28); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7.5) + 0.25 * np.sin(ph * 2) * np.exp(-t * 30)
def noise(d, dec, hp=1):
    n = rng.standard_normal(int(d * SR))
    for _ in range(hp): n = np.diff(n, prepend=0)
    return n / (2 ** hp) * np.exp(-np.arange(len(n)) / SR / dec)
def clap():
    s = noise(0.25, 0.07, 1)
    s[: int(0.012 * SR)] *= 1.6
    return s
# Akorlar (C, G, Am, F) — kök MIDI ve üçlüler
CH = [(48, [60, 64, 67, 72]), (43, [59, 62, 67, 71]), (45, [57, 60, 64, 69]), (41, [57, 60, 65, 69])]
nbars = int(np.ceil(DUR / BAR))
end_t = DUR - 2.2  # son akor
for b in range(nbars):
    t0 = b * BAR
    if t0 >= end_t: break
    root, notes = CH[b % 4]
    # Pad (yumuşak, iki yana açık)
    for k, m in enumerate(notes):
        p = saw(hz(m), BAR, 6, 0.003) * env(int(BAR * SR), 0.08, 9, 0.6, 0.2)
        add(L, t0, p, 0.035, -0.5 if k % 2 else 0.5)
    for q in range(4):
        tb = t0 + q * BEAT
        if tb >= end_t: break
        add(L, tb, kick(), 0.85)
        add(L, tb + BEAT / 2, noise(0.12, 0.05, 2), 0.16, 0.25)       # açık hi-hat (offbeat)
        add(L, tb, noise(0.04, 0.012, 2), 0.07, -0.25)                 # kapalı hi-hat
        add(L, tb + BEAT / 4 * 3, noise(0.04, 0.012, 2), 0.05, -0.25)
        if q % 2 == 1: add(L, tb, clap(), 0.32)
        # Bas: offbeat sekizlikler
        bs = saw(hz(root - 12), BEAT / 2 * 0.9, 14) * env(int(BEAT / 2 * 0.9 * SR), 0.004, 0.18, 0.3, 0.03)
        add(L, tb + BEAT / 2, bs, 0.3)
        # Arpej (on altılıklar), yükselen-alçalan
        seq = [0, 1, 2, 3, 2, 1, 2, 3]
        for s16 in range(4):
            ts = tb + s16 * BEAT / 4
            m = notes[seq[(q * 4 + s16) % 8]] + 12
            pl = saw(hz(m), 0.2, 7) * env(int(0.2 * SR), 0.002, 0.07, 0, 0.02)
            add(L, ts, pl, 0.075, 0.35 if s16 % 2 else -0.35)
# Her 2 barda bir crash benzeri parlama + sahne geçişlerine "whoosh"
for b in range(0, nbars, 2):
    if b * BAR < end_t: add(L, b * BAR, noise(1.6, 0.5, 1), 0.08)
for tt in [float(x) for x in (sys.argv[3].split(",") if len(sys.argv) > 3 else [])]:
    d = 0.5; n = noise(d, 10, 1); n *= np.sin(np.linspace(0, np.pi, len(n))) ** 2
    add(L, tt - d * 0.7, n, 0.12)
# Kapanış: C akoru tınlar
for k, m in enumerate([48, 60, 64, 67, 72]):
    add(L, end_t, saw(hz(m), 2.6, 8, 0.002) * env(int(2.6 * SR), 0.01, 1.2, 0, 0.4), 0.08, (-0.4, 0.4)[k % 2])
add(L, end_t, kick(), 0.9); add(L, end_t, noise(2.2, 0.7, 1), 0.1)
# Basit sidechain hissi: kick anlarında pad/arp kısılır
st = np.ones(N); t = np.arange(int(BEAT * SR)) / SR; duck = 1 - 0.45 * np.exp(-t * 9)
for b in range(int(end_t / BEAT)): i = int(b * BEAT * SR); st[i:i + len(duck)] = np.minimum(st[i:i + len(duck)], duck)
L *= st; R *= st
mix = np.stack([L, R], 1)[: int(DUR * SR)]
fade = int(0.6 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix = np.tanh(mix / np.max(np.abs(mix)) * 1.4) * 0.89  # yumuşak limit
with wave.open(OUT, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print("ok", OUT)
