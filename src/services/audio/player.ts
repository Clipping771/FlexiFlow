export interface AudioPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

export class AudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;

  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onError?: (err: Error) => void;

  /**
   * Loads an audio source from a Blob or URL.
   */
  load(source: Blob | string): void {
    this.stop();

    if (source instanceof Blob) {
      this.objectUrl = URL.createObjectURL(source);
      this.audio = new Audio(this.objectUrl);
    } else {
      this.audio = new Audio(source);
    }

    this.audio.ontimeupdate = () => {
      if (this.audio) {
        this.onTimeUpdate?.(this.audio.currentTime, this.audio.duration || 0);
      }
    };

    this.audio.onended = () => {
      this.onEnded?.();
    };

    this.audio.onerror = () => {
      this.onError?.(new Error('Audio playback error encountered.'));
    };
  }

  async play(): Promise<void> {
    if (!this.audio) return;
    try {
      await this.audio.play();
    } catch (err: any) {
      this.onError?.(new Error(`Failed to play audio: ${err.message}`));
    }
  }

  pause(): void {
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }
  }

  seek(seconds: number): void {
    if (this.audio) {
      this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration || 0));
    }
  }

  setVolume(volume: number): void {
    if (this.audio) {
      this.audio.volume = Math.max(0, Math.min(1, volume));
    }
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  getState(): AudioPlayerState {
    return {
      isPlaying: this.audio ? !this.audio.paused && !this.audio.ended : false,
      currentTime: this.audio?.currentTime || 0,
      duration: this.audio?.duration || 0,
      volume: this.audio?.volume || 1
    };
  }
}
