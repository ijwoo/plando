import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';

/**
 * 할 일 완료 타격감 — 성공 햅틱(기본 켬) + 짧은 차임(옵션, 기기 로컬 설정).
 * 사운드는 무음 스위치를 존중하는 ambient 모드로 재생. 네이티브 모듈 없는 빌드에선 전부 no-op.
 */

const SOUND_KEY = 'plando_completion_sound';

let soundEnabled: boolean | null = null; // 캐시 (설정 화면이 setCompletionSound로 갱신)
// expo-audio는 네이티브 모듈 없는 빌드(구 dev 클라이언트)에서 import 자체가 던지므로 지연 로드
type AudioModule = typeof import('expo-audio');
let audio: AudioModule | null | undefined; // undefined=미시도, null=사용 불가
let player: ReturnType<AudioModule['createAudioPlayer']> | null = null;

function loadAudio(): AudioModule | null {
  if (audio !== undefined) return audio;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    audio = require('expo-audio') as AudioModule;
  } catch {
    audio = null;
  }
  return audio;
}

export async function hydrateCompletionSound(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(SOUND_KEY);
    soundEnabled = v === '1'; // 기본 꺼짐 (옵트인)
  } catch {
    soundEnabled = false;
  }
  return soundEnabled;
}

export async function setCompletionSound(v: boolean): Promise<void> {
  soundEnabled = v;
  try {
    await SecureStore.setItemAsync(SOUND_KEY, v ? '1' : '0');
  } catch {
    // 세션 내에는 반영됨
  }
}

function playChime(): void {
  try {
    const a = loadAudio();
    if (!a) return;
    if (!player) {
      // 다른 앱 오디오를 끊지 않고, 무음 스위치도 존중
      void a.setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
      player = a.createAudioPlayer(require('../../../assets/sounds/complete.m4a'));
      player.volume = 0.55;
    }
    player.seekTo(0);
    player.play();
  } catch {
    // 모듈 없음/재생 실패 — 무시
  }
}

/** 완료 순간 피드백 — done=true일 때만 (해제는 조용히) */
export function completionFeedback(done: boolean): void {
  if (!done) {
    Haptics.selectionAsync().catch(() => {});
    return;
  }
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  if (soundEnabled === null) {
    void hydrateCompletionSound().then((on) => {
      if (on) playChime();
    });
  } else if (soundEnabled) {
    playChime();
  }
}
