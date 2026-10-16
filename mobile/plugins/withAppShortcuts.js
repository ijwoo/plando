const fs = require('fs');
const path = require('path');
const { withDangerousMod, withXcodeProject } = require('expo/config-plugins');

/**
 * Siri App Shortcuts 주입 — plugins/app-shortcuts/PlandoAppShortcuts.swift 를
 * prebuild 시 ios/<프로젝트>/ 로 복사하고 "메인 앱 타겟" 컴파일 소스에 등록한다.
 *
 * 왜 메인 앱 타겟인가: AppShortcutsProvider 와 그 인텐트는 앱 번들 밖(익스텐션/프레임워크)에
 * 있으면 Siri/Shortcuts 에 노출되지 않는다. (빌드 22에서 익스텐션 방식 실측 실패)
 */
// PlandoSharedKeychain.swift: 인텐트가 토큰을 키체인에서 읽기 위한 헬퍼
// (modules/plando-widget/ios·targets/widget 의 동명 파일과 바이트 동일 — 타겟 간 소스 공유 불가로 복제)
const FILES = ['PlandoAppShortcuts.swift', 'PlandoSharedKeychain.swift'];

const withAppShortcuts = (config) => {
  // 1) 파일 복사 (ios/<projectName>/)
  config = withDangerousMod(config, [
    'ios',
    (c) => {
      const projName = c.modRequest.projectName;
      for (const file of FILES) {
        const source = path.join(__dirname, 'app-shortcuts', file);
        const dest = path.join(c.modRequest.platformProjectRoot, projName, file);
        fs.copyFileSync(source, dest);
      }
      return c;
    },
  ]);

  // 2) 앱 타겟 컴파일 소스에 등록
  config = withXcodeProject(config, (c) => {
    const project = c.modResults;
    const projName = c.modRequest.projectName;
    for (const file of FILES) {
      const relPath = `${projName}/${file}`;
      if (!project.hasFile(relPath)) {
        const groupKey =
          project.findPBXGroupKey({ name: projName }) ??
          project.getFirstProject().firstProject.mainGroup;
        project.addSourceFile(relPath, { target: project.getFirstTarget().uuid }, groupKey);
      }
    }
    return c;
  });

  return config;
};

module.exports = withAppShortcuts;
