"""Звук для «Он видит больше» (30 с, 48 кГц, стерео) — синтез, без внешних сэмплов.

0–5.8    низкий гул, два тихих колокольчика (глаза), свист-«нырок» в зрачок
5.8–13   шорох бумаги нарастает, пульс; щелчок на каждое слово
13–18.3  шорох уходит, поднимается мерцающий тон; вспышка ромба — колокол и удар
18.3–23.6 тёплая тема: пэд + ноты на текст
23.6–26.9 мягкий колокольчик (Бегемот)
26.9–30  финальный аккорд и низкий удар на логотипе

Запуск: python3 sound.py out.wav
"""
import sys
import wave
import numpy as np

SR = 48000
DUR = 30.0
N = int(SR * DUR)
rng = np.random.default_rng(11)
L = np.zeros(N)
R = np.zeros(N)
hz = lambda m: 440 * 2 ** ((m - 69) / 12)  # MIDI → Гц


def band(x, lo, hi):
    f = np.fft.rfft(x)
    fr = np.fft.rfftfreq(len(x), 1 / SR)
    f[(fr < lo) | (fr > hi)] = 0
    return np.fft.irfft(f, len(x))


def env(n, attack, release):
    e = np.ones(n)
    a, r = int(attack * SR), int(release * SR)
    if a:
        e[:a] = np.linspace(0, 1, a)
    if r:
        e[-r:] *= np.linspace(1, 0, r)
    return e


def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    L[i:i + len(sig)] += sig * np.sqrt((1 - pan) / 2)
    R[i:i + len(sig)] += sig * np.sqrt((1 + pan) / 2)


def tone(freqs, dur, decay=1.0, attack=0.005, release=0.3, detune=0.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for f, a in freqs:
        s += a * np.sin(2 * np.pi * f * (1 + detune) * t)
        if detune:
            s += a * np.sin(2 * np.pi * f * (1 - detune) * t)
    return s * np.exp(-t * decay) * env(n, attack, release)


def bell_tone(f, dur=3.0, decay=1.4):  # колокольчик: негармонические обертоны
    return tone([(f, 1), (f * 2.76, .45), (f * 5.4, .2), (f * 8.9, .08)], dur, decay)


def rustle(dur):
    n = int(dur * SR)
    x = band(rng.standard_normal(n), 1200, 9000)
    crackle = np.repeat(rng.random(n // 240 + 1) ** 3, 240)[:n]
    return x * (0.3 + crackle) * env(n, 0.03, dur * 0.6)


def whoosh(dur, lo=200, hi=6000, rise=True):
    n = int(dur * SR)
    parts = []
    steps = 24
    for k in range(steps):  # скользящая полоса
        q = k / (steps - 1) if rise else 1 - k / (steps - 1)
        c = lo * (hi / lo) ** q
        parts.append(band(rng.standard_normal(n // steps), c * .6, c * 1.6))
    x = np.concatenate(parts)[:n]
    x = np.pad(x, (0, n - len(x)))
    shape = np.sin(np.linspace(0, np.pi, n)) ** 2
    return x * shape


def pad(midis, dur, attack=1.5, release=2.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for m in midis:
        f = hz(m)
        for d in (-0.1, 0.0, 0.11):
            ff = f * 2 ** (d / 12)
            s += np.sin(2 * np.pi * ff * t) + .3 * np.sin(2 * np.pi * 2 * ff * t) + .08 * np.sin(2 * np.pi * 3 * ff * t)
    lfo = 1 + .06 * np.sin(2 * np.pi * .25 * t)
    return s / (len(midis) * 3) * env(n, attack, release) * lfo


def boom(dur=3.5, f0=48):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f0 * (1 + 1.5 * np.exp(-t * 18))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) + .3 * np.sin(2 * ph)) * np.exp(-t * 1.3) * env(n, .003, .6)


# 0–5.8: Взгляд
n = int(6.0 * SR)
tt = np.arange(n) / SR
drone = (np.sin(2 * np.pi * 55 * tt) + .6 * np.sin(2 * np.pi * 82.4 * tt) + .25 * np.sin(2 * np.pi * 110.3 * tt)) * env(n, 1.5, .8)
add(drone, 0.0, .16)
add(bell_tone(hz(88)), 0.55, .05, -.4)
add(bell_tone(hz(91)), 0.75, .045, .4)
add(whoosh(1.1, 300, 7000, True), 4.75, .22)

# 5.8–13: Поиск
t = 6.0
while t < 13.3:
    rate = 1.2 + 7 * ((t - 6) / 7) ** 2
    add(rustle(.25 + rng.random() * .5), t, .16 + .14 * (t - 6) / 7, rng.uniform(-.8, .8))
    t += rng.exponential(1 / rate)
t = 6.2
while t < 13:  # пульс ускоряется
    add(tone([(52, 1), (104, .3)], .5, 9, .004, .1), t, .38)
    t += 0.95 - 0.5 * (t - 6.2) / 6.8
for i in range(6):  # щелчок + бумажный хлопок на каждое слово
    s0 = 9.0 + i * .62
    add(band(rng.standard_normal(int(.06 * SR)), 1500, 9000) * np.exp(-np.arange(int(.06 * SR)) / (.012 * SR)), s0, .45, rng.uniform(-.5, .5))
    add(tone([(hz(45 + (i % 3) * 2), 1)], .4, 7), s0, .12)
add(pad([69, 76], 1.8, .6, .8), 6.8, .05)  # «Ответ где-то здесь»

# 13–18.3: Свет
n = int(5.2 * SR)
tt = np.arange(n) / SR
f = 400 + 500 * (tt / 5.2) ** 2
riser = np.sin(2 * np.pi * np.cumsum(f) / SR) * (tt / 5.2) ** 2 * .5 + band(rng.standard_normal(n), 2000, 12000) * (tt / 5.2) ** 3 * .6
add(riser * env(n, .5, .05), 13.1, .2)
add(pad([76, 81, 88], 3.2, 1.2, 1.0), 14.5, .08)
add(bell_tone(hz(84), 4, .8), 16.2, .12)          # ромб загорается
add(bell_tone(hz(91), 4, .9), 16.22, .07, .3)
add(boom(3.0, 44), 16.2, .45)
add(whoosh(1.2, 500, 9000, True), 17.1, .18)
add(boom(4.0, 40), 18.3, .6)                       # вспышка-переход

# 18.3–23.6: Порядок
add(pad([45, 52, 57, 60, 64], 3.0), 18.3, .42)    # Am
add(pad([41, 48, 57, 60, 65], 3.2, 1.0), 20.7, .42)  # F
add(pad([43, 50, 55, 59, 62], 2.4, .9, 1.4), 22.9, .36)  # G
for t, m, gg in ((18.5, 81, .14), (20.8, 76, .15), (21.5, 79, .15), (21.52, 84, .08), (22.2, 83, .1)):
    add(tone([(hz(m), 1), (hz(m) * 2, .35), (hz(m) * 3, .12)], 3.2, 2.2), t, gg, rng.uniform(-.3, .3))
t = 18.6
while t < 21.2:  # искры поглощённых бумаг
    add(bell_tone(hz(96 + int(rng.integers(0, 5))), 1.0, 5), t, .025, rng.uniform(-.8, .8))
    t += rng.exponential(.12)

# 23.6–26.9: Рядом
add(pad([48, 55, 60, 64], 3.6, 1.0, 1.2), 23.6, .34)  # C
add(bell_tone(hz(88), 3, 1.2), 24.5, .07, -.2)
add(bell_tone(hz(95), 3, 1.2), 24.62, .045, .2)

# 26.9–30: Знак
add(boom(3.2, 41), 27.45, .55)
add(pad([36, 48, 55, 60, 64, 67], 3.2, .5, 1.6), 27.2, .32)  # C (шире)
add(bell_tone(hz(84), 3, 1.0), 27.5, .08)
add(tone([(hz(72), 1), (hz(72) * 2, .3)], 2.5, 1.5), 28.3, .12)
add(rustle(.6), 29.0, .08, .3)

mix = np.stack([L, R], axis=1)
mix = np.tanh(mix * 1.3) / np.tanh(1.3)
mix *= 0.89 / np.max(np.abs(mix))
fo = int(0.45 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'sound.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
