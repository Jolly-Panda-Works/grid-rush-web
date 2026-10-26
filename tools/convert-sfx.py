"""Make the game's sound effects (client/public/sfx) from the Complete UI Sound Effects library (CelerisLab).

    python tools/convert-sfx.py <folder with the library's WAV files (searched recursively)>

The library's files are 24-bit 48 kHz WAV; the game gets 16-bit mono 24 kHz WAV, trimmed and peak-normalised,
which every browser and the Android WebView decode (no codec needed, small enough to load at start).
"""
import array
import os
import sys
import wave

# game sound -> library file
PICKS = {
    'click': 'radio_button_select_02.wav',
    'select': 'selection_03.wav',
    'place': 'upgrade_applied_14.wav',
    'coin': 'purchase_success_03.wav',
    'error': 'error_message_03.wav',
    'turn': 'notification_06.wav',
    'reward': 'reward_crate_open_04.wav',
    'achievement': 'achievement_unlocked_01.wav',
    'win': 'quest_completed_08.wav',
    'lose': 'crafting_fail_01.wav',
    'level-up': 'level_up_08.wav',
    'warning': 'warning_pop_up_02.wav',
}
OUT = os.path.join(os.path.dirname(__file__), '..', 'client', 'public', 'sfx')
RATE = 24000


def read_mono16(path):
    """Samples as 16-bit mono ints (any of 16/24/32-bit PCM, mono or stereo) and the sample rate."""
    with wave.open(path, 'rb') as w:
        ch, width, rate, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        raw = w.readframes(n)
    if width == 2:
        pcm = array.array('h', raw)
    elif width in (3, 4):  # keep the two most significant bytes of each little-endian sample
        hi = bytearray(len(raw) // width * 2)
        hi[0::2] = raw[width - 2::width]
        hi[1::2] = raw[width - 1::width]
        pcm = array.array('h', bytes(hi))
    else:
        raise ValueError(f'{path}: {width * 8}-bit audio is not supported')
    if ch > 1:
        pcm = array.array('h', (sum(pcm[i:i + ch]) // ch for i in range(0, len(pcm), ch)))
    return pcm, rate


def resample(pcm, src, dst):
    if src == dst:
        return pcm
    step = src / dst
    return array.array('h', (pcm[int(i * step)] for i in range(int(len(pcm) / step))))


def trim_and_normalise(pcm, threshold=300, peak=29000):
    loud = [i for i, v in enumerate(pcm) if abs(v) > threshold]
    if not loud:
        return pcm
    pcm = pcm[max(0, loud[0] - 120):min(len(pcm), loud[-1] + 2400)]  # a little air before, a short tail after
    top = max(abs(v) for v in pcm) or 1
    k = peak / top
    return array.array('h', (max(-32768, min(32767, int(v * k))) for v in pcm))


def main(src_dir):
    found = {}
    for d, _, fs in os.walk(src_dir):
        for f in fs:
            found.setdefault(f, os.path.join(d, f))
    os.makedirs(OUT, exist_ok=True)
    missing = []
    for name, file in PICKS.items():
        if file not in found:
            missing.append(file)
            continue
        pcm, rate = read_mono16(found[file])
        pcm = trim_and_normalise(resample(pcm, rate, RATE))
        with wave.open(os.path.join(OUT, f'{name}.wav'), 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
            w.writeframes(pcm.tobytes())
        print(f'{name:12s} <- {file}  {len(pcm) / RATE:.2f}s')
    if missing:
        print('not found:', ', '.join(missing))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
