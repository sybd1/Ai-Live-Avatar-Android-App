import { readFileSync } from 'node:fs';

// The SDK has no public frame-rate/pixel-ratio options in 0.1.3. Apply this
// explicit, version-checked mobile profile in memory; keep node_modules intact.
export const avatarMobileProfile = {
  name: 'firststep-avatar-mobile-profile',
  setup(build) {
    build.onLoad({ filter: /TalkingAvatar-[^/\\]+\.js$/ }, ({ path }) => {
      if (!path.includes('@interviewflowai')) return;
      const version = JSON.parse(readFileSync('node_modules/@interviewflowai/talking-avatar/package.json', 'utf8')).version;
      if (version !== '0.1.3') throw new Error('Review the avatar mobile profile before upgrading the SDK.');
      let source = readFileSync(path, 'utf8');
      const replaceOnce = (before, after) => {
        if (source.split(before).length !== 2) throw new Error('Avatar SDK renderer changed; mobile profile needs review.');
        source = source.replace(before, after);
      };
      // Live PCM is played by our source AudioContext. Keep the SDK stream
      // for lip sync only: cross-context MediaStream audio is unreliable in
      // Android WebView and a second speaker path would also duplicate audio.
      replaceOnce('r.connect(i).connect(s.destination);', 'r.connect(i);');
      replaceOnce('new p.WebGLRenderer({ antialias: !0, alpha: !0 })', 'new p.WebGLRenderer({ antialias: !1, alpha: !0, powerPreference: "low-power" })');
      replaceOnce('this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))', 'this.renderer.setPixelRatio(1)');
      replaceOnce('Math.min(8, this.renderer.capabilities.getMaxAnisotropy())', 'Math.min(2, this.renderer.capabilities.getMaxAnisotropy())');
      replaceOnce('tick = () => {', `lastFrameAt = -Infinity;
  tick = (now) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.tick);
    const fps = globalThis.__firstStepAvatarSpeaking ? 24 : 8;
    if (document.hidden || now - this.lastFrameAt < 1000 / fps) return;
    this.lastFrameAt = now;`);
      replaceOnce('this.renderer.render(this.scene, this.camera), this.frame = requestAnimationFrame(this.tick);', 'this.renderer.render(this.scene, this.camera);');
      return { contents: source, loader: 'js' };
    });
  },
};
