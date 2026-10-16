import { useState } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { ListSectionHeader } from '@/shared/ui/List';
import { Segmented } from '@/shared/ui/Segmented';

/** 약관·개인정보처리방침·오픈소스 라이선스 — 웹 InfoDoc 모달들의 네이티브 미러 (설정 > 정보) */

type Doc = 'terms' | 'privacy' | 'licenses';
const DOCS = [
  { value: 'terms', label: '이용약관' },
  { value: 'privacy', label: '개인정보' },
  { value: 'licenses', label: '라이선스' },
];

const LIBRARIES = [
  { name: 'React / React Native', license: 'MIT' },
  { name: 'Expo', license: 'MIT' },
  { name: 'expo-router', license: 'MIT' },
  { name: 'TanStack Query', license: 'MIT' },
  { name: 'Zustand', license: 'MIT' },
  { name: 'Axios', license: 'MIT' },
  { name: 'react-native-reanimated', license: 'MIT' },
  { name: 'react-native-gesture-handler', license: 'MIT' },
  { name: 'react-native-webview', license: 'MIT' },
  { name: 'STOMP.js', license: 'Apache-2.0' },
  { name: '@expo/vector-icons (Ionicons)', license: 'MIT' },
];

/** 문서 섹션 — 플랫 리스트 톤의 큰 섹션 헤더(19/800) + 평면 본문 */
function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? <ListSectionHeader>{title}</ListSectionHeader> : null}
      {children}
    </View>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <ThemedText type="small" style={styles.body}>
      {children}
    </ThemedText>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View style={styles.bullets}>
      {items.map((it) => (
        <ThemedText key={it} type="small" style={styles.body}>
          {'•'} {it}
        </ThemedText>
      ))}
    </View>
  );
}

function Terms() {
  return (
    <>
      <ThemedText type="small" style={styles.updated}>
        최종 업데이트: 2026년 4월 28일
      </ThemedText>
      <Body>본 약관은 Plan Do!(이하 &quot;서비스&quot;) 이용에 관한 조건과 절차, 이용자와 서비스의 권리·의무를 규정합니다.</Body>
      <Section title="제1조 (목적)">
        <Body>이 약관은 이용자가 서비스를 이용함에 있어 필요한 사항을 정함을 목적으로 합니다.</Body>
      </Section>
      <Section title="제2조 (정의)">
        <Bullets
          items={[
            '"이용자"란 본 약관에 따라 서비스를 이용하는 회원을 말합니다.',
            '"워크스페이스"란 할 일·일정을 함께 관리하는 협업 공간을 말합니다.',
            '"콘텐츠"란 이용자가 서비스에 입력·업로드한 할 일, 일정, 댓글, 파일 등을 말합니다.',
          ]}
        />
      </Section>
      <Section title="제3조 (서비스의 제공)">
        <Bullets
          items={[
            '서비스는 할 일 관리, 일정·캘린더, 팀 협업, 알림 등의 기능을 제공합니다.',
            '서비스는 운영상·기술상 필요에 따라 제공 내용을 변경할 수 있습니다.',
            '서비스는 연중무휴 제공을 원칙으로 하되, 점검 등의 사유로 일시 중단될 수 있습니다.',
          ]}
        />
      </Section>
      <Section title="제4조 (이용자의 의무)">
        <Bullets
          items={[
            '이용자는 타인의 정보를 도용하거나 허위 정보를 등록해서는 안 됩니다.',
            '이용자는 서비스를 법령과 본 약관에 위배되는 목적으로 이용해서는 안 됩니다.',
            '이용자가 작성한 콘텐츠에 대한 책임은 이용자 본인에게 있습니다.',
          ]}
        />
      </Section>
      <Section title="제5조 (콘텐츠의 권리)">
        <Body>이용자가 작성한 콘텐츠의 권리는 이용자에게 있으며, 서비스는 서비스 제공·운영에 필요한 범위 내에서만 이를 이용합니다.</Body>
      </Section>
      <Section title="제6조 (책임의 제한)">
        <Body>
          서비스는 천재지변, 이용자의 귀책사유, 통신 장애 등 불가항력으로 인한 손해에 대해 책임을 지지 않습니다. 서비스는 무료로
          제공되는 기능의 정확성·완전성을 보증하지 않습니다.
        </Body>
      </Section>
      <Section title="제7조 (회원 탈퇴 및 이용 제한)">
        <Body>이용자는 언제든지 설정 화면에서 회원 탈퇴를 할 수 있으며, 본 약관을 위반한 경우 서비스 이용이 제한될 수 있습니다.</Body>
      </Section>
      <Section title="제8조 (약관의 변경)">
        <Body>서비스는 필요 시 약관을 변경할 수 있으며, 변경 시 서비스 내 공지를 통해 안내합니다. 변경된 약관은 공지 후 효력이 발생합니다.</Body>
      </Section>
      <Section title="문의">
        <Body>약관 관련 문의: wawa9972@gmail.com</Body>
      </Section>
    </>
  );
}

function Privacy() {
  return (
    <>
      <ThemedText type="small" style={styles.updated}>
        최종 업데이트: 2026년 4월 28일
      </ThemedText>
      <Body>Plan Do!는 이용자의 개인정보를 중요하게 생각하며 관련 법령을 준수합니다.</Body>
      <Section title="1. 수집하는 개인정보 항목">
        <Bullets
          items={[
            '이메일 주소, 이름(표시 이름)',
            '프로필 사진 (사용자가 직접 업로드한 경우)',
            '위치 정보 (지도 기능 사용 시, 동의 후 수집)',
            '서비스 이용 기록 (할 일, 일정, 댓글 등 입력 데이터)',
            '소셜 로그인 시 해당 플랫폼(카카오, Google, Apple)에서 제공하는 식별자',
          ]}
        />
      </Section>
      <Section title="2. 개인정보 수집 및 이용 목적">
        <Bullets
          items={[
            '회원 가입 및 본인 확인',
            '서비스 제공 (할 일 관리, 팀 협업, 일정 관리 등)',
            '위치 기반 알림 서비스 제공',
            '고객 문의 대응 및 서비스 개선',
            '푸시 알림 발송',
          ]}
        />
      </Section>
      <Section title="3. 개인정보 보유 및 이용 기간">
        <Body>회원 탈퇴 시 즉시 삭제합니다. 단, 관련 법령에 따라 일정 기간 보관이 필요한 경우 해당 기간 동안 보관 후 삭제합니다.</Body>
      </Section>
      <Section title="4. 개인정보의 제3자 제공">
        <Body>
          서비스는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 단, 소셜 로그인 연동 시 해당 플랫폼(Kakao, Google,
          Apple)의 정책에 따라 최소한의 정보가 사용됩니다.
        </Body>
      </Section>
      <Section title="5. 이용자의 권리">
        <Bullets
          items={[
            '개인정보 열람, 수정, 삭제 요청',
            '설정 페이지에서 계정 삭제(회원 탈퇴) 가능',
            '위치 정보 수집 동의 철회: 기기 설정에서 언제든지 변경 가능',
          ]}
        />
      </Section>
      <Section title="6. 개인정보 보호책임자">
        <Body>개인정보 관련 문의: wawa9972@gmail.com</Body>
      </Section>
    </>
  );
}

function Licenses({ divider }: { divider: string }) {
  return (
    <>
      <Body>Plan Do!는 아래의 오픈소스 소프트웨어를 사용하여 만들어졌습니다. 각 라이브러리는 해당 라이선스를 따릅니다.</Body>
      <View style={styles.libList}>
        {LIBRARIES.map((lib, i) => (
          <View key={lib.name} style={[styles.libRow, i > 0 && { borderTopColor: divider, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <ThemedText type="default" style={styles.libName}>
              {lib.name}
            </ThemedText>
            <ThemedText type="small" style={styles.body}>
              {lib.license}
            </ThemedText>
          </View>
        ))}
      </View>
      <Body>각 라이선스 전문은 해당 프로젝트의 공식 저장소에서 확인할 수 있습니다.</Body>
    </>
  );
}

export default function LegalScreen() {
  const theme = useTheme();
  // 딥링크/로그인 동의 링크에서 초기 문서 지정 (?doc=privacy 등)
  const { doc: docParam } = useLocalSearchParams<{ doc?: string }>();
  const initialDoc: Doc = docParam === 'privacy' || docParam === 'licenses' ? docParam : 'terms';
  const [doc, setDoc] = useState<Doc>(initialDoc);

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: true, title: '약관 및 정보' }} />
      <View style={styles.segmentWrap}>
        <Segmented options={DOCS} value={doc} onChange={(v) => setDoc(v as Doc)} />
      </View>
      {/* 카드 박스 없이 평면 본문 — 섹션 헤더가 문서 구조를 잡는다 */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {doc === 'terms' ? <Terms /> : doc === 'privacy' ? <Privacy /> : <Licenses divider={theme.divider} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  segmentWrap: { paddingHorizontal: 16, paddingTop: 12 },
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  updated: { opacity: 0.5 },
  // 섹션 헤더(ListSectionHeader)가 자체 marginTop 24를 가짐
  section: { gap: 6 },
  body: { opacity: 0.75, lineHeight: 20 },
  bullets: { gap: 3 },
  libList: { marginVertical: 6 },
  // 라이선스 목록 — 플랫 행 규격(제목 16/600, V11, hairline)
  libRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 11 },
  libName: { flexShrink: 1, fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
});
