"""Звук мини-сериала «Бегемот»: python3 sound.py <серия 1|2|3> out.wav
Синтез без сэмплов: дождь, гром, двери, окрики, мурчание, тема Бегемота на фортепиано, колокольчики.
"""
import sys
import wave
import numpy as np

SR = 48000
DUR = 40.0
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
    a, r = min(n, int(attack * SR)), min(n, int(release * SR))
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



EP = int(sys.argv[1]); DURS = {1: 37, 2: 37, 3: 38}
N = int(DURS[EP] * SR); L = np.zeros(N); R = np.zeros(N)


def rain_bed(t0, t1, g0=1.0):
    n = int((t1 - t0) * SR)
    x = band(rng.standard_normal(n), 400, 9000) * .6 + band(rng.standard_normal(n), 120, 600) * .3
    add(x * env(n, .8, .8), t0, .09 * g0, -.1)
    add(band(rng.standard_normal(n), 400, 9000) * env(n, .8, .8), t0, .06 * g0, .3)
    t = t0
    while t < t1 - .1:  # отдельные капли
        k = int(.02 * SR); add(band(rng.standard_normal(k), 2000, 8000) * np.exp(-np.arange(k) / (.004 * SR)), t, .05 * g0, rng.uniform(-.9, .9))
        t += rng.exponential(.05)


def thunder(t, g0=.5):
    n = int(4 * SR); tt = np.arange(n) / SR
    x = band(rng.standard_normal(n), 25, 180) * (np.exp(-tt * 1.2) * (1 + np.sin(tt * 9) * .3))
    add(x * env(n, .15, 1), t, g0)


def door_open(t, g0=.35):
    n = int(1.1 * SR); tt = np.arange(n) / SR
    f = 300 + 500 * tt; creak = np.sin(2 * np.pi * np.cumsum(f) / SR) * (1 + np.sign(np.sin(2 * np.pi * 38 * tt))) * .25
    add(band(creak, 200, 3000) * env(n, .05, .3), t, g0 * .5)
    add(boom(.8, 70), t, g0 * .5)


def knock(t):
    for dt in (0, .22):
        add(boom(.35, 90) + band(rng.standard_normal(int(.35 * SR)), 200, 1200) * np.exp(-np.arange(int(.35 * SR)) / (.02 * SR)), t + dt, .45)


def purr(t, dur, g0=.18):
    n = int(dur * SR); tt = np.arange(n) / SR
    x = band(rng.standard_normal(n), 50, 420) * (0.5 + 0.5 * np.sin(2 * np.pi * 24 * tt)) ** 2
    add(x * env(n, .3, .4), t, g0)


def piano(t, m, g0=.14, pan=0):
    add(tone([(hz(m), 1), (hz(m) * 2, .4), (hz(m) * 3, .15), (hz(m) * 4, .06)], 3.2, 1.6), t, g0, pan)


THEME = [(0, 64), (.45, 67), (.9, 69), (1.6, 72), (2.1, 71), (2.6, 69)]  # мотив Бегемота
def theme(t, g0=.14, shift=0):
    for dt, m in THEME: piano(t + dt, m + shift, g0, (m - 68) * .05)


def end_card(t0):
    hit(t0 + .1, .45, 40)
    add(pad([45, 57, 60, 64, 69], 3.2, .5, 1.2), t0, .3)
    theme(t0 + .4, .15)


if EP == 1:
    rain_bed(0, 34.6, 1.0)
    thunder(2.4, .45); thunder(19.8, .3)
    add(pad([45, 52, 57, 60], 6, 1.5, 1.5), 0, .18)
    theme(1.2, .12)
    for i, m in enumerate([57, 60, 64, 62, 60, 59, 57, 55, 57, 60, 59, 57]):  # грустное фортепиано на улице
        piano(6.4 + i * 1.3, m, .1, (i % 3 - 1) * .2)
    for tt_ in (8.55, 12.6):
        hit(tt_, .35, 55); door_open(tt_ - .3, .3)
    add(boom(.5, 60), 16.6, .3)  # щелчок света в лавке
    add(pad([41, 48, 57, 60], 4, 1.2, 1.5), 19.4, .16)
    add(bell_tone(hz(88), 3, 1.2), 22.2, .05)  # красный отблеск
    door_open(26.5, .35)
    add(pad([41, 48, 53, 57, 60, 65], 7.5, 1.0, 2.0), 26.7, .3)  # тёплый свет из двери
    theme(28.2, .14, 5)
    purr(31.0, 3.0, .2)
    add(boom(.9, 55), 34.0, .35)
    end_card(34.3)
elif EP == 2:
    add(boom(.9, 55), 0.1, .3)  # дверь закрылась за спиной
    add(pad([48, 55, 60, 64], 11, 1.5, 2.0), 0.4, .22)
    t = 3.8
    while t < 10:  # шелест бумаг
        add(band(rng.standard_normal(int(.3 * SR)), 1500, 8000) * env(int(.3 * SR), .03, .2), t, .08, rng.uniform(-.8, .8)); t += rng.exponential(.35)
    for i, m in enumerate([72, 76, 79, 83, 84, 83, 79, 76]):  # колокольчики удивления
        add(bell_tone(hz(m), 2, 2.2), 4.2 + i * .4, .04, (i % 2 - .5) * .6)
    add(pad([45, 52, 57, 60, 64], 6.5, 1.2, 1.5), 10.8, .22)
    theme(11.4, .12)
    add(pad([41, 48, 57, 60], 3.5, .8, 1.2), 17.3, .22)
    add(bell_tone(hz(84), 4, .7), 20.3, .12); add(bell_tone(hz(91), 4, .8), 20.35, .07, .3); hit(20.3, .35, 46)
    add(whoosh(2, 300, 8000, True), 21.8, .12)
    add(pad([36, 48, 55, 60, 64, 67], 8, 1.0, 2.0), 22.4, .3)
    t = 22.5
    while t < 28.6:  # документы находят место — искры
        add(bell_tone(hz(88 + int(rng.integers(0, 8))), 1.0, 5), t, .025, rng.uniform(-.8, .8)); t += rng.exponential(.1)
    hit(28.0, .45, 42)
    theme(29.4, .14, 5)
    purr(31.9, 2.4, .18)
    end_card(34.2)
elif EP == 3:
    rain_bed(0, 35, .45)
    thunder(1.6, .25)
    add(pad([45, 52, 57, 60], 3.6, 1.2, 1.0), 0, .18)
    knock(3.9)
    door_open(4.6, .4)
    rain_bed(4.8, 29.8, .5)
    add(pad([45, 52, 57, 60], 5, 1.0, 1.2), 6.5, .16)
    add(pad([41, 48, 57, 60], 5, 1.0, 1.2), 11.6, .16)
    add(bell_tone(hz(84), 4, .7), 16.0, .1); add(bell_tone(hz(91), 4, .8), 16.05, .06, .3)
    add(whoosh(1.4, 400, 7000, True), 17.2, .12)
    for k in range(12):  # печать вопроса в карточке
        add(band(rng.standard_normal(int(.012 * SR)), 2500, 9000) * np.exp(-np.arange(int(.012 * SR)) / (.002 * SR)), 18.8 + k * .075, .12)
    add(bell_tone(hz(88), 2, 1.5), 20.4, .06)
    add(pad([36, 48, 55, 60, 64, 67], 6, .8, 1.5), 20.6, .26)
    add(pad([41, 48, 53, 57, 60], 5, 1.0, 1.5), 26.0, .24)
    theme(26.4, .14, 5)
    door_open(28.7, .25)
    purr(32.5, 2.5, .18)
    end_card(35.0)


def finish(path, fade=.45):
    mix = np.stack([L, R], axis=1)
    mix = np.tanh(mix * 1.3) / np.tanh(1.3)
    mix *= 0.89 / np.max(np.abs(mix))
    fo = int(fade * SR)
    mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((mix * 32767).astype('<i2').tobytes())


finish(sys.argv[2], .45)
