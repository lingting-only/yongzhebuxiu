/* audio.js — WebAudio 合成音效(零素材,首次交互后启用) */
'use strict';

let AC = null;
function initAudio(){
  if (!AC){ try{ AC = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){} }
}
function toggleMute(){ G.muted = !G.muted; return G.muted; }

function sfx(name){
  if (G.muted || !AC) return;
  try{
    if (AC.state === 'suspended') AC.resume();
    const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
    o.connect(g); g.connect(AC.destination);
    let f0 = 440, f1 = 440, dur = 0.08, type = 'square', vol = 0.1;
    if      (name === 'hit'){   f0 = 300; f1 = 140; dur = 0.06; vol = 0.05; }
    else if (name === 'hurt'){  f0 = 180; f1 = 70;  dur = 0.18; type = 'sawtooth'; vol = 0.11; }
    else if (name === 'coin'){  f0 = 900; f1 = 1400; dur = 0.09; vol = 0.05; }
    else if (name === 'mat'){   f0 = 620; f1 = 1050; dur = 0.12; type = 'triangle'; vol = 0.08; }
    else if (name === 'chest'){ f0 = 500; f1 = 1200; dur = 0.3;  type = 'triangle'; vol = 0.12; }
    else if (name === 'pick'){  f0 = 700; f1 = 1500; dur = 0.18; type = 'triangle'; vol = 0.12; }
    else if (name === 'up'){    f0 = 420; f1 = 940;  dur = 0.25; type = 'triangle'; vol = 0.12; }
    else if (name === 'zap'){   f0 = 1400; f1 = 300; dur = 0.1;  vol = 0.06; }
    else if (name === 'boom'){  f0 = 120; f1 = 40;   dur = 0.35; type = 'sawtooth'; vol = 0.14; }
    else if (name === 'shoot'){ f0 = 800; f1 = 400;  dur = 0.06; vol = 0.04; }
    else if (name === 'dead'){  f0 = 280; f1 = 55;   dur = 0.5;  type = 'sawtooth'; vol = 0.10; }
    else if (name === 'revive'){f0 = 320; f1 = 820;  dur = 0.3;  type = 'triangle'; vol = 0.11; }
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t); o.stop(t + dur + 0.03);
  }catch(e){}
}
