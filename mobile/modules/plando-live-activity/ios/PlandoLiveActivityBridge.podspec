require 'json'

Pod::Spec.new do |s|
  s.name           = 'PlandoLiveActivityBridge'
  s.version        = '1.0.0'
  s.summary        = 'Plan Do! Live Activity 브릿지 — 오늘 진행 상황을 잠금화면·다이나믹 아일랜드에 표시'
  s.description    = 'JS에서 오늘 done/total·다음 일정으로 ActivityKit Live Activity를 시작/갱신/종료한다.'
  s.author         = 'plando'
  s.homepage       = 'https://plando.imjaewoo.dev'
  s.platforms      = { :ios => '16.2' }
  s.source         = { git: '' }
  s.license        = { :type => 'MIT' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = "**/*.{h,m,swift}"
end
