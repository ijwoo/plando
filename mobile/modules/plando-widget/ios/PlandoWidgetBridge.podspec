require 'json'

Pod::Spec.new do |s|
  s.name           = 'PlandoWidgetBridge'
  s.version        = '1.0.0'
  s.summary        = 'Plando 위젯 브릿지 — App Group에 스냅샷 기록 + 타임라인 리로드'
  s.description    = 'JS에서 위젯용 데이터를 App Group UserDefaults에 쓰고 WidgetKit 타임라인을 새로고침한다.'
  s.author         = 'plando'
  s.homepage       = 'https://plando.imjaewoo.dev'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.license        = { :type => 'MIT' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = "**/*.{h,m,swift}"
end
