export type RecordingState = 'inactive' | 'recording' | 'paused';

export interface RecordingResult {
  blob: Blob;
  durationSeconds: number;
  mimeType: string;
}

export const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/wav'
];

/**
 * Returns the best audio MIME type supported by the client browser.
 */
export function getSupportedMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return 'audio/webm;codecs=opus';
  }

  for (const mimeType of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return '';
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private recordedChunks: Blob[] = [];
  private startTime = 0;
  private pausedTime = 0;
  private totalPausedDuration = 0;
  private durationInterval: ReturnType<typeof setInterval> | null = null;
  private activeMimeType = '';
  private state: RecordingState = 'inactive';
  private currentDurationSeconds = 0;
  private currentLevel = 0;

  onDurationUpdate?: (seconds: number) => void;
  onLevelUpdate?: (level: number) => void;

  getState(): RecordingState {
    return this.state;
  }

  getDuration(): number {
    return this.currentDurationSeconds;
  }

  getLevel(): number {
    return this.currentLevel;
  }

  getMimeType(): string {
    return this.activeMimeType;
  }

  /**
   * Requests microphone access and starts recording.
   */
  async start(): Promise<void> {
    if (this.state !== 'inactive') {
      throw new Error(`Cannot start recording while state is ${this.state}`);
    }

    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Microphone access was denied. Please allow microphone permissions in your browser.');
      }
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        throw new Error('No microphone input device was found on your system.');
      }
      throw new Error(`Failed to access microphone: ${err.message}`);
    }

    this.activeMimeType = getSupportedMimeType();
    const options: MediaRecorderOptions = this.activeMimeType ? { mimeType: this.activeMimeType } : {};

    try {
      this.mediaRecorder = new MediaRecorder(this.audioStream, options);
    } catch {
      // Fallback without options if browser rejected mimeType
      this.mediaRecorder = new MediaRecorder(this.audioStream);
      this.activeMimeType = this.mediaRecorder.mimeType || 'audio/webm';
    }

    this.recordedChunks = [];
    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    // Setup AudioContext for live amplitude level detection
    this.setupAudioAnalyser(this.audioStream);

    this.startTime = Date.now();
    this.totalPausedDuration = 0;
    this.currentDurationSeconds = 0;
    this.state = 'recording';

    this.mediaRecorder.start(250); // 250ms timeslices for low latency chunking

    this.durationInterval = setInterval(() => {
      if (this.state === 'recording') {
        const elapsed = (Date.now() - this.startTime - this.totalPausedDuration) / 1000;
        this.currentDurationSeconds = Math.round(elapsed * 10) / 10;
        this.onDurationUpdate?.(this.currentDurationSeconds);
        this.updateAudioLevel();
      }
    }, 100);
  }

  pause(): void {
    if (this.state === 'recording' && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.pausedTime = Date.now();
      this.state = 'paused';
    }
  }

  resume(): void {
    if (this.state === 'paused' && this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.totalPausedDuration += Date.now() - this.pausedTime;
      this.mediaRecorder.resume();
      this.state = 'recording';
    }
  }

  /**
   * Stops recording, releases hardware tracks, and produces the final Audio Blob.
   */
  async stop(): Promise<RecordingResult> {
    if (this.state === 'inactive' || !this.mediaRecorder) {
      throw new Error('Cannot stop recording when recorder is inactive');
    }

    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }

    return new Promise<RecordingResult>((resolve, reject) => {
      if (!this.mediaRecorder) {
        return reject(new Error('MediaRecorder is null'));
      }

      this.mediaRecorder.onstop = () => {
        try {
          const finalMime = this.activeMimeType || 'audio/webm';
          const blob = new Blob(this.recordedChunks, { type: finalMime });
          const durationSeconds = this.currentDurationSeconds;

          this.cleanupHardware();
          this.state = 'inactive';

          resolve({
            blob,
            durationSeconds,
            mimeType: finalMime
          });
        } catch (e) {
          reject(e);
        }
      };

      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
    });
  }

  private setupAudioAnalyser(stream: MediaStream): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = 64;
        source.connect(this.analyserNode);
      }
    } catch {
      // Audio level analyser is non-critical enhancement; ignore if blocked
    }
  }

  private updateAudioLevel(): void {
    if (!this.analyserNode) {
      this.currentLevel = 0;
      return;
    }

    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    // Normalize to 0-100 range
    this.currentLevel = Math.min(100, Math.round((average / 255) * 100));
    this.onLevelUpdate?.(this.currentLevel);
  }

  private cleanupHardware(): void {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop());
      this.audioStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {
        // Ignore
      }
      this.audioContext = null;
    }

    this.analyserNode = null;
    this.mediaRecorder = null;
    this.currentLevel = 0;
  }
}
