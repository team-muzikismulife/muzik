export const youtubePlayerScript = `
window.__ytCreated=[];
window.YT={Player:class {
  constructor(element,options){this.options=options;this.alive=true;this.frame=document.createElement('iframe');this.frame.title='YouTube player event fixture';this.frame.srcdoc='<html style="background:#111;color:white"><body>Player event fixture</body></html>';element.replaceWith(this.frame);window.__ytCreated.push(options.videoId);window.__ytFixture=this;setTimeout(()=>{if(this.alive)options.events.onReady({target:this});},0);}
  playVideo(){this.emit(1);}
  pauseVideo(){this.emit(2);}
  emit(data){if(this.alive)this.options.events.onStateChange({data,target:this});}
  fail(){if(this.alive)this.options.events.onError({data:100,target:this});}
  destroy(){this.alive=false;this.frame.remove();}
}};
window.onYouTubeIframeAPIReady?.();
`;
