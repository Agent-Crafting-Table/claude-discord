import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  NoSubscriberBehavior,
  StreamType,
  type VoiceConnection,
} from '@discordjs/voice'
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { Readable } from 'stream'

const DEFAULT_VOICE = 'onyx'

export function readTtsVoice(): string {
  try {
    const claudeDir = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude')
    const content = readFileSync(join(claudeDir, 'persona.md'), 'utf8')
    const m = content.match(/^tts_voice:\s*"?([^"\n]+)"?\s*$/m)
    return m?.[1]?.trim() || DEFAULT_VOICE
  } catch {
    return DEFAULT_VOICE
  }
}

export async function synthesize(text: string, voiceName = readTtsVoice()): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'tts-1', input: text, voice: voiceName }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenAI TTS HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`)
  }

  return Buffer.from(await res.arrayBuffer())
}

export async function speak(text: string, connection: VoiceConnection, voiceName = readTtsVoice()): Promise<void> {
  const mp3 = await synthesize(text, voiceName)
  const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } })
  const resource = createAudioResource(Readable.from(mp3), { inputType: StreamType.Arbitrary })
  connection.subscribe(player)
  player.play(resource)
  await entersState(player, AudioPlayerStatus.Idle, 120_000)
}
