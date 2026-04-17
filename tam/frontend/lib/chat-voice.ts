import { Platform } from 'react-native';
import {
  Audio,
  InterruptionModeAndroid,
  InterruptionModeIOS,
  type AVPlaybackStatus,
} from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

/** Prefix for voice messages stored in RTDB as base64 m4a */
export const VOICE_M4A_PREFIX = '__TAM_VICEM4A__';

/** Hard cap for hold-to-record length (1 min 30 sec). */
export const MAX_VOICE_RECORDING_SEC = 90;
export const MAX_VOICE_RECORDING_MS = MAX_VOICE_RECORDING_SEC * 1000;

const MAX_BASE64_CHARS = 1_400_000;

export async function requestMicPermission(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}

export async function startRecordingSession(): Promise<Audio.Recording> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
    staysActiveInBackground: false,
  });
  try {
    const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    return recording;
  } catch {
    const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.LOW_QUALITY);
    return recording;
  }
}

export async function finishRecordingToPayload(
  recording: Audio.Recording,
  startedAtMs: number
): Promise<{ payload: string; durationSec: number } | null> {
  try {
    const uriBeforeStop = recording.getURI();
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI() ?? uriBeforeStop;
    if (!uri) return null;

    const elapsedMs = Math.max(0, Date.now() - startedAtMs);
    const durationSec = Math.max(
      1,
      Math.min(MAX_VOICE_RECORDING_SEC, Math.round(elapsedMs / 1000) || 1)
    );

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (base64.length > MAX_BASE64_CHARS) {
      return null;
    }
    return {
      payload: `${VOICE_M4A_PREFIX}${base64}`,
      durationSec,
    };
  } catch {
    return null;
  }
}

export function isVoiceM4aPayload(content: string): boolean {
  return typeof content === 'string' && content.startsWith(VOICE_M4A_PREFIX);
}

export function stripVoicePrefix(content: string): string {
  return content.slice(VOICE_M4A_PREFIX.length);
}

let lastSound: Audio.Sound | null = null;

function attachPlaybackEnd(sound: Audio.Sound, onFinished?: () => void) {
  sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
    if (status.isLoaded && status.didJustFinish) {
      onFinished?.();
    }
  });
}

async function createSoundAndPlay(uri: string, onFinished?: () => void): Promise<void> {
  const { sound } = await Audio.Sound.createAsync({ uri });
  lastSound = sound;
  try {
    await sound.setVolumeAsync(1);
  } catch {
    // ignore
  }
  attachPlaybackEnd(sound, onFinished);
  await sound.playAsync();
}

/**
 * Native playback: always use a real file URI. `data:` URIs often load without error but produce
 * no audible output in React Native / expo-av.
 */
export async function playVoicePayload(content: string, onFinished?: () => void): Promise<void> {
  if (!isVoiceM4aPayload(content)) return;
  const b64 = stripVoicePrefix(content);
  await stopPlayback();

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    interruptionModeIOS: InterruptionModeIOS.DuckOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
    staysActiveInBackground: false,
  });

  if (Platform.OS === 'web') {
    const dataUri = `data:audio/m4a;base64,${b64}`;
    try {
      await createSoundAndPlay(dataUri, onFinished);
    } catch {
      const baseDir = FileSystem.cacheDirectory;
      if (!baseDir) throw new Error('No cache directory');
      const path = `${baseDir}tam-voice-${Date.now()}.m4a`;
      await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
      await createSoundAndPlay(path, onFinished);
    }
    return;
  }

  const baseDir = FileSystem.cacheDirectory;
  if (!baseDir) {
    throw new Error('No cache directory for voice playback');
  }
  const path = `${baseDir}tam-voice-${Date.now()}.m4a`;
  await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
  await createSoundAndPlay(path, onFinished);
}

export async function stopPlayback(): Promise<void> {
  if (lastSound) {
    try {
      await lastSound.stopAsync();
      await lastSound.unloadAsync();
    } catch {
      // ignore
    }
    lastSound = null;
  }
}

