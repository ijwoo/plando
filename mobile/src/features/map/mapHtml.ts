/**
 * 카카오 지도 WebView HTML + RN 브리지.
 *
 * RN → WebView: webviewRef.injectJavaScript(...) 로 아래 전역 함수 호출
 *   - window.__setTodos(json)   위치 할 일 마커 갱신 (json = [{id,title,status,lat,lng}])
 *   - window.__select(id)        해당 할 일로 지도 이동 + 강조
 *   - window.__search(query)     키워드 장소 검색 (결과는 postMessage searchResults)
 *   - window.__panTo(lat,lng)    좌표로 이동
 *   - window.__setTemp(lat,lng)  임시 핀(장소 선택/새 위치) 표시, 인자 없으면 제거
 *   - window.__locate()          현재 위치로 이동
 *   - window.__setRoute(json)    오늘 동선 — 번호 오버레이+폴리라인 (json = {stops:[{i,lat,lng}], origin?} | null)
 *
 * WebView → RN: window.ReactNativeWebView.postMessage(JSON.stringify({type, ...}))
 *   - {type:'ready'}                          지도 로드 완료
 *   - {type:'markerTap', id}                  마커 탭
 *   - {type:'mapTap', lat, lng, address}      지도 빈 곳 탭(역지오코딩 주소 포함)
 *   - {type:'searchResults', results:[...]}   검색 결과
 */
/** 정적(비인터랙티브) 미니맵 — 할 일 상세의 위치 카드용. 좌표 중심 + 마커 1개. */
export function buildStaticMapHtml(jsKey: string, lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#e9eef3}</style>
</head><body>
<div id="map"></div>
<script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${jsKey}&autoload=false"></script>
<script>
  kakao.maps.load(function(){
    var pos = new kakao.maps.LatLng(${lat}, ${lng});
    var map = new kakao.maps.Map(document.getElementById('map'), { center: pos, level: 4, draggable:false, zoomable:false, scrollwheel:false, disableDoubleClick:true, disableDoubleClickZoom:true });
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24"><path fill="#3D7BFF" stroke="#fff" stroke-width="1.3" d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></svg>';
    var img = new kakao.maps.MarkerImage('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg), new kakao.maps.Size(34,34), { offset:new kakao.maps.Point(17,34) });
    new kakao.maps.Marker({ position: pos, image: img }).setMap(map);
  });
</script>
</body></html>`;
}

/**
 * 장소 검색 전용 경량 HTML (지도 없이 Kakao Places 서비스만).
 * 검색 라우트의 숨김 WebView에서 사용 — REST 키 없이 JS SDK로 키워드 검색.
 * RN → WebView: window.__search(query)
 * WebView → RN: {type:'ready'} / {type:'results', results:[{name,address,lat,lng}]}
 */
export function buildPlacesHtml(jsKey: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /></head><body>
<script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${jsKey}&autoload=false&libraries=services"></script>
<script>
  function post(o){ try{ window.ReactNativeWebView.postMessage(JSON.stringify(o)); }catch(e){} }
  var ps;
  window.__search = function(q){
    // 검색기가 아직 안 뜬 상태는 '결과 없음'이 아니라 '실패'다. 예전엔 둘 다 빈 결과로 보내서
    // SDK 로딩 실패가 "검색 결과가 없습니다"로 둔갑했다.
    if(!ps){ post({type:'error', reason:'not-ready'}); return; }
    if(!q){ post({type:'results', results:[]}); return; }
    try {
      ps.keywordSearch(q, function(data, status){
        var S = kakao.maps.services.Status;
        if(status === S.ZERO_RESULT){ post({type:'results', results:[]}); return; }
        if(status !== S.OK){ post({type:'error', reason:'search-failed'}); return; }
        post({type:'results', results: data.map(function(p){
          return { name:p.place_name, address:(p.road_address_name||p.address_name), lat:parseFloat(p.y), lng:parseFloat(p.x) };
        })});
      });
    } catch(e){ post({type:'error', reason:'search-threw'}); }
  };
  // SDK 스크립트 자체가 못 뜨면(오프라인·JS키 도메인 거절) kakao 가 undefined 라 여기서 던진다.
  // 예전엔 그대로 죽어 'ready'가 영영 안 와서 스피너가 무한히 돌았다.
  try {
    kakao.maps.load(function(){ ps = new kakao.maps.services.Places(); post({type:'ready'}); });
  } catch(e){ post({type:'error', reason:'sdk-load-failed'}); }
</script>
</body></html>`;
}

export function buildMapHtml(jsKey: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  html,body,#map{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#e9eef3}
  /* 길게 누를 때 브라우저 기본 텍스트 선택/콜아웃(파란 하이라이트) 방지 */
  *{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
  /* 내 위치 마커 — 가운데 점 + 번지는 펄스 */
  .myloc{position:absolute;width:0;height:0}
  .myloc .dot,.myloc .pulse{position:absolute;left:0;top:0;width:14px;height:14px;border-radius:50%;transform:translate(-50%,-50%);transform-origin:center center}
  .myloc .dot{background:#1A73E8;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);box-sizing:border-box}
  .myloc .pulse{background:#1A73E8;opacity:0.35;animation:mylocPulse 2.4s ease-out infinite}
  @keyframes mylocPulse{0%{transform:translate(-50%,-50%) scale(1);opacity:0.35}100%{transform:translate(-50%,-50%) scale(2.4);opacity:0}}
  /* 오늘 동선 — 다음 목적지 펄스 */
  .rt-next{position:relative}
  .rt-next .ring{position:absolute;left:50%;top:50%;width:100%;height:100%;border-radius:50%;background:#1976D2;opacity:.3;transform:translate(-50%,-50%);animation:rtPulse 1.8s ease-out infinite;z-index:-1}
  @keyframes rtPulse{0%{transform:translate(-50%,-50%) scale(1);opacity:.3}100%{transform:translate(-50%,-50%) scale(2.1);opacity:0}}
  .rt-seg{background:rgba(255,255,255,.92);border-radius:9px;padding:1.5px 7px;font:600 10.5px -apple-system;color:#5B6472;box-shadow:0 1px 3px rgba(0,0,0,.16);white-space:nowrap}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${jsKey}&autoload=false&libraries=services"></script>
<script>
  function post(o){ try{ window.ReactNativeWebView.postMessage(JSON.stringify(o)); }catch(e){} }
  var map, ps, geocoder, markers={}, markerColor={}, tempMarker=null, selectedId=null, fitted=false;
  var myMarker=null, circles=[];

  function clearCircles(){ circles.forEach(function(c){ c.setMap(null); }); circles=[]; }

  function markerImage(color, selected){
    color = color || '#3D7BFF';
    var size = selected ? 42 : 34;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 24 24">'
      + '<path fill="'+color+'" stroke="#fff" stroke-width="1.3" d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z"/>'
      + '<circle cx="12" cy="9" r="2.6" fill="#fff"/></svg>';
    return new kakao.maps.MarkerImage(
      'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg),
      new kakao.maps.Size(size, size),
      { offset: new kakao.maps.Point(size/2, size) }
    );
  }

  function clearMarkers(){ for(var k in markers){ markers[k].setMap(null); } markers={}; markerColor={}; clearCircles(); }

  window.__setTodos = function(list){
    if(!map) return;
    clearMarkers();
    var bounds = new kakao.maps.LatLngBounds(), positions=[];
    (list||[]).forEach(function(t){
      if(t.lat==null||t.lng==null) return;
      var pos = new kakao.maps.LatLng(t.lat, t.lng);
      var m = new kakao.maps.Marker({ position: pos, image: markerImage(t.color, t.id===selectedId) });
      m.setMap(map);
      kakao.maps.event.addListener(m, 'click', function(){ post({type:'markerTap', id:t.id}); });
      markers[t.id] = m; markerColor[t.id] = t.color;
      // 도착 알림이 켜진 할 일은 반경 원 표시
      if(t.radius){
        var circle = new kakao.maps.Circle({ center: pos, radius: t.radius, strokeWeight: 1, strokeColor: '#3D7BFF', strokeOpacity: 0.7, strokeStyle: 'solid', fillColor: '#3D7BFF', fillOpacity: 0.12 });
        circle.setMap(map); circles.push(circle);
      }
      bounds.extend(pos); positions.push(pos);
    });
    // 첫 로드 시 모든 마커가 보이도록 화면 맞춤
    if(!fitted && positions.length>0){
      if(positions.length===1){ map.setCenter(positions[0]); map.setLevel(4); }
      else {
        map.setBounds(bounds);
        if(map.getLevel() > 12) map.setLevel(12); // 너무 멀리 떨어진 마커여도 줌아웃 한계 적용
      }
      fitted = true;
    }
  };

  window.__select = function(id){
    selectedId = id;
    for(var k in markers){ markers[k].setImage(markerImage(markerColor[k], false)); }
    var m = markers[id];
    if(m){
      m.setImage(markerImage(markerColor[id], true));
      map.setCenter(m.getPosition());
      if(map.getLevel() > 3){ map.setLevel(3, { animate: true }); } // 잘 보이게 줌인(이미 가까우면 유지)
    }
  };

  window.__panTo = function(lat,lng){ if(map) map.panTo(new kakao.maps.LatLng(lat,lng)); };

  // 모아보기 — 현재 표시 중인 마커·동선 스톱 전체가 보이도록 화면 맞춤 (지도를 멀리 팬했을 때 복귀 수단)
  window.__fitAll = function(){
    if(!map) return;
    var bounds = new kakao.maps.LatLngBounds(), n = 0;
    for(var k in markers){ bounds.extend(markers[k].getPosition()); n++; }
    routeOverlays.forEach(function(o){ if(o.getPosition){ bounds.extend(o.getPosition()); n++; } });
    if(myMarker){ bounds.extend(myMarker.getPosition()); n++; }
    if(n === 0) return;
    if(n === 1){ map.setCenter(bounds.getSouthWest()); map.setLevel(4); return; }
    map.setBounds(bounds, 60, 40, 200, 40);
    if(map.getLevel() > 12) map.setLevel(12);
  };

  // ── 오늘 동선 레이어 (번호 오버레이 + 폴리라인) ──
  var routeOverlays = [], routeLine = null, routeOrigin = null;
  function clearRoute(){
    routeOverlays.forEach(function(o){ o.setMap(null); }); routeOverlays=[];
    if(routeLine){ routeLine.setMap(null); routeLine=null; }
    if(routeOrigin){ routeOrigin.setMap(null); routeOrigin=null; }
    if(window.__setSegRoute) window.__setSegRoute(null); // 동선 종료 시 구간 실경로도 제거
  }
  window.__setRoute = function(route){
    if(!map) return;
    clearRoute();
    if(!route || !route.stops || !route.stops.length) return;
    var path = [], bounds = new kakao.maps.LatLngBounds(), prev = null;
    if(route.origin && route.origin.lat!=null){
      // 출발점 dot은 따로 안 그린다 — 내 위치 마커(__myLocation)와 겹쳐 어지러움
      var op = new kakao.maps.LatLng(route.origin.lat, route.origin.lng);
      path.push(op); bounds.extend(op); prev = op;
    }
    route.stops.forEach(function(st){
      var pos = new kakao.maps.LatLng(st.lat, st.lng);
      // 실경로 좌표열이 있으면 폴리라인이 도로를 따라가게 삽입
      var segPts = null;
      if(prev && st.segPath && st.segPath.length){
        segPts = st.segPath.map(function(p){ return new kakao.maps.LatLng(p.lat, p.lng); });
        segPts.forEach(function(lp){ path.push(lp); bounds.extend(lp); });
      }
      // 구간 이동시간 라벨 — 실경로면 경로 중간점, 아니면 직선 중간
      if(prev && st.segLabel){
        var mid = segPts
          ? segPts[Math.floor(segPts.length/2)]
          : new kakao.maps.LatLng((prev.getLat()+pos.getLat())/2, (prev.getLng()+pos.getLng())/2);
        var segOv = new kakao.maps.CustomOverlay({ position: mid, zIndex: 10, content:
          '<div class="rt-seg">'+st.segLabel+'</div>' });
        segOv.setMap(map); routeOverlays.push(segOv);
      }
      path.push(pos); bounds.extend(pos); prev = pos;
      var done = st.state==='done', next = st.state==='next', missed = st.state==='missed';
      var bg = done ? '#9AA3AF' : missed ? '#F59E0B' : '#1976D2';
      var size = next ? 30 : 26;
      var inner = done ? '✓' : st.i;
      var html = '<div class="'+(next?'rt-next':'')+'" style="width:'+size+'px;height:'+size+'px;border-radius:'+(size/2)+'px;background:'+bg+';border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);color:#fff;font:800 '+(next?14:13)+'px -apple-system;display:flex;align-items:center;justify-content:center">'+(next?'<div class="ring"></div>':'')+inner+'</div>';
      var ov = new kakao.maps.CustomOverlay({ position: pos, zIndex: next?13:12, content: html });
      ov.setMap(map); routeOverlays.push(ov);
    });
    // 개요 동선은 중립 회색 점선 — 구간 선택 시 그려지는 파랑 실선(__setSegRoute)과 구분
    routeLine = new kakao.maps.Polyline({
      path: path, strokeWeight: 4, strokeColor: '#7A8699', strokeOpacity: 0.65, strokeStyle: 'shortdash'
    });
    routeLine.setMap(map);
    map.setBounds(bounds, 60, 40, 200, 40); // 시트 높이만큼 하단 패딩
    if(map.getLevel() > 12) map.setLevel(12);
  };

  // ── 구간 상세 실경로 폴리라인 (RouteDetailSheet에서 카카오 경로 API 결과 수신 시) ──
  var segLine = null;
  window.__setSegRoute = function(points){
    if(segLine){ segLine.setMap(null); segLine=null; }
    if(!points || !points.length || !map) return;
    var path = points.map(function(p){ return new kakao.maps.LatLng(p.lat, p.lng); });
    segLine = new kakao.maps.Polyline({
      path: path, strokeWeight: 5, strokeColor: '#1976D2', strokeOpacity: 0.9, strokeStyle: 'solid', zIndex: 3
    });
    segLine.setMap(map);
    var bounds = new kakao.maps.LatLngBounds();
    path.forEach(function(p){ bounds.extend(p); });
    map.setBounds(bounds, 60, 40, 320, 40); // 상세 시트 높이만큼 하단 패딩
    if(map.getLevel() > 12) map.setLevel(12);
  };

  window.__setTemp = function(lat,lng){
    if(tempMarker){ tempMarker.setMap(null); tempMarker=null; }
    if(lat==null) return;
    var pos = new kakao.maps.LatLng(lat,lng);
    tempMarker = new kakao.maps.Marker({ position: pos, image: markerImage('#111827', true), zIndex: 9 });
    tempMarker.setMap(map);
    map.panTo(pos);
  };

  window.__search = function(query){
    if(!ps) return;
    ps.keywordSearch(query, function(data, status){
      if(status !== kakao.maps.services.Status.OK){ post({type:'searchResults', results:[]}); return; }
      var results = data.map(function(p){
        return { id:p.id, name:p.place_name, address:(p.road_address_name||p.address_name), lat:parseFloat(p.y), lng:parseFloat(p.x) };
      });
      post({type:'searchResults', results:results});
    });
  };

  window.__myLocation = function(lat,lng){
    var pos = new kakao.maps.LatLng(lat, lng);
    if(!myMarker){
      // CustomOverlay + CSS로 펄스(번지는) 애니메이션
      var el = document.createElement('div');
      el.className = 'myloc';
      el.innerHTML = '<span class="pulse"></span><span class="dot"></span>';
      myMarker = new kakao.maps.CustomOverlay({ position: pos, content: el, zIndex: 6, yAnchor: 0.5, xAnchor: 0.5 });
      myMarker.setMap(map);
    } else { myMarker.setPosition(pos); }
  };

  window.__locate = function(){
    if(!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(function(pos){
      window.__panTo(pos.coords.latitude, pos.coords.longitude);
    });
  };

  kakao.maps.load(function(){
    map = new kakao.maps.Map(document.getElementById('map'), { center:new kakao.maps.LatLng(37.5665,126.978), level:5 });
    map.setMaxLevel(12); // 줌 아웃 한계 — 전국 규모까지(시외 동선 조망 가능, 세계지도까진 안 나가게)
    ps = new kakao.maps.services.Places();
    geocoder = new kakao.maps.services.Geocoder();
    // 지도 길게 누르기(0.5s) → 그 지점 좌표/주소를 역지오코딩해 전달 (탭은 무시)
    function reverseAndPost(ll){
      geocoder.coord2Address(ll.getLng(), ll.getLat(), function(res, status){
        var addr = '', name = '';
        if(status===kakao.maps.services.Status.OK && res[0]){
          var road = res[0].road_address, jibun = res[0].address;
          addr = (road && road.address_name) || (jibun && jibun.address_name) || '';
          name = (road && road.building_name) || ''; // 건물명이 있으면 명칭으로
        }
        post({type:'mapTap', lat:ll.getLat(), lng:ll.getLng(), name:name, address:addr});
      });
    }
    (function(){
      var el = document.getElementById('map'), timer=null, sx=0, sy=0, moved=false;
      el.addEventListener('touchstart', function(e){
        clearTimeout(timer);
        if(e.touches.length!==1) return;
        var t=e.touches[0]; sx=t.clientX; sy=t.clientY; moved=false;
        timer = setTimeout(function(){
          if(moved) return;
          var ll = map.getProjection().coordsFromContainerPoint(new kakao.maps.Point(sx, sy));
          reverseAndPost(ll);
        }, 500);
      }, {passive:true});
      el.addEventListener('touchmove', function(e){
        var t=e.touches[0]; if(!t) return;
        if(Math.abs(t.clientX-sx)>10 || Math.abs(t.clientY-sy)>10){ moved=true; clearTimeout(timer); }
      }, {passive:true});
      el.addEventListener('touchend', function(){ clearTimeout(timer); }, {passive:true});
      el.addEventListener('touchcancel', function(){ clearTimeout(timer); }, {passive:true});
    })();
    post({type:'ready'});
  });
</script>
</body>
</html>`;
}
