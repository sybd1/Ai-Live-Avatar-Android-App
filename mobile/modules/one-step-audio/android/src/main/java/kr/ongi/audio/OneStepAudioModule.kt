package kr.ongi.audio

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.os.Process
import android.os.SystemClock
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.atomic.AtomicInteger

/** The audio writer never runs on the UI, JS, or avatar renderer thread. */
class OneStepAudioModule : Module() {
  @Volatile private var playback: Playback? = null

  override fun definition() = ModuleDefinition {
    Name("OneStepAudio")
    Events("playback")
    Function("start") { session: String ->
      playback?.cancel()
      playback = Playback(session).also { it.start() }
    }
    Function("append") { session: String, id: String, data: String ->
      playback?.takeIf { it.session == session }?.offer(Packet(id, data))
    }
    Function("wav") { session: String, id: String, data: String ->
      playback?.takeIf { it.session == session }?.offer(Packet(id, data, wav = true))
    }
    Function("finish") { session: String, id: String ->
      playback?.takeIf { it.session == session }?.offer(Packet(id, end = true))
    }
    Function("stop") { session: String ->
      playback?.takeIf { it.session == session }?.cancel()
    }
    OnActivityEntersBackground { playback?.cancel() }
    OnDestroy { playback?.cancel(); playback = null }
  }

  private data class Packet(val id: String, val encoded: String = "", val end: Boolean = false, val wav: Boolean = false)

  private inner class Playback(val session: String) {
    private val queue = LinkedBlockingQueue<Packet>(256)
    private val queuedChars = AtomicInteger()
    @Volatile private var active = true
    @Volatile private var track: AudioTrack? = null
    private val worker = Thread({ run() }, "OneStepAudioWriter")
    private var framesWritten = 0L
    private var playing = false
    private var currentId = ""

    fun start() = worker.start()
    fun cancel() {
      active = false
      queue.clear()
      // Unblock WRITE_BLOCKING without waiting for the JS/UI thread to drain it.
      runCatching { track?.pause(); track?.flush() }
      worker.interrupt()
    }
    fun offer(packet: Packet) {
      if (!active) return
      if (packet.encoded.length > 6_700_000 || queuedChars.addAndGet(packet.encoded.length) > 8_000_000 || !queue.offer(packet)) {
        cancel()
        emit("error", packet.id, "음성 버퍼가 가득 찼어요. 잠시 후 다시 시작해 주세요.")
      }
    }
    private fun emit(type: String, id: String, message: String = "") {
      if (playback !== this) return
      sendEvent("playback", mapOf("session" to session, "type" to type, "id" to id, "message" to message))
    }
    private fun createTrack(): AudioTrack {
      val min = AudioTrack.getMinBufferSize(24000, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT)
      check(min > 0)
      return AudioTrack.Builder()
        .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
        .setAudioFormat(AudioFormat.Builder().setSampleRate(24000).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).setEncoding(AudioFormat.ENCODING_PCM_16BIT).build())
        .setTransferMode(AudioTrack.MODE_STREAM)
        .setBufferSizeInBytes(maxOf(min * 4, 24000)) // 500 ms, independent of WebView frames.
        .build().also { check(it.state == AudioTrack.STATE_INITIALIZED); track = it }
    }
    private fun beginIfNeeded(output: AudioTrack, force: Boolean = false) {
      if (!playing && (force || framesWritten >= 8400)) { // 350 ms startup jitter buffer.
        output.play()
        playing = true
        emit("started", currentId)
      }
    }
    private fun write(output: AudioTrack, bytes: ByteArray) {
      require(bytes.size % 2 == 0 && bytes.isNotEmpty())
      var offset = 0
      while (active && offset < bytes.size) {
        // Small writes ensure playback starts before the native buffer fills.
        val count = output.write(bytes, offset, minOf(3840, bytes.size - offset), AudioTrack.WRITE_BLOCKING)
        check(count > 0) { "AudioTrack write failed: $count" }
        offset += count
        framesWritten += count / 2
        beginIfNeeded(output)
      }
    }
    private fun finish(output: AudioTrack, id: String) {
      if (id != currentId || framesWritten == 0L) return
      beginIfNeeded(output, true)
      var lastHead = -1L
      var progressedAt = SystemClock.elapsedRealtime()
      while (active) {
        val head = output.playbackHeadPosition.toLong() and 0xffffffffL
        if (head >= framesWritten) break
        if (head != lastHead) { lastHead = head; progressedAt = SystemClock.elapsedRealtime() }
        check(SystemClock.elapsedRealtime() - progressedAt < 8000) { "Audio output stopped advancing" }
        Thread.sleep(15)
      }
      if (!active) return
      output.pause()
      output.flush()
      framesWritten = 0
      playing = false
      currentId = ""
      emit("ended", id)
    }
    private fun run() {
      try {
        Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO)
        val output = createTrack()
        while (active) {
          val packet = queue.take()
          queuedChars.addAndGet(-packet.encoded.length)
          if (packet.end) { finish(output, packet.id); continue }
          if (currentId.isNotEmpty() && currentId != packet.id) finish(output, currentId)
          currentId = packet.id
          val bytes = Base64.decode(packet.encoded, Base64.DEFAULT)
          if (packet.wav) { write(output, readWav(bytes)); finish(output, packet.id) }
          else write(output, bytes)
        }
      } catch (_: InterruptedException) {
        // Explicit pause/end/background: discard pending audio immediately.
      } catch (error: Exception) {
        if (active) emit("error", currentId, "음성 출력을 확인하지 못했어요. 다시 시작해 주세요.")
      } finally {
        active = false
        queue.clear()
        runCatching { track?.pause(); track?.flush(); track?.release() }
        track = null
      }
    }
    private fun readWav(bytes: ByteArray): ByteArray {
      val buffer = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
      require(bytes.size >= 44 && String(bytes, 0, 4, Charsets.US_ASCII) == "RIFF" && String(bytes, 8, 4, Charsets.US_ASCII) == "WAVE")
      var offset = 12
      var valid = false
      var pcm: ByteArray? = null
      while (offset + 8 <= bytes.size) {
        val size = buffer.getInt(offset + 4)
        require(size >= 0 && size <= bytes.size - offset - 8)
        val name = String(bytes, offset, 4, Charsets.US_ASCII)
        if (name == "fmt ") {
          require(size >= 16)
          valid = buffer.getShort(offset + 8).toInt() == 1 && buffer.getShort(offset + 10).toInt() == 1 && buffer.getInt(offset + 12) == 24000 && buffer.getShort(offset + 22).toInt() == 16
        }
        if (name == "data") pcm = bytes.copyOfRange(offset + 8, offset + 8 + size)
        offset += 8 + size + (size and 1)
      }
      require(valid && pcm != null) { "Expected mono PCM16 24kHz WAV" }
      return pcm
    }
  }
}
