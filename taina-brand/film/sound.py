"""Звук для ролика TAINA (30 с, 48 кГц, стерео) — синтез, без внешних сэмплов.

0–15   бумага, клавиатура, уведомления, далёкие голоса — нарастают
15.0   обрыв в тишину
15.6   одна низкая нота
18–30  тёплая минималистичная тема: пэд + «фортепианные» ноты, в конце шорох бумаги

Запуск: python3 sound.py out.wav
"""
import sys
import wave
import numpy as np

SR = 48000
DUR = 30.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
L = np.zeros(N)
R = np.zeros(N)


def band(x, lo, hi):
    f = np.fft.rfft(x)
    fr = np.fft.rfftfreq(len(x), 1 / SR)
    f[(fr < lo) | (fr > hi)] = 0
    return np.fft.irfft(f, len(x))


def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    L[i:i + len(sig)] += sig * np.sqrt((1 - pan) / 2)
    R[i:i + len(sig)] += sig * np.sqrt((1 + pan) / 2)


def env(n, attack, release):
    e = np.ones(n)
    a, r = int(attack * SR), int(release * SR)
    if a:
        e[:a] = np.linspace(0, 1, a)
    if r:
        e[-r:] *= np.linspace(1, 0, r)
    return e


def rustle(dur):
    n = int(dur * SR)
    x = band(rng.standard_normal(n), 1200, 9000)
    crackle = np.repeat(rng.random(n // 240 + 1) ** 3, 240)[:n]
    return x * (0.3 + crackle) * env(n, 0.03, dur * 0.6)


def click():
    n = int(0.018 * SR)
    return band(rng.standard_normal(n), 2500, 12000) * np.exp(-np.arange(n) / (0.003 * SR))


def ping(f):
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 14) + 0.6 * np.sin(2 * np.pi * f * 1.5 * t) * np.exp(-np.maximum(t - 0.07, 0) * 14) * (t > 0.07)
    return s * env(n, 0.003, 0.05)


def murmur(dur):
    n = int(dur * SR)
    x = band(rng.standard_normal(n), 180, 900)
    syl = np.interp(np.arange(n), np.linspace(0, n, int(dur * 5) + 2), rng.random(int(dur * 5) + 2) ** 2)
    return x * syl * env(n, 0.2, 0.3)


def note(f, dur, decay=2.5, harm=(1, .5, .25, .12)):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = sum(a * np.sin(2 * np.pi * f * (k + 1) * t) * np.exp(-t * decay * (1 + k * .6)) for k, a in enumerate(harm))
    return s * env(n, 0.004, 0.2)


def pad(freqs, dur, attack=1.6, release=1.8):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for f in freqs:
        for d in (-0.12, 0.0, 0.13):
            ff = f * 2 ** (d / 12)
            s += np.sin(2 * np.pi * ff * t) + 0.3 * np.sin(2 * np.pi * 2 * ff * t) + 0.1 * np.sin(2 * np.pi * 3 * ff * t)
    return s / (len(freqs) * 3) * env(n, attack, release)


hz = lambda m: 440 * 2 ** ((m - 69) / 12)  # MIDI → Гц

# 0–3: одиночный шорох и тихое мерцание точки
add(rustle(0.5), 0.15, 0.35, -0.2)
shim = np.sin(2 * np.pi * 2093 * np.arange(int(2.6 * SR)) / SR) * env(int(2.6 * SR), 0.6, 1.8)
add(shim, 0.35, 0.025)

# 3–15: нарастание
t = 3.0
while t < 15:
    rate = 0.6 + 9 * ((t - 3) / 12) ** 2           # шорохов в секунду
    add(rustle(0.2 + rng.random() * 0.45), t, 0.18 + 0.2 * (t - 3) / 12, rng.uniform(-.8, .8))
    t += rng.exponential(1 / rate)
t = 6.0
while t < 15:
    rate = 1 + 16 * ((t - 6) / 9) ** 2
    add(click(), t, 0.25, rng.uniform(-.6, .6))
    t += rng.exponential(1 / rate)
for t in (8.6, 9.8, 10.9, 11.7, 12.4, 13.0, 13.5, 13.9, 14.2, 14.5, 14.7, 14.85):
    add(ping(rng.choice([1047, 1175, 1319, 1568])), t, 0.07, rng.uniform(-.7, .7))
t = 9.5
while t < 15:
    add(murmur(1.2 + rng.random()), t, 0.16 + 0.12 * (t - 9.5) / 5.5, rng.uniform(-.9, .9))
    t += 0.9 - 0.5 * (t - 9.5) / 5.5
# подъём к обрыву
n = int(4 * SR)
tt = np.arange(n) / SR
riser = band(rng.standard_normal(n), 300, 5000) * (tt / 4) ** 2 * 0.25 + np.sin(2 * np.pi * (80 * tt + 30 * tt ** 2)) * (tt / 4) ** 2 * 0.05
add(riser, 11.0, 1.0)

# 15.0: обрыв
cut = int(15.0 * SR)
fade = int(0.012 * SR)
for ch in (L, R):
    ch[cut - fade:cut] *= np.linspace(1, 0, fade)
    ch[cut:] = 0

# 15.6: одна низкая нота
n = int(4.5 * SR)
tt = np.arange(n) / SR
low = (np.sin(2 * np.pi * 55 * tt) + 0.5 * np.sin(2 * np.pi * 110 * tt) + 0.15 * np.sin(2 * np.pi * 165 * tt)) * np.exp(-tt * 0.9) * env(n, 0.06, 0.8)
add(low, 15.6, 0.32)

# 18–30: тёплая тема
add(pad([hz(45), hz(52), hz(57), hz(60)], 4.2), 18.0, 0.26)          # Am
add(pad([hz(41), hz(48), hz(57), hz(60)], 4.0, 1.2), 21.4, 0.26)     # F
add(pad([hz(48), hz(55), hz(60), hz(64)], 5.4, 1.2, 2.6), 24.6, 0.28)  # C — разрешение
for t, m, g in ((18.2, 69, .16), (21.5, 76, .13), (21.52, 81, .09), (23.7, 72, .15),
                (26.4, 76, .13), (27.2, 79, .13), (28.3, 72, .15), (28.32, 84, .07)):
    add(note(hz(m), 3.5), t, g, rng.uniform(-.3, .3))
add(rustle(0.6), 29.0, 0.12, 0.3)

# сведение
mix = np.stack([L, R], axis=1)
mix = np.tanh(mix * 1.4) / np.tanh(1.4)
mix *= 0.89 / np.max(np.abs(mix))
fo = int(0.5 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
pcm = (mix * 32767).astype('<i2')
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'sound.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
