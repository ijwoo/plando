import { KAKAO_MAP_REFERRER } from '@/shared/config/env';

export const RECRUIT_MAP_REFERRER = KAKAO_MAP_REFERRER;

/**
 * 팀 모집 지도 모드 — 카테고리 색 핀 + 내 위치 펄스 + 내 근처 반경 원.
 * RN 브리지: __setItems(items, myLoc, radiusKm) / __select(id|null)
 * postMessage: ready · markerTap{id} · mapTap · bounds{sw,ne} (지도 멈출 때 = 웹 idle 미러)
 */
export function buildRecruitMapHtml(jsKey: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  html,body,#map{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#e9eef3}
  *{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
  .myloc{position:absolute;width:0;height:0}
  .myloc .dot,.myloc .pulse{position:absolute;left:0;top:0;width:14px;height:14px;border-radius:50%;transform:translate(-50%,-50%)}
  .myloc .dot{background:#1A73E8;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);box-sizing:border-box}
  .myloc .pulse{background:#1A73E8;opacity:.35;animation:p 2.4s ease-out infinite}
  @keyframes p{0%{transform:translate(-50%,-50%) scale(1);opacity:.35}100%{transform:translate(-50%,-50%) scale(2.4);opacity:0}}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${jsKey}&autoload=false"></script>
<script>
  function post(o){ try{ window.ReactNativeWebView.postMessage(JSON.stringify(o)); }catch(e){} }
  var map, markers={}, meta={}, selectedId=null, myOverlay=null, radiusCircle=null, fitted=false;

  // 현재 지도 화면 영역을 RN으로 — 목록을 "이 지역"으로 좁히는 데 사용 (웹 idle 필터 미러)
  function emitBounds(){
    if(!map) return;
    var b = map.getBounds(), sw = b.getSouthWest(), ne = b.getNorthEast();
    post({ type:'bounds', sw:{lat:sw.getLat(), lng:sw.getLng()}, ne:{lat:ne.getLat(), lng:ne.getLng()} });
  }

  function pinImage(color, emoji, selected){
    var size = selected ? 44 : 34;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 24 24">'
      + '<path fill="'+color+'" stroke="#fff" stroke-width="'+(selected?1.6:1.2)+'" d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z"/>'
      + '<text x="12" y="12" text-anchor="middle" font-size="8">'+emoji+'</text></svg>';
    return new kakao.maps.MarkerImage(
      'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg),
      new kakao.maps.Size(size,size),
      { offset: new kakao.maps.Point(size/2, size) }
    );
  }

  function refreshMarker(id){
    var m = markers[id]; if(!m) return;
    m.setImage(pinImage(meta[id].color, meta[id].emoji, id===selectedId));
    m.setZIndex(id===selectedId ? 10 : 1);
  }

  window.__select = function(id){
    var prev = selectedId; selectedId = id;
    if(prev!=null) refreshMarker(prev);
    if(id!=null && markers[id]){
      refreshMarker(id);
      map.panTo(markers[id].getPosition());
    }
  };

  window.__setItems = function(list, myLoc, radiusKm){
    for(var k in markers){ markers[k].setMap(null); }
    markers={}; meta={};
    var bounds = new kakao.maps.LatLngBounds(); var n=0;
    (list||[]).forEach(function(it){
      if(it.lat==null||it.lng==null) return;
      var pos = new kakao.maps.LatLng(it.lat, it.lng);
      var m = new kakao.maps.Marker({ position: pos, image: pinImage(it.color, it.emoji, it.id===selectedId) });
      m.setMap(map);
      kakao.maps.event.addListener(m, 'click', function(){ post({type:'markerTap', id:it.id}); });
      markers[it.id]=m; meta[it.id]={color:it.color, emoji:it.emoji};
      bounds.extend(pos); n++;
    });
    if(myOverlay){ myOverlay.setMap(null); myOverlay=null; }
    if(radiusCircle){ radiusCircle.setMap(null); radiusCircle=null; }
    if(myLoc){
      var mp = new kakao.maps.LatLng(myLoc.lat, myLoc.lng);
      var el = document.createElement('div'); el.className='myloc';
      el.innerHTML='<div class="pulse"></div><div class="dot"></div>';
      myOverlay = new kakao.maps.CustomOverlay({ position: mp, content: el, zIndex: 5 });
      myOverlay.setMap(map);
      bounds.extend(mp);
      if(radiusKm){
        radiusCircle = new kakao.maps.Circle({ center: mp, radius: radiusKm*1000, strokeWeight:1.5, strokeColor:'#1A73E8', strokeOpacity:.7, strokeStyle:'shortdash', fillColor:'#1A73E8', fillOpacity:.08 });
        radiusCircle.setMap(map);
      }
    }
    if(!fitted && (n>0 || myLoc)){ fitted=true; if(n>1||myLoc){ map.setBounds(bounds, 40, 40, 40, 40); } else if(n===1){ map.setCenter(bounds.getSouthWest()); map.setLevel(7); } }
  };

  // SDK 스크립트가 못 뜨면(오프라인·JS키 미설정·도메인 거절) kakao 가 undefined 라 여기서 던진다.
  // 예전엔 그대로 죽어 'ready'가 영영 안 왔고, 화면엔 회색 빈 지도만 남았다. (map-search와 동일 처리)
  try {
    if(typeof kakao === 'undefined' || !kakao.maps){ post({type:'error', reason:'sdk-missing'}); }
    else kakao.maps.load(function(){
      try {
        map = new kakao.maps.Map(document.getElementById('map'), {
          center: new kakao.maps.LatLng(37.5200, 127.0350), level: 9
        });
        kakao.maps.event.addListener(map, 'click', function(){ post({type:'mapTap'}); });
        kakao.maps.event.addListener(map, 'idle', emitBounds); // 드래그·줌 종료 시 영역 갱신
        setTimeout(emitBounds, 0); // 초기 영역 (idle 미발화 대비)
        post({type:'ready'});
      } catch(e){ post({type:'error', reason:'map-init-failed'}); }
    });
  } catch(e){ post({type:'error', reason:'sdk-load-failed'}); }
</script>
</body>
</html>`;
}
