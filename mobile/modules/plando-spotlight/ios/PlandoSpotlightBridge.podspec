require 'json'

Pod::Spec.new do |s|
  s.name           = 'PlandoSpotlightBridge'
  s.version        = '1.0.0'
  s.summary        = 'Plando Spotlight 브릿지 — 할 일을 CoreSpotlight 인덱스에 등록'
  s.description    = 'JS에서 할 일 목록을 받아 iOS 시스템 검색(Spotlight)에 색인하고, 결과 탭 시 딥링크로 상세 화면을 연다.'
  s.author         = 'plando'
  s.homepage       = 'https://plando.imjaewoo.dev'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.license        = { :type => 'MIT' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'CoreSpotlight'
  s.source_files = "**/*.{h,m,swift}"
end
