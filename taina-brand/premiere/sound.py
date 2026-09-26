"""Саундтрек трейлера-премьеры TAINA · AI-автоматизация (30 с) и короткий «удар» для тизеров (2 с).
Синтез, без внешних сэмплов.

Запуск: python3 sound.py trailer.wav sting.wav
"""
import sys
import wave
import numpy as np

SR = 48000
DUR = 30.0  # переопределяется для «удара»
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



def clatter(dur, rate=24.0, amp=1.0):  # стрёкот проектора
    n = int(dur * SR)
    out = np.zeros(n)
    k = band(rng.standard_normal(int(.012 * SR)), 1500, 7000) * np.exp(-np.arange(int(.012 * SR)) / (.002 * SR))
    t = 0.0
    while t < dur - .02:
        i = int(t * SR)
        out[i:i + len(k)] += k * (0.6 + 0.4 * rng.random())
        t += 1 / rate * (0.97 + 0.06 * rng.random())
    return out * amp


def whirr(t0, t1, speed):  # шум плёнки, громкость по скорости
    n = int((t1 - t0) * SR)
    tt = np.arange(n) / SR + t0
    x = band(rng.standard_normal(n), 1200, 8000)  # шелест бумаги
    return x * np.array([speed(v) for v in tt[::480]]).repeat(480)[:n]


def hit(t, g=.5, f0=46):
    add(boom(2.4, f0), t, g)
    add(band(rng.standard_normal(int(.08 * SR)), 2000, 10000) * np.exp(-np.arange(int(.08 * SR)) / (.015 * SR)), t, g * .5)


# 0–3.6 заставка: проектор, гул, глаза
n = int(3.7 * SR)
tt = np.arange(n) / SR
add((np.sin(2 * np.pi * 50 * tt) + .4 * np.sin(2 * np.pi * 100 * tt)) * env(n, .4, .3), 0.1, .05)
add(clatter(3.4, 24, .5) * env(int(3.4 * SR), .3, .4), 0.15, .5)
add(tone([(55, 1), (82.4, .5)], 3.6, .2, 1.0, .4), 0.0, .14)
add(bell_tone(hz(88)), 1.0, .05, -.3)
add(bell_tone(hz(95)), 1.55, .04, .3)
add(whoosh(.8, 200, 3000, False), 3.1, .1)

# 3.6–8.4 вопрос: нота на каждое слово
notes = [57, 60, 64, 67, 69, 67, 64, 72, 71, 69, 76]
for k, m in enumerate(notes):
    add(tone([(hz(m), 1), (hz(m) * 2, .3), (hz(m) * 3, .1)], 2.8, 2.0), 3.9 + k * .3, .13, (k % 3 - 1) * .3)
add(pad([45, 52, 57, 60], 4.8, 1.2, 1.0), 3.6, .22)

# 8.4–15 документы: шелест и щелчки ускоряются, удары на словах, провал на «Тишине»
spd = lambda v: 0.0 if 11.15 < v < 11.95 else min(1.0, 0.25 + 0.75 * ((v - 8.4) / 6.6) ** 2)
add(whirr(8.4, 15.0, spd), 8.4, .12)
t = 8.4
while t < 15.0:
    rate = 12 + 60 * ((t - 8.4) / 6.6) ** 2
    if not (11.15 < t < 11.95):
        add(band(rng.standard_normal(int(.01 * SR)), 1500, 8000) * np.exp(-np.arange(int(.01 * SR)) / (.002 * SR)), t, .18)
    t += 1 / rate
for bt in (9.2, 10.2, 12.4, 13.3):
    hit(bt, .42)
    add(pad([45, 57, 64], 1.2, .02, .9), bt, .12)
n = int(1.6 * SR); tt = np.arange(n) / SR
add((band(rng.standard_normal(n), 800, 12000) * (tt / 1.6) ** 3 + np.sin(2 * np.pi * np.cumsum(300 + 900 * (tt / 1.6) ** 2) / SR) * (tt / 1.6) ** 2 * .3) * env(n, .2, .02), 13.4, .25)
hit(15.0, .6, 40)

# 15–19 ответ
add(pad([41, 53, 57, 60, 64], 4.2, .8, 1.4), 15.0, .3)
add(bell_tone(hz(84), 3.5, .9), 15.2, .09)
add(tone([(hz(76), 1), (hz(76) * 2, .3)], 2.5, 1.6), 16.5, .12)
add(tone([(hz(72), 1), (hz(72) * 2, .3)], 2.5, 1.6), 17.4, .14)

# 19–24.5 занавес, ромб, ответ со ссылкой
add(whoosh(2.2, 80, 1200, True), 19.4, .35)
hit(20.6, .6, 42)
add(bell_tone(hz(84), 4, .7), 20.62, .1)
add(bell_tone(hz(91), 4, .8), 20.66, .06, .3)
add(pad([36, 48, 55, 60, 64, 67, 72], 5.5, .6, 1.5), 20.6, .34)
t = 21.0
while t < 23.5:  # искры
    add(bell_tone(hz(96 + int(rng.integers(0, 5))), 1.0, 5), t, .02, rng.uniform(-.8, .8))
    t += rng.exponential(.15)
add(whoosh(1.4, 3000, 12000, True), 21.8, .08)
for k in range(12):  # печать вопроса в карточке
    add(band(rng.standard_normal(int(.012 * SR)), 2500, 9000) * np.exp(-np.arange(int(.012 * SR)) / (.002 * SR)), 21.8 + k * .075, .12)
add(bell_tone(hz(88), 2, 1.5), 23.3, .05)  # ссылка на источник
hit(23.7, .4, 44)  # появление знака

# 24.5–30 премьера
add(pad([41, 48, 57, 60, 64], 2.6, .8, 1.0), 24.4, .28)
add(pad([43, 50, 55, 59, 62], 2.4, .8, 1.0), 26.2, .28)
add(pad([36, 48, 55, 60, 64, 67], 3.6, .8, 2.0), 27.6, .32)
for tt_, m in ((24.8, 72), (25.8, 76), (26.3, 74), (27.6, 72), (27.62, 79)):
    add(tone([(hz(m), 1), (hz(m) * 2, .35), (hz(m) * 3, .1)], 3.0, 1.8), tt_, .14)
hit(27.6, .45, 38)

# провал в тишину на «Тишине»: гасим всё, оставляем одну ноту
a, b, fd = int(11.17 * SR), int(11.92 * SR), int(.03 * SR)
gate = np.ones(N); gate[a:b] = .04; gate[a - fd:a] = np.linspace(1, .04, fd); gate[b:b + fd] = np.linspace(.04, 1, fd)
L *= gate; R *= gate
add(tone([(hz(81), 1), (hz(81) * 2.76, .3)], 1.2, 1.2), 11.25, .06)


def finish(path, fade=.45):
    mix = np.stack([L, R], axis=1)
    mix = np.tanh(mix * 1.3) / np.tanh(1.3)
    mix *= 0.89 / np.max(np.abs(mix))
    fo = int(fade * SR)
    mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((mix * 32767).astype('<i2').tobytes())


finish(sys.argv[1] if len(sys.argv) > 1 else 'trailer.wav')

# «удар» для финальной карточки тизеров
N = int(2.0 * SR); L = np.zeros(N); R = np.zeros(N)
hit(0.05, .7, 40)
add(bell_tone(hz(84), 2, 1.0), 0.08, .12)
add(pad([36, 48, 55, 60, 64], 2.0, .05, .8), 0.05, .3)
finish(sys.argv[2] if len(sys.argv) > 2 else 'sting.wav', .3)
