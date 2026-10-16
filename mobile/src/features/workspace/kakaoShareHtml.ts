/**
 * 카카오톡 공유 전용 숨김 WebView HTML + RN 브리지.
 *
 * 웹앱(frontend-todo)과 동일한 Kakao JS SDK를 로드한다 — 웹은
 * https://developers.kakao.com/sdk/js/kakao.min.js 를 로드하는데, 이 URL은
 * https://t1.kakaocdn.net/kakao_js_sdk/v1/kakao.min.js (Kakao.Share 포함 최신 v1 채널)로
 * 301 리다이렉트되므로 모바일은 최종 URL을 직접 로드한다.
 *
 * baseUrl은 카카오 콘솔에 등록된 웹 플랫폼 도메인(KAKAO_MAP_REFERRER 패턴)이어야
 * JS 키 도메인 검증을 통과한다.
 *
 * RN → WebView: webviewRef.injectJavaScript(`window.__share(${payloadJson});true;`)
 *   - payload = Kakao.Share.sendDefault 인자 (웹 KakaoInviteDialog와 동일 템플릿)
 *
 * WebView → RN: window.ReactNativeWebView.postMessage(JSON.stringify({type, ...}))
 *   - {type:'ready'}                 SDK 로드 + init 완료
 *   - {type:'sent'}                  sendDefault 호출 성공 (카카오톡/공유창 열림)
 *   - {type:'error', message}        SDK 로드 실패 또는 sendDefault 예외
 */
export function buildKakaoShareHtml(jsKey: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /></head><body>
<script>
  function post(o){ try{ window.ReactNativeWebView.postMessage(JSON.stringify(o)); }catch(e){} }
  function msg(e){ return String((e && e.message) || e || 'unknown'); }
  window.__share = function(payload){
    try {
      if (typeof payload === 'string') payload = JSON.parse(payload);
      if (!window.Kakao || !window.Kakao.Share) { post({type:'error', message:'Kakao SDK not ready'}); return; }
      window.Kakao.Share.sendDefault(payload);
      post({type:'sent'});
    } catch(e) { post({type:'error', message: msg(e)}); }
  };
  (function(){
    var s = document.createElement('script');
    s.src = 'https://t1.kakaocdn.net/kakao_js_sdk/v1/kakao.min.js';
    s.onload = function(){
      try {
        if (!window.Kakao.isInitialized()) window.Kakao.init(${JSON.stringify(jsKey)});
        post({type:'ready'});
      } catch(e) { post({type:'error', message: msg(e)}); }
    };
    s.onerror = function(){ post({type:'error', message:'Kakao SDK load failed'}); };
    document.head.appendChild(s);
  })();
</script>
</body></html>`;
}
